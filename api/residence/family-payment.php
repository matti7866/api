<?php
/**
 * Family Residence Payment API
 * Endpoint: /api/residence/family-payment.php
 * Processes payments for family residence records
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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$familyResidenceID = isset($input['familyResidenceID']) ? (int)$input['familyResidenceID'] : 0;
$paymentAmount = isset($input['paymentAmount']) ? (float)$input['paymentAmount'] : 0;
$accountID = isset($input['accountID']) ? (int)$input['accountID'] : 0;
$remarks = isset($input['remarks']) ? trim($input['remarks']) : '';

if (!$familyResidenceID || $paymentAmount <= 0 || !$accountID) {
    JWTHelper::sendResponse(400, false, 'Invalid payment data. Family Residence ID, payment amount, and account are required.');
}

try {
    // Verify family residence exists and get customer_id
    $checkStmt = $pdo->prepare("SELECT id, sale_price, customer_id FROM family_residence WHERE id = :id");
    $checkStmt->execute(['id' => $familyResidenceID]);
    $familyResidence = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$familyResidence) {
        JWTHelper::sendResponse(404, false, 'Family residence not found');
    }
    
    $customer_id = (int)$familyResidence['customer_id'];
    if (!$customer_id) {
        JWTHelper::sendResponse(400, false, 'Family residence does not have a valid customer ID');
    }
    
    // Get total paid amount - ONLY count payments where family_res_payment = 1
    $paidStmt = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) as total_paid 
                                FROM customer_payments 
                                WHERE PaymentFor = :id 
                                AND family_res_payment = 1");
    $paidStmt->execute(['id' => $familyResidenceID]);
    $paidResult = $paidStmt->fetch(PDO::FETCH_ASSOC);
    $totalPaid = (float)$paidResult['total_paid'];
    
    $salePrice = (float)$familyResidence['sale_price'];
    $outstanding = $salePrice - $totalPaid;
    
    if ($paymentAmount > $outstanding) {
        JWTHelper::sendResponse(400, false, 'Payment amount cannot exceed outstanding amount of ' . number_format($outstanding, 2));
    }
    
    // Get default currency (AED)
    $currencyStmt = $pdo->prepare("SELECT currencyID FROM currency WHERE currencyName = 'AED' LIMIT 1");
    $currencyStmt->execute();
    $currency = $currencyStmt->fetch(PDO::FETCH_ASSOC);
    $currencyID = $currency ? $currency['currencyID'] : 1;
    
    // Insert payment record
    $insertSql = "INSERT INTO customer_payments 
                  (customer_id, PaymentFor, payment_amount, currencyID, accountID, staff_id, datetime, remarks, family_res_payment) 
                  VALUES (:customer_id, :PaymentFor, :payment_amount, :currencyID, :accountID, :staff_id, NOW(), :remarks, 1)";
    
    $insertStmt = $pdo->prepare($insertSql);
    $insertStmt->execute([
        'customer_id' => $customer_id,
        'PaymentFor' => $familyResidenceID,
        'payment_amount' => $paymentAmount,
        'currencyID' => $currencyID,
        'accountID' => $accountID,
        'staff_id' => $userData['staff_id'] ?? null,
        'remarks' => $remarks ?: 'Family residence payment'
    ]);
    
    $paymentID = $pdo->lastInsertId();
    
    // Calculate new outstanding
    $newPaid = $totalPaid + $paymentAmount;
    $newOutstanding = $salePrice - $newPaid;
    
    JWTHelper::sendResponse(200, true, 'Payment processed successfully', [
        'payment_id' => $paymentID,
        'total_paid' => $newPaid,
        'outstanding' => $newOutstanding
    ]);
    
} catch (Exception $e) {
    error_log('Family Payment API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    JWTHelper::sendResponse(500, false, 'Error processing payment: ' . $e->getMessage());
}

