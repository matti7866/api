<?php
/**
 * Get Residence Ledger for Agent's Customer
 * Endpoint: /api/agent/residence-ledger.php
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$agentData = JWTHelper::verifyRequest();

if (!$agentData || !isset($agentData['type']) || $agentData['type'] !== 'agent') {
    JWTHelper::sendResponse(401, false, 'Unauthorized - Agent access only');
}

// Get parameters
$currency_id = isset($_GET['currencyID']) ? (int)$_GET['currencyID'] : null;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
$offset = ($page - 1) * $limit;

if (!$currency_id) {
    JWTHelper::sendResponse(400, false, 'Currency ID is required');
}

try {
    // Get agent's customer_id
    $customer_id = $agentData['customer_id'];
    
    // Get currency name
    $currSql = "SELECT currencyName FROM currency WHERE currencyID = :currency_id";
    $currStmt = $pdo->prepare($currSql);
    $currStmt->bindParam(':currency_id', $currency_id);
    $currStmt->execute();
    $currency = $currStmt->fetch(PDO::FETCH_ASSOC);
    
    // Main ledger query
    $sql = "SELECT 
                r.residenceID,
                r.passenger_name as main_passenger,
                a.countryName as nationality,
                comp.company_name,
                r.datetime as dt,
                r.sale_price,
                COALESCE(fine_totals.total_fine, 0) as fine,
                COALESCE(r.cancellation_cost, 0) as cancellation_charges,
                COALESCE(rch.tawjeeh_amount, 0) as tawjeeh_charges,
                COALESCE(rch.insurance_amount, 0) as iloe_charges,
                COALESCE(custom_charges.total_custom, 0) as custom_charges,
                COALESCE(payments.residence_payment, 0) as residencePayment,
                COALESCE(payments.fine_payment, 0) as finePayment,
                COALESCE(payments.tawjeeh_payment, 0) as tawjeeh_payments,
                COALESCE(payments.iloe_payment, 0) as iloe_payments,
                CASE 
                    WHEN r.completedStep = 10 THEN 'Completed'
                    WHEN r.cancelled = 1 THEN 'Cancelled'
                    WHEN r.hold = 1 THEN 'On Hold'
                    ELSE CONCAT('Step ', r.completedStep)
                END as current_status
            FROM residence r
            LEFT JOIN airports a ON r.Nationality = a.airport_id
            LEFT JOIN company comp ON r.company = comp.company_id
            LEFT JOIN residence_charges rch ON r.residenceID = rch.residence_id
            LEFT JOIN (
                SELECT residenceID, SUM(fineAmount) as total_fine
                FROM residencefine
                GROUP BY residenceID
            ) fine_totals ON r.residenceID = fine_totals.residenceID
            LEFT JOIN (
                SELECT residence_id, SUM(sale_price) as total_custom
                FROM residence_custom_charges
                GROUP BY residence_id
            ) custom_charges ON r.residenceID = custom_charges.residence_id
            LEFT JOIN (
                SELECT 
                    PaymentFor,
                    SUM(CASE WHEN PaymentFor IS NOT NULL AND (residenceFinePayment IS NULL OR residenceFinePayment = 0) THEN payment_amount ELSE 0 END) as residence_payment,
                    SUM(CASE WHEN residenceFinePayment IS NOT NULL AND residenceFinePayment > 0 THEN payment_amount ELSE 0 END) as fine_payment,
                    0 as tawjeeh_payment,
                    0 as iloe_payment
                FROM customer_payments
                WHERE currencyID = :currency_id
                GROUP BY PaymentFor
            ) payments ON r.residenceID = payments.PaymentFor
            WHERE r.customer_id = :customer_id
            AND r.saleCurID = :currency_id
            AND (r.deleted = 0 OR r.deleted IS NULL)
            ORDER BY r.datetime DESC";
    
    // Get total counts for all records (not paginated)
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':customer_id', $customer_id);
    $stmt->bindParam(':currency_id', $currency_id);
    $stmt->execute();
    $allRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalRecords = count($allRecords);
    $totalPages = ceil($totalRecords / $limit);
    
    // Calculate totals from all records
    $totalCharges = 0;
    $totalPaid = 0;
    
    foreach ($allRecords as $record) {
        $charges = floatval($record['sale_price']) +
                   floatval($record['fine']) +
                   floatval($record['cancellation_charges']) +
                   floatval($record['tawjeeh_charges']) +
                   floatval($record['iloe_charges']) +
                   floatval($record['custom_charges']);
        
        $paid = floatval($record['residencePayment']) +
                floatval($record['finePayment']) +
                floatval($record['tawjeeh_payments']) +
                floatval($record['iloe_payments']);
        
        $totalCharges += $charges;
        $totalPaid += $paid;
    }
    
    $outstandingBalance = $totalCharges - $totalPaid;
    
    // Get paginated records
    $paginatedRecords = array_slice($allRecords, $offset, $limit);
    
    // Prepare response data
    $responseData = [
        'data' => $paginatedRecords,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => $totalRecords,
            'recordsPerPage' => $limit
        ],
        'totals' => [
            'totalCharges' => round($totalCharges, 2),
            'totalPaid' => round($totalPaid, 2),
            'outstandingBalance' => round($outstandingBalance, 2)
        ],
        'currency' => $currency ? $currency['currencyName'] : ''
    ];
    
    // Log the response for debugging
    error_log("Ledger response - Total Charges: $totalCharges, Total Paid: $totalPaid, Outstanding: $outstandingBalance, Currency: " . ($currency ? $currency['currencyName'] : 'N/A'));
    
    JWTHelper::sendResponse(200, true, 'Success', $responseData);
    
} catch (Exception $e) {
    error_log("Agent ledger error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error fetching ledger: ' . $e->getMessage());
}
?>

