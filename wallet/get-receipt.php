<?php
/**
 * Get Wallet Receipt
 * Endpoint: /api/wallet/get-receipt.php
 * Returns detailed information for a wallet transaction receipt
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

// Get request data
$request = $_SERVER['REQUEST_METHOD'] === 'POST' 
    ? json_decode(file_get_contents('php://input'), true) 
    : $_GET;

$transactionID = isset($request['transaction_id']) ? (int)$request['transaction_id'] : 0;

// Log the request for debugging
error_log('Wallet Receipt Request - transaction_id: ' . $transactionID);

if (!$transactionID) {
    error_log('Wallet Receipt Error: No transaction ID provided');
    JWTHelper::sendResponse(400, false, 'Transaction ID is required');
}

try {
    // Get transaction details with customer, account, and staff information
    $sql = "SELECT 
        cwt.transaction_id,
        cwt.customer_id,
        c.customer_name,
        c.wallet_account_number,
        cwt.transaction_type,
        cwt.amount,
        cur.currencyName as currency_name,
        cwt.balance_before,
        cwt.balance_after,
        a.account_Name as account_name,
        s.staff_name,
        cwt.remarks,
        cwt.datetime
    FROM customer_wallet_transactions cwt
    INNER JOIN customer c ON cwt.customer_id = c.customer_id
    LEFT JOIN currency cur ON cwt.currency_id = cur.currencyID
    LEFT JOIN accounts a ON cwt.account_id = a.account_ID
    LEFT JOIN staff s ON cwt.staff_id = s.staff_id
    WHERE cwt.transaction_id = :transactionID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':transactionID', $transactionID, PDO::PARAM_INT);
    $stmt->execute();
    
    $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$transaction) {
        error_log('Wallet Receipt Error: Transaction not found for ID: ' . $transactionID);
        JWTHelper::sendResponse(404, false, 'Transaction not found (ID: ' . $transactionID . ')');
    }
    
    error_log('Wallet Receipt: Successfully found transaction ID: ' . $transactionID);
    
    // Format the transaction data
    $formattedTransaction = [
        'transaction_id' => (int)$transaction['transaction_id'],
        'customer_id' => (int)$transaction['customer_id'],
        'customer_name' => $transaction['customer_name'],
        'wallet_account_number' => $transaction['wallet_account_number'],
        'transaction_type' => $transaction['transaction_type'],
        'amount' => (float)$transaction['amount'],
        'currency_name' => $transaction['currency_name'] ?? 'AED',
        'currency_symbol' => 'AED', // Currency table doesn't have symbol column, default to AED
        'balance_before' => (float)$transaction['balance_before'],
        'balance_after' => (float)$transaction['balance_after'],
        'account_name' => $transaction['account_name'] ?? 'N/A',
        'staff_name' => $transaction['staff_name'] ?? 'System',
        'remarks' => $transaction['remarks'],
        'datetime' => $transaction['datetime']
    ];
    
    JWTHelper::sendResponse(200, true, 'Transaction retrieved successfully', $formattedTransaction);
    
} catch (Exception $e) {
    error_log('Get Wallet Receipt Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving receipt: ' . $e->getMessage());
}

