<?php
/**
 * Add Funds to Customer Wallet
 * Endpoint: /api/wallet/add-funds.php
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
$currencyID = isset($request['currencyID']) ? (int)$request['currencyID'] : 1;
$accountID = isset($request['accountID']) ? (int)$request['accountID'] : 0;
$remarks = isset($request['remarks']) ? trim($request['remarks']) : '';
$transactionType = isset($request['transactionType']) ? $request['transactionType'] : 'deposit';

// Validation
if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

if ($amount <= 0) {
    JWTHelper::sendResponse(400, false, 'Amount must be greater than zero');
}

if ($accountID == 0) {
    JWTHelper::sendResponse(400, false, 'Account ID is required');
}

if (!in_array($transactionType, ['deposit', 'refund'])) {
    JWTHelper::sendResponse(400, false, 'Invalid transaction type. Must be "deposit" or "refund"');
}

try {
    // Start transaction
    $pdo->beginTransaction();
    
    // Get current wallet balance and ensure wallet account number exists
    $stmt = $pdo->prepare("SELECT wallet_balance, customer_name, wallet_account_number FROM customer WHERE customer_id = :customerID FOR UPDATE");
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$customer) {
        $pdo->rollBack();
        JWTHelper::sendResponse(404, false, 'Customer not found');
    }
    
    // Generate wallet account number if it doesn't exist
    $walletAccountNumber = $customer['wallet_account_number'];
    if (empty($walletAccountNumber)) {
        $walletAccountNumber = WalletHelper::generateWalletAccountNumber($pdo, $customerID);
    }
    
    $balanceBefore = (float)$customer['wallet_balance'];
    $balanceAfter = $balanceBefore + $amount;
    
    // Update customer wallet balance
    $stmt = $pdo->prepare("UPDATE customer SET wallet_balance = :newBalance WHERE customer_id = :customerID");
    $stmt->bindParam(':newBalance', $balanceAfter);
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    
    // Record transaction
    $stmt = $pdo->prepare("
        INSERT INTO customer_wallet_transactions 
        (customer_id, transaction_type, amount, currency_id, balance_before, balance_after, staff_id, account_id, remarks)
        VALUES 
        (:customerID, :transactionType, :amount, :currencyID, :balanceBefore, :balanceAfter, :staffID, :accountID, :remarks)
    ");
    
    // Get staff_id from userData (try multiple possible field names)
    $staffID = $userData['staff_id'] ?? $userData['user_id'] ?? $userData['id'] ?? 1;
    
    $stmt->bindParam(':customerID', $customerID);
    $stmt->bindParam(':transactionType', $transactionType);
    $stmt->bindParam(':amount', $amount);
    $stmt->bindParam(':currencyID', $currencyID);
    $stmt->bindParam(':balanceBefore', $balanceBefore);
    $stmt->bindParam(':balanceAfter', $balanceAfter);
    $stmt->bindParam(':staffID', $staffID);
    $stmt->bindParam(':accountID', $accountID);
    $stmt->bindParam(':remarks', $remarks);
    $stmt->execute();
    
    $transactionID = $pdo->lastInsertId();
    
    // Commit transaction
    $pdo->commit();
    
    $response = [
        'transaction_id' => $transactionID,
        'customer_id' => $customerID,
        'customer_name' => $customer['customer_name'],
        'wallet_account_number' => $walletAccountNumber,
        'transaction_type' => $transactionType,
        'amount' => $amount,
        'balance_before' => $balanceBefore,
        'balance_after' => $balanceAfter,
        'currency_id' => $currencyID,
        'account_id' => $accountID
    ];
    
    JWTHelper::sendResponse(200, true, 'Funds added successfully', $response);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Add Funds Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error adding funds: ' . $e->getMessage());
}

