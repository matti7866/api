<?php
/**
 * Pay from Wallet for Residence/Visa/Ticket
 * Endpoint: /api/wallet/pay-from-wallet.php
 * Withdraws from wallet and records payment in respective system
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/WalletHelper.php';

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

$customerID = isset($request['customerID']) ? (int)$request['customerID'] : 0;
$amount = isset($request['amount']) ? (float)$request['amount'] : 0;
$referenceType = isset($request['referenceType']) ? $request['referenceType'] : ''; // 'residence', 'visa', 'ticket', etc.
$referenceID = isset($request['referenceID']) ? (int)$request['referenceID'] : 0;
$currencyID = isset($request['currencyID']) ? (int)$request['currencyID'] : 1;
$remarks = isset($request['remarks']) ? trim($request['remarks']) : '';

// Validation
if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

if ($amount <= 0) {
    JWTHelper::sendResponse(400, false, 'Amount must be greater than zero');
}

if (empty($referenceType) || $referenceID == 0) {
    JWTHelper::sendResponse(400, false, 'Reference type and ID are required');
}

if (!in_array($referenceType, ['residence', 'visa', 'ticket', 'family_residence'])) {
    JWTHelper::sendResponse(400, false, 'Invalid reference type');
}

try {
    // Start transaction
    $pdo->beginTransaction();
    
    // Get current wallet balance
    $stmt = $pdo->prepare("SELECT wallet_balance, customer_name, wallet_account_number FROM customer WHERE customer_id = :customerID FOR UPDATE");
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$customer) {
        $pdo->rollBack();
        JWTHelper::sendResponse(404, false, 'Customer not found');
    }
    
    $balanceBefore = (float)$customer['wallet_balance'];
    
    // Check if sufficient balance
    if ($balanceBefore < $amount) {
        $pdo->rollBack();
        JWTHelper::sendResponse(400, false, 'Insufficient wallet balance. Available: ' . $balanceBefore . ' AED');
    }
    
    // Ensure wallet account number exists
    $walletAccountNumber = $customer['wallet_account_number'];
    if (empty($walletAccountNumber)) {
        $walletAccountNumber = WalletHelper::generateWalletAccountNumber($pdo, $customerID);
    }
    
    $balanceAfter = $balanceBefore - $amount;
    
    // Update customer wallet balance
    $stmt = $pdo->prepare("UPDATE customer SET wallet_balance = :newBalance WHERE customer_id = :customerID");
    $stmt->bindParam(':newBalance', $balanceAfter);
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    
    // Record wallet transaction (without account_id since it's internal wallet payment)
    $stmt = $pdo->prepare("
        INSERT INTO customer_wallet_transactions 
        (customer_id, transaction_type, amount, currency_id, balance_before, balance_after, staff_id, reference_type, reference_id, remarks)
        VALUES 
        (:customerID, 'payment', :amount, :currencyID, :balanceBefore, :balanceAfter, :staffID, :referenceType, :referenceID, :remarks)
    ");
    
    $staffID = $userData['staff_id'] ?? $userData['user_id'] ?? $userData['id'] ?? 1;
    
    $stmt->bindParam(':customerID', $customerID);
    $stmt->bindParam(':amount', $amount);
    $stmt->bindParam(':currencyID', $currencyID);
    $stmt->bindParam(':balanceBefore', $balanceBefore);
    $stmt->bindParam(':balanceAfter', $balanceAfter);
    $stmt->bindParam(':staffID', $staffID);
    $stmt->bindParam(':referenceType', $referenceType);
    $stmt->bindParam(':referenceID', $referenceID);
    $stmt->bindParam(':remarks', $remarks);
    $stmt->execute();
    
    $walletTransactionID = $pdo->lastInsertId();
    
    // Commit transaction
    $pdo->commit();
    
    $response = [
        'wallet_transaction_id' => $walletTransactionID,
        'customer_id' => $customerID,
        'customer_name' => $customer['customer_name'],
        'wallet_account_number' => $walletAccountNumber,
        'amount' => $amount,
        'balance_before' => $balanceBefore,
        'balance_after' => $balanceAfter,
        'reference_type' => $referenceType,
        'reference_id' => $referenceID
    ];
    
    JWTHelper::sendResponse(200, true, 'Payment from wallet processed successfully', $response);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Wallet Payment Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error processing wallet payment: ' . $e->getMessage());
}


