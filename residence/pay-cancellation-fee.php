<?php
/**
 * Pay Cancellation Fee
 * Endpoint: /api/residence/pay-cancellation-fee.php
 * Supports payment from account or wallet
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../wallet/WalletHelper.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

// Get request data
$request = json_decode(file_get_contents('php://input'), true);

$residenceID = isset($request['residenceID']) ? (int)$request['residenceID'] : 0;
$amount = isset($request['amount']) ? (float)$request['amount'] : 0;
$accountID = isset($request['accountID']) ? (int)$request['accountID'] : 0;
$paymentMethod = isset($request['paymentMethod']) ? $request['paymentMethod'] : 'account';
$remarks = isset($request['remarks']) ? trim($request['remarks']) : '';

// Validation
if ($residenceID == 0) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

if ($amount <= 0) {
    JWTHelper::sendResponse(400, false, 'Amount must be greater than zero');
}

if ($paymentMethod === 'account' && $accountID == 0) {
    JWTHelper::sendResponse(400, false, 'Account ID is required for account payment');
}

try {
    // Start transaction
    $pdo->beginTransaction();
    
    // Get residence and customer details
    $stmt = $pdo->prepare("SELECT customer_id, cancellation_cost FROM residence WHERE residenceID = :residenceID");
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        $pdo->rollBack();
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    $customerID = $residence['customer_id'];
    $staffID = $userData['staff_id'] ?? $userData['user_id'] ?? $userData['id'] ?? 1;
    
    if ($paymentMethod === 'wallet') {
        // Pay from wallet
        $stmt = $pdo->prepare("SELECT wallet_balance, wallet_account_number FROM customer WHERE customer_id = :customerID FOR UPDATE");
        $stmt->bindParam(':customerID', $customerID);
        $stmt->execute();
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $walletBalance = (float)($customer['wallet_balance'] ?? 0);
        
        if ($walletBalance < $amount) {
            $pdo->rollBack();
            JWTHelper::sendResponse(400, false, 'Insufficient wallet balance. Available: ' . $walletBalance . ' AED');
        }
        
        // Ensure wallet account number
        $walletAccountNumber = $customer['wallet_account_number'];
        if (empty($walletAccountNumber)) {
            $walletAccountNumber = WalletHelper::generateWalletAccountNumber($pdo, $customerID);
        }
        
        // Deduct from wallet
        $newBalance = $walletBalance - $amount;
        $stmt = $pdo->prepare("UPDATE customer SET wallet_balance = :newBalance WHERE customer_id = :customerID");
        $stmt->bindParam(':newBalance', $newBalance);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->execute();
        
        // Record wallet transaction
        $stmt = $pdo->prepare("
            INSERT INTO customer_wallet_transactions 
            (customer_id, transaction_type, amount, currency_id, balance_before, balance_after, staff_id, reference_type, reference_id, remarks)
            VALUES 
            (:customerID, 'payment', :amount, 1, :balanceBefore, :balanceAfter, :staffID, 'residence_cancellation', :residenceID, :remarks)
        ");
        
        $walletRemarks = "Cancellation fee payment for Residence #" . $residenceID . ($remarks ? " - " . $remarks : "");
        
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':balanceBefore', $walletBalance);
        $stmt->bindParam(':balanceAfter', $newBalance);
        $stmt->bindParam(':staffID', $staffID);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->bindParam(':remarks', $walletRemarks);
        $stmt->execute();
    }
    
    // Record payment in customer_payments table (for tracking purposes)
    $stmt = $pdo->prepare("
        INSERT INTO customer_payments 
        (customer_id, payment_amount, currencyID, accountID, staff_id, remarks, residenceCancelPayment)
        VALUES 
        (:customerID, :amount, 1, :accountID, :staffID, :remarks, :residenceID)
    ");
    
    // For wallet payments, use special wallet payments account
    if ($paymentMethod === 'wallet') {
        $walletAccountStmt = $pdo->query("SELECT account_ID FROM accounts WHERE account_Name = 'Customer Wallet Payments' LIMIT 1");
        $walletAccount = $walletAccountStmt->fetch(PDO::FETCH_ASSOC);
        $paymentAccountID = $walletAccount ? $walletAccount['account_ID'] : 38; // Fallback to 38
    } else {
        $paymentAccountID = $accountID;
    }
    $paymentRemarks = $paymentMethod === 'wallet' ? 'Paid from Wallet - ' . $remarks : $remarks;
    
    $stmt->bindParam(':customerID', $customerID);
    $stmt->bindParam(':amount', $amount);
    $stmt->bindParam(':accountID', $paymentAccountID);
    $stmt->bindParam(':staffID', $staffID);
    $stmt->bindParam(':remarks', $paymentRemarks);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Cancellation fee payment processed successfully', [
        'payment_method' => $paymentMethod,
        'amount' => $amount,
        'residence_id' => $residenceID
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Pay Cancellation Fee Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error processing cancellation fee payment: ' . $e->getMessage());
}

