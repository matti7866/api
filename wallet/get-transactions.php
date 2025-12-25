<?php
/**
 * Get Customer Wallet Transaction History
 * Endpoint: /api/wallet/get-transactions.php
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

$customerID = isset($request['customerID']) ? (int)$request['customerID'] : 0;
$page = isset($request['page']) ? max(1, (int)$request['page']) : 1;
$limit = isset($request['limit']) ? min(100, max(1, (int)$request['limit'])) : 20;
$offset = ($page - 1) * $limit;

if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

try {
    // Get total count
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total
        FROM customer_wallet_transactions
        WHERE customer_id = :customerID
    ");
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    $totalRecords = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalRecords / $limit);
    
    // Get transactions
    $stmt = $pdo->prepare("
        SELECT 
            cwt.transaction_id,
            cwt.customer_id,
            cwt.transaction_type,
            cwt.amount,
            cwt.currency_id,
            curr.currencyName,
            cwt.balance_before,
            cwt.balance_after,
            cwt.reference_type,
            cwt.reference_id,
            cwt.payment_id,
            cwt.staff_id,
            s.staff_name,
            cwt.account_id,
            acc.account_Name as account_name,
            cwt.remarks,
            cwt.datetime
        FROM customer_wallet_transactions cwt
        LEFT JOIN currency curr ON cwt.currency_id = curr.currencyID
        LEFT JOIN staff s ON cwt.staff_id = s.staff_id
        LEFT JOIN accounts acc ON cwt.account_id = acc.account_ID
        WHERE cwt.customer_id = :customerID
        ORDER BY cwt.datetime DESC, cwt.transaction_id DESC
        LIMIT :limit OFFSET :offset
    ");
    
    $stmt->bindParam(':customerID', $customerID, PDO::PARAM_INT);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindParam(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format transactions
    $formattedTransactions = array_map(function($t) {
        return [
            'transaction_id' => (int)$t['transaction_id'],
            'customer_id' => (int)$t['customer_id'],
            'transaction_type' => $t['transaction_type'],
            'amount' => (float)$t['amount'],
            'currency_id' => (int)$t['currency_id'],
            'currency_name' => $t['currencyName'],
            'currency_symbol' => 'AED', // Default to AED since currency table doesn't have symbol
            'balance_before' => (float)$t['balance_before'],
            'balance_after' => (float)$t['balance_after'],
            'reference_type' => $t['reference_type'],
            'reference_id' => $t['reference_id'] ? (int)$t['reference_id'] : null,
            'payment_id' => $t['payment_id'] ? (int)$t['payment_id'] : null,
            'staff_id' => (int)$t['staff_id'],
            'staff_name' => $t['staff_name'],
            'account_id' => $t['account_id'] ? (int)$t['account_id'] : null,
            'account_name' => $t['account_name'],
            'remarks' => $t['remarks'],
            'datetime' => $t['datetime']
        ];
    }, $transactions);
    
    $response = [
        'data' => $formattedTransactions,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => (int)$totalRecords,
            'recordsPerPage' => $limit,
            'hasNextPage' => $page < $totalPages,
            'hasPreviousPage' => $page > 1
        ]
    ];
    
    JWTHelper::sendResponse(200, true, 'Transaction history retrieved successfully', $response);
    
} catch (Exception $e) {
    error_log('Get Wallet Transactions Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving transaction history: ' . $e->getMessage());
}

