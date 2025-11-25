<?php
/**
 * Customer Pending Report API
 * Endpoint: /api/residence/customer-pending-report.php
 * Returns customers with pending residence amounts
 * EXACT COPY from residenceRptController_FIXED.php SELECT_PENDINGCUSTOMERS
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

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

$customerID = isset($_POST['customerID']) ? (int)$_POST['customerID'] : 0;
$currencyID = isset($_POST['currencyID']) ? (int)$_POST['currencyID'] : 0;

if ($currencyID == 0) {
    JWTHelper::sendResponse(400, false, 'Currency ID is required');
}

try {
    // Check if custom charges table exists
    $customChargesTableExists = false;
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'residence_custom_charges'");
        $customChargesTableExists = $checkTable->rowCount() > 0;
    } catch (Exception $e) {
        $customChargesTableExists = false;
    }
    
    if ($customerID == 0) {
        // EXACT COPY from residenceRptController_FIXED.php - All customers query
        $selectQuery = $pdo->prepare("
            SELECT 
                customer_id as main_customer,
                customer_name,
                IFNULL(customer_email,'') AS customer_email,
                customer_whatsapp,
                customer_phone, 
                SUM(outstanding_balance) as total
            FROM (
                SELECT 
                    c.customer_id,
                    c.customer_name,
                    c.customer_email,
                    c.customer_whatsapp,
                    c.customer_phone,
                (
                        -- Calculate total charges per residence
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 0 
                            ELSE r.sale_price 
                        END +
                        IFNULL((SELECT SUM(rf.fineAmount) FROM residencefine rf 
                            WHERE rf.residenceID = r.residenceID AND rf.fineCurrencyID = :currencyID), 0) +
                        IFNULL((SELECT SUM(rc.cancellation_charges) FROM residence_cancellation rc 
                            WHERE rc.residence = r.residenceID AND rc.customer_id = c.customer_id), 0) +
                        CASE 
                            WHEN IFNULL(rch.tawjeeh_included_in_sale, 0) = 0 THEN IFNULL(rch.tawjeeh_amount, 150) 
                            ELSE 0 
                        END +
                        CASE 
                            WHEN IFNULL(rch.insurance_included_in_sale, 0) = 0 THEN 
                                IFNULL(rch.insurance_amount, 126) + IFNULL(rch.insurance_fine, 0)
                            ELSE IFNULL(rch.insurance_fine, 0)
                        END +
                        " . ($customChargesTableExists ? "IFNULL((SELECT SUM(rcc.sale_price) FROM residence_custom_charges rcc 
                            WHERE rcc.residence_id = r.residenceID), 0)" : "0") . "
                    ) - (
                        -- Calculate total payments per residence
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 
                                (IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0) +
                                 IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.residenceCancelPayment = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0))
                            ELSE 
                                IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0)
                        END +
                        IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                            JOIN residencefine rf ON rf.residenceFineID = cp.residenceFinePayment
                            WHERE rf.residenceID = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0) +
                        IFNULL((SELECT SUM(cp.tawjeeh_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_tawjeeh_payment = 1), 0) +
                        (IFNULL((SELECT SUM(cp.insurance_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_payment = 1), 0) +
                         IFNULL((SELECT SUM(cp.insurance_fine_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_fine_payment = 1), 0))
                    ) AS outstanding_balance
                FROM customer c
                INNER JOIN residence r ON r.customer_id = c.customer_id
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                WHERE r.saleCurID = :currencyID
            ) AS residence_balances
            WHERE outstanding_balance > 0
            GROUP BY customer_id, customer_name, customer_email, customer_whatsapp, customer_phone
            ORDER BY customer_name ASC
        ");
        $selectQuery->bindParam(':currencyID', $currencyID);
    } else {
        // EXACT COPY from residenceRptController_FIXED.php - Single customer query
        $selectQuery = $pdo->prepare("
            SELECT 
                customer_id as main_customer,
                customer_name,
                IFNULL(customer_email,'') AS customer_email,
                customer_whatsapp,
                customer_phone, 
                SUM(outstanding_balance) as total
            FROM (
                SELECT 
                    c.customer_id,
                    c.customer_name,
                    c.customer_email,
                    c.customer_whatsapp,
                    c.customer_phone,
                (
                        -- Calculate total charges per residence
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 0 
                            ELSE r.sale_price 
                        END +
                        IFNULL((SELECT SUM(rf.fineAmount) FROM residencefine rf 
                            WHERE rf.residenceID = r.residenceID AND rf.fineCurrencyID = :currencyID), 0) +
                        IFNULL((SELECT SUM(rc.cancellation_charges) FROM residence_cancellation rc 
                            WHERE rc.residence = r.residenceID AND rc.customer_id = c.customer_id), 0) +
                        CASE 
                            WHEN IFNULL(rch.tawjeeh_included_in_sale, 0) = 0 THEN IFNULL(rch.tawjeeh_amount, 150) 
                            ELSE 0 
                        END +
                        CASE 
                            WHEN IFNULL(rch.insurance_included_in_sale, 0) = 0 THEN 
                                IFNULL(rch.insurance_amount, 126) + IFNULL(rch.insurance_fine, 0)
                            ELSE IFNULL(rch.insurance_fine, 0)
                        END +
                        " . ($customChargesTableExists ? "IFNULL((SELECT SUM(rcc.sale_price) FROM residence_custom_charges rcc 
                            WHERE rcc.residence_id = r.residenceID), 0)" : "0") . "
                    ) - (
                        -- Calculate total payments per residence
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 
                                (IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0) +
                                 IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.residenceCancelPayment = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0))
                            ELSE 
                                IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                                    WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0)
                        END +
                        IFNULL((SELECT SUM(cp.payment_amount) FROM customer_payments cp 
                            JOIN residencefine rf ON rf.residenceFineID = cp.residenceFinePayment
                            WHERE rf.residenceID = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID), 0) +
                        IFNULL((SELECT SUM(cp.tawjeeh_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_tawjeeh_payment = 1), 0) +
                        (IFNULL((SELECT SUM(cp.insurance_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_payment = 1), 0) +
                         IFNULL((SELECT SUM(cp.insurance_fine_payment_amount) FROM customer_payments cp 
                            WHERE cp.PaymentFor = r.residenceID AND cp.customer_id = c.customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_fine_payment = 1), 0))
                    ) AS outstanding_balance
                FROM customer c
                INNER JOIN residence r ON r.customer_id = c.customer_id
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                WHERE c.customer_id = :customer_id AND r.saleCurID = :currencyID
            ) AS residence_balances
            WHERE outstanding_balance > 0
            GROUP BY customer_id, customer_name, customer_email, customer_whatsapp, customer_phone
            ORDER BY customer_name ASC
        ");
        $selectQuery->bindParam(':currencyID', $currencyID);
        $selectQuery->bindParam(':customer_id', $customerID);
    }
    
    $selectQuery->execute();
    $data = $selectQuery->fetchAll(PDO::FETCH_ASSOC);
    
    // If single customer query, return as array
    if ($customerID > 0 && count($data) > 0) {
        $data = [$data[0]];
    }
    
    JWTHelper::sendResponse(200, true, 'Pending customers retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Customer Pending Report API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving pending customers: ' . $e->getMessage());
}
