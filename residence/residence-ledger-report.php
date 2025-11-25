<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Residence Ledger Report API
 * Endpoint: /api/residence/residence-ledger-report.php
 * Returns detailed residence ledger for a customer/currency
 * EXACT COPY from residenceLedgerController.php GetResidenceReport
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$customerID = isset($_POST['ID']) ? (int)$_POST['ID'] : (isset($_POST['customerID']) ? (int)$_POST['customerID'] : 0);
$currencyID = isset($_POST['CurID']) ? (int)$_POST['CurID'] : (isset($_POST['currencyID']) ? (int)$_POST['currencyID'] : 0);

if ($customerID == 0 || $currencyID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID and Currency ID are required');
}

// Pagination parameters
$page = isset($_POST['page']) ? max(1, (int)$_POST['page']) : 1;
$limit = isset($_POST['limit']) ? max(1, min(100, (int)$_POST['limit'])) : 10; // Max 100 records per page
$offset = ($page - 1) * $limit;

try {
    // Check if custom charges table exists
    $customChargesTableExists = false;
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'residence_custom_charges'");
        $customChargesTableExists = $checkTable->rowCount() > 0;
    } catch (Exception $e) {
        $customChargesTableExists = false;
    }
    
    // EXACT COPY from old residenceLedgerController.php - GetResidenceReport
    $customChargesQuery = $customChargesTableExists ? 
        "IFNULL((SELECT SUM(rcc.sale_price) FROM residence_custom_charges rcc 
            WHERE rcc.residence_id = r.residenceID), 0)" : "0";
    
    $sql = "SELECT 
        r.residenceID,
        r.passenger_name as main_passenger,
        IFNULL((SELECT countryName FROM airports WHERE airports.airport_id = r.Nationality), 'N/A') AS nationality,
        IFNULL((SELECT IFNULL(company_name,'') FROM company WHERE company.company_id = r.company LIMIT 1),'') AS company_name, 
        DATE(r.datetime) AS dt,
        CASE 
            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 0 
            ELSE r.sale_price 
        END AS sale_price,
        IFNULL((SELECT SUM(rf.fineAmount) FROM residencefine rf 
            WHERE rf.residenceID = r.residenceID AND rf.fineCurrencyID = :CurID), 0) AS fine,
        CASE 
            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 
                (IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID), 0) +
                 IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                    WHERE cp.residenceCancelPayment = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID), 0))
            ELSE 
                IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID), 0)
        END AS residencePayment,
        IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
            JOIN residencefine rf ON rf.residenceFineID = cp.residenceFinePayment
            WHERE rf.residenceID = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID), 0) AS finePayment,
        r.current_status,
        IFNULL((SELECT SUM(rc.cancellation_charges) FROM residence_cancellation rc 
            WHERE rc.residence = r.residenceID AND rc.customer_id = :id), 0) AS cancellation_charges,
        -- TAWJEEH charges and payments
        CASE 
            WHEN IFNULL(rch.tawjeeh_included_in_sale, 0) = 0 THEN IFNULL(rch.tawjeeh_amount, 150) 
            ELSE 0 
        END AS tawjeeh_charges,
        IFNULL((SELECT SUM(cp.tawjeeh_payment_amount) FROM customer_payments cp 
            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID AND cp.is_tawjeeh_payment = 1), 0) AS tawjeeh_payments,
        -- ILOE charges and payments
        CASE 
            WHEN IFNULL(rch.insurance_included_in_sale, 0) = 0 THEN 
                IFNULL(rch.insurance_amount, 126) + IFNULL(rch.insurance_fine, 0)
            ELSE IFNULL(rch.insurance_fine, 0)
        END AS iloe_charges,
        (IFNULL((SELECT SUM(cp.insurance_payment_amount) FROM customer_payments cp 
            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID AND cp.is_insurance_payment = 1), 0) +
         IFNULL((SELECT SUM(cp.insurance_fine_payment_amount) FROM customer_payments cp 
            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = :id AND cp.currencyID = :CurID AND cp.is_insurance_fine_payment = 1), 0)) AS iloe_payments,
        -- Custom charges
        " . $customChargesQuery . " AS custom_charges
    FROM residence r
    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
    WHERE r.customer_id = :id 
    AND r.saleCurID = :CurID
    ORDER BY r.datetime ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':id', $customerID);
    $stmt->bindParam(':CurID', $currencyID);
    $stmt->execute();
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Filter records to only show those with outstanding balance > 0 (EXACT COPY from old file)
    $filteredRecords = [];
    foreach ($records as $record) {
        $totalCharges = floatval($record['sale_price']) + floatval($record['fine']) + floatval($record['cancellation_charges']) 
                      + floatval($record['tawjeeh_charges']) + floatval($record['iloe_charges']) + floatval($record['custom_charges']);
        $totalPayments = floatval($record['residencePayment']) + floatval($record['finePayment']) 
                       + floatval($record['tawjeeh_payments']) + floatval($record['iloe_payments']);
        $balance = $totalCharges - $totalPayments;
        
        if ($balance > 0) {
            $filteredRecords[] = $record;
        }
    }
    
    // Calculate totals (sum ALL filtered records)
    $totalCharges = 0;
    $totalPaid = 0;
    
    foreach ($filteredRecords as $record) {
        $totalCharges += floatval($record['sale_price']) + floatval($record['fine']) + floatval($record['cancellation_charges']) 
                      + floatval($record['tawjeeh_charges']) + floatval($record['iloe_charges']) + floatval($record['custom_charges']);
        $totalPaid += floatval($record['residencePayment']) + floatval($record['finePayment']) 
                   + floatval($record['tawjeeh_payments']) + floatval($record['iloe_payments']);
    }
    
    // Get total count before pagination
    $totalCount = count($filteredRecords);
    
    // Apply pagination
    $paginatedRecords = array_slice($filteredRecords, $offset, $limit);
    
    // Calculate total pages
    $totalPages = ceil($totalCount / $limit);
    
    JWTHelper::sendResponse(200, true, 'Residence ledger retrieved successfully', [
        'data' => $paginatedRecords,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => $totalCount,
            'recordsPerPage' => $limit,
            'hasNextPage' => $page < $totalPages,
            'hasPreviousPage' => $page > 1
        ],
        'totals' => [
            'totalCharges' => $totalCharges,
            'totalPaid' => $totalPaid,
            'outstandingBalance' => $totalCharges - $totalPaid
        ]
    ]);
} catch (Exception $e) {
    error_log('Residence Ledger Report API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving residence ledger: ' . $e->getMessage());
}
