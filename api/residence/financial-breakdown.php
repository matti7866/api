<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Financial Breakdown for a Residence
 * Endpoint: /api/residence/financial-breakdown.php
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

// Get residence ID
$residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : 0;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get residence details from residence table AND residence_charges table
    $sql = "SELECT 
                r.sale_price,
                r.saleCurID,
                curr.currencyName as sale_currency_name,
                IFNULL(rch.tawjeeh_included_in_sale, 0) AS tawjeeh_included,
                IFNULL(rch.insurance_included_in_sale, 0) AS insurance_included,
                IFNULL(rch.tawjeeh_amount, 150) AS tawjeeh_amount,
                IFNULL(rch.insurance_amount, 126) AS insurance_amount,
                IFNULL(rch.insurance_fine, 0) AS insurance_fine
            FROM residence r
            LEFT JOIN currency curr ON r.saleCurID = curr.currencyID
            LEFT JOIN residence_charges rch ON r.residenceID = rch.residence_id
            WHERE r.residenceID = :residenceID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID, PDO::PARAM_INT);
    $stmt->execute();
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Calculate outstanding amounts based on whether they're included in sale price
    $salePrice = (float)$residence['sale_price'];
    // Only add tawjeeh if NOT included in sale price
    $tawjeehAmount = $residence['tawjeeh_included'] == 0 ? (float)$residence['tawjeeh_amount'] : 0;
    // Only add insurance if NOT included in sale price
    $insuranceAmount = $residence['insurance_included'] == 0 ? (float)$residence['insurance_amount'] : 0;
    // Insurance fine is always added
    $iloeFine = (float)$residence['insurance_fine'];
    
    // Get total fine amount
    $fineQuery = $pdo->prepare("SELECT IFNULL(SUM(fineAmount), 0) AS total_fine FROM residencefine WHERE residenceID = :residenceID");
    $fineQuery->bindParam(':residenceID', $residenceID);
    $fineQuery->execute();
    $fineData = $fineQuery->fetch(PDO::FETCH_ASSOC);
    $totalFine = (float)$fineData['total_fine'];
    
    // Get total fine payments
    $finePaidQuery = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) AS fine_paid 
                                    FROM customer_payments 
                                    WHERE residenceFinePayment IN (
                                        SELECT residenceFineID FROM residencefine WHERE residenceID = :residenceID
                                    )");
    $finePaidQuery->bindParam(':residenceID', $residenceID);
    $finePaidQuery->execute();
    $finePaidData = $finePaidQuery->fetch(PDO::FETCH_ASSOC);
    $totalFinePaid = (float)$finePaidData['fine_paid'];
    
    // Get total payments from customer_payments table (same as old app)
    $paymentSql = "SELECT COALESCE(SUM(payment_amount), 0) as total_paid 
                   FROM customer_payments 
                   WHERE PaymentFor = :residenceID";
    $paymentStmt = $pdo->prepare($paymentSql);
    $paymentStmt->bindParam(':residenceID', $residenceID, PDO::PARAM_INT);
    $paymentStmt->execute();
    $paymentResult = $paymentStmt->fetch(PDO::FETCH_ASSOC);
    $totalPaid = (float)$paymentResult['total_paid'];
    
    // Get custom charges (if table exists)
    $customChargesTotal = 0;
    $customChargesList = [];
    try {
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'residence_custom_charges'");
        if ($tableCheck->rowCount() > 0) {
            $customChargesQuery = $pdo->prepare("SELECT 
                                                    id,
                                                    charge_title,
                                                    net_cost,
                                                    sale_price,
                                                    profit,
                                                    currency_id,
                                                    remarks,
                                                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at
                                                FROM residence_custom_charges 
                                                WHERE residence_id = :residence_id
                                                ORDER BY created_at DESC");
            $customChargesQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
            $customChargesQuery->execute();
            $customChargesList = $customChargesQuery->fetchAll(PDO::FETCH_ASSOC);
            
            // Calculate total custom charges (sum of sale_price)
            $customChargesTotalQuery = $pdo->prepare("SELECT IFNULL(SUM(sale_price), 0) AS custom_charges_total 
                                                      FROM residence_custom_charges 
                                                      WHERE residence_id = :residence_id");
            $customChargesTotalQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
            $customChargesTotalQuery->execute();
            $customChargesTotalData = $customChargesTotalQuery->fetch(PDO::FETCH_ASSOC);
            $customChargesTotal = (float)$customChargesTotalData['custom_charges_total'];
        }
    } catch (Exception $customChargeError) {
        // Table doesn't exist yet, no custom charges
        error_log("Custom charges query error: " . $customChargeError->getMessage());
    }
    
    // Calculate breakdown - include custom charges in total
    $totalAmount = $salePrice + $tawjeehAmount + $insuranceAmount + $iloeFine + $totalFine + $customChargesTotal;
    $saleOutstanding = max(0, $salePrice - $totalPaid);
    $tawjeehOutstanding = $tawjeehAmount;
    $insuranceOutstanding = $insuranceAmount;
    $iloeFineOutstanding = $iloeFine;
    $fineOutstanding = max(0, $totalFine - $totalFinePaid);
    $customChargesOutstanding = $customChargesTotal; // Custom charges are always outstanding until paid
    $totalOutstanding = max(0, $totalAmount - $totalPaid - $totalFinePaid);
    
    $breakdown = [
        'sale_price' => $salePrice,
        'sale_outstanding' => $saleOutstanding,
        'tawjeeh_amount' => $tawjeehAmount,
        'tawjeeh_outstanding' => $tawjeehOutstanding,
        'insurance_amount' => $insuranceAmount,
        'insurance_outstanding' => $insuranceOutstanding,
        'iloe_fine' => $iloeFine,
        'iloe_fine_outstanding' => $iloeFineOutstanding,
        'fine_amount' => $totalFine,
        'fine_outstanding' => $fineOutstanding,
        'custom_charges' => $customChargesList,
        'custom_charges_total' => $customChargesTotal,
        'custom_charges_outstanding' => $customChargesOutstanding,
        'total_outstanding' => $totalOutstanding,
        'total_paid' => $totalPaid,
        'currency_name' => $residence['sale_currency_name']
    ];
    
    JWTHelper::sendResponse(200, true, 'Success', $breakdown);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

