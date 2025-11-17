<?php
/**
 * Customer Pending Report API
 * Endpoint: /api/residence/customer-pending-report.php
 * Returns customers with pending residence amounts
 * Replicates SELECT_PENDINGCUSTOMERS from residenceRptController.php
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
    
    $customChargesQuery = $customChargesTableExists ? 
        "(SELECT IFNULL(SUM(rcc.sale_price), 0) FROM residence_custom_charges rcc 
            INNER JOIN residence r ON r.residenceID = rcc.residence_id 
            WHERE r.customer_id = main_customer AND r.saleCurID = :currencyID)" : "0";
    
    if ($customerID == 0) {
        // Get all customers with pending amounts for selected currency
        $sql = "SELECT * FROM (
            SELECT 
                customer_id as main_customer,
                customer_name,
                IFNULL(customer_email,'') AS customer_email,
                customer_whatsapp,
                customer_phone, 
                (
                    -- Calculate total charges (sale price + fines + cancellation charges + TAWJEEH + ILOE + Custom Charges) for specific currency
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 0 
                            ELSE r.sale_price 
                        END
                    ), 0) FROM residence r 
                    WHERE r.customer_id = main_customer AND r.saleCurID = :currencyID) +
                    (SELECT IFNULL(SUM(rf.fineAmount), 0) FROM residencefine rf 
                        INNER JOIN residence r ON r.residenceID = rf.residenceID 
                        WHERE r.customer_id = main_customer AND rf.fineCurrencyID = :currencyID) +
                    (SELECT IFNULL(SUM(rc.cancellation_charges), 0) FROM residence_cancellation rc
                        INNER JOIN residence r ON r.residenceID = rc.residence
                        WHERE rc.customer_id = main_customer AND r.saleCurID = :currencyID) +
                    -- TAWJEEH charges (only when not included in sale price)
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN IFNULL(rch.tawjeeh_included_in_sale, 0) = 0 THEN IFNULL(rch.tawjeeh_amount, 150) 
                            ELSE 0 
                        END
                    ), 0) FROM residence r 
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                    WHERE r.customer_id = main_customer AND r.saleCurID = :currencyID) +
                    -- ILOE charges (insurance amount + fine when not included, or just fine when included)
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN IFNULL(rch.insurance_included_in_sale, 0) = 0 THEN 
                                IFNULL(rch.insurance_amount, 126) + IFNULL(rch.insurance_fine, 0)
                            ELSE IFNULL(rch.insurance_fine, 0)
                        END
                    ), 0) FROM residence r 
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                    WHERE r.customer_id = main_customer AND r.saleCurID = :currencyID) +
                    -- Custom charges
                    " . $customChargesQuery . " +
                    -- Family residence charges (include ALL family residences for customer, regardless of currency)
                    (SELECT IFNULL(SUM(fr.sale_price), 0) FROM family_residence fr 
                        WHERE fr.customer_id = main_customer)
                ) - (
                    -- Calculate total payments (regular payments + cancel payments + fine payments + TAWJEEH + ILOE) for specific currency
                    -- Exclude family residence payments (family_res_payment = 1) from regular payments
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        INNER JOIN residence r ON r.residenceID = cp.PaymentFor 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.residenceCancelPayment IS NOT NULL AND cp.customer_id = main_customer AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        INNER JOIN residencefine rf ON rf.residenceFineID = cp.residenceFinePayment 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- TAWJEEH payments (exclude family payments)
                    (SELECT IFNULL(SUM(cp.tawjeeh_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID AND cp.is_tawjeeh_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- ILOE payments (insurance + fine payments, exclude family payments)
                    (SELECT IFNULL(SUM(cp.insurance_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID AND cp.is_insurance_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.insurance_fine_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID AND cp.is_insurance_fine_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- Family residence payments (ONLY where family_res_payment = 1)
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = main_customer AND cp.currencyID = :currencyID 
                        AND cp.family_res_payment = 1)
                ) AS total 
            FROM customer
        ) as baseTable 
        WHERE total > 0 
        ORDER By customer_name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':currencyID', $currencyID);
    } else {
        // Get specific customer with pending amounts
        $customChargesQuerySingle = $customChargesTableExists ? 
            "(SELECT IFNULL(SUM(rcc.sale_price), 0) FROM residence_custom_charges rcc 
                INNER JOIN residence r ON r.residenceID = rcc.residence_id 
                WHERE r.customer_id = :customer_id AND r.saleCurID = :currencyID)" : "0";
        
        $sql = "SELECT * FROM (
            SELECT 
                customer_id as main_customer,
                customer_name,
                IFNULL(customer_email,'') AS customer_email,
                customer_whatsapp,
                customer_phone, 
                (
                    -- Calculate total charges (sale price + fines + cancellation charges + TAWJEEH + ILOE + Custom Charges) for specific customer and currency
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN r.current_status = 'cancelled' OR r.current_status = 'cancelled & replaced' THEN 0 
                            ELSE r.sale_price 
                        END
                    ), 0) FROM residence r 
                    WHERE r.customer_id = :customer_id AND r.saleCurID = :currencyID) +
                    (SELECT IFNULL(SUM(rf.fineAmount), 0) FROM residencefine rf 
                        INNER JOIN residence r ON r.residenceID = rf.residenceID 
                        WHERE r.customer_id = :customer_id AND rf.fineCurrencyID = :currencyID) +
                    (SELECT IFNULL(SUM(rc.cancellation_charges), 0) FROM residence_cancellation rc
                        INNER JOIN residence r ON r.residenceID = rc.residence
                        WHERE rc.customer_id = :customer_id AND r.saleCurID = :currencyID) +
                    -- TAWJEEH charges (only when not included in sale price)
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN IFNULL(rch.tawjeeh_included_in_sale, 0) = 0 THEN IFNULL(rch.tawjeeh_amount, 150) 
                            ELSE 0 
                        END
                    ), 0) FROM residence r 
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                    WHERE r.customer_id = :customer_id AND r.saleCurID = :currencyID) +
                    -- ILOE charges (insurance amount + fine when not included, or just fine when included)
                    (SELECT IFNULL(SUM(
                        CASE 
                            WHEN IFNULL(rch.insurance_included_in_sale, 0) = 0 THEN 
                                IFNULL(rch.insurance_amount, 126) + IFNULL(rch.insurance_fine, 0)
                            ELSE IFNULL(rch.insurance_fine, 0)
                        END
                    ), 0) FROM residence r 
                    LEFT JOIN residence_charges rch ON rch.residence_id = r.residenceID
                    WHERE r.customer_id = :customer_id AND r.saleCurID = :currencyID) +
                    -- Custom charges
                    " . $customChargesQuerySingle . " +
                    -- Family residence charges (include ALL family residences for customer, regardless of currency)
                    (SELECT IFNULL(SUM(fr.sale_price), 0) FROM family_residence fr 
                        WHERE fr.customer_id = :customer_id)
                ) - (
                    -- Calculate total payments (regular payments + cancel payments + fine payments + TAWJEEH + ILOE) for specific customer and currency
                    -- Exclude family residence payments (family_res_payment = 1) from regular payments
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        INNER JOIN residence r ON r.residenceID = cp.PaymentFor 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.residenceCancelPayment IS NOT NULL AND cp.customer_id = :customer_id AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        INNER JOIN residencefine rf ON rf.residenceFineID = cp.residenceFinePayment 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- TAWJEEH payments (exclude family payments)
                    (SELECT IFNULL(SUM(cp.tawjeeh_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID AND cp.is_tawjeeh_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- ILOE payments (insurance + fine payments, exclude family payments)
                    (SELECT IFNULL(SUM(cp.insurance_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    (SELECT IFNULL(SUM(cp.insurance_fine_payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID AND cp.is_insurance_fine_payment = 1 
                        AND (cp.family_res_payment IS NULL OR cp.family_res_payment = 0)) +
                    -- Family residence payments (ONLY where family_res_payment = 1)
                    (SELECT IFNULL(SUM(cp.payment_amount), 0) FROM customer_payments cp 
                        WHERE cp.customer_id = :customer_id AND cp.currencyID = :currencyID 
                        AND cp.family_res_payment = 1)
                ) AS total 
            from customer 
            WHERE customer_id = :customer_id
        ) AS baseTable 
        WHERE total > 0 
        ORDER BY customer_name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->bindParam(':customer_id', $customerID);
    }
    
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // If single customer query, return as array
    if ($customerID > 0 && count($data) > 0) {
        $data = [$data[0]];
    }
    
    JWTHelper::sendResponse(200, true, 'Pending customers retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Customer Pending Report API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving pending customers: ' . $e->getMessage());
}

