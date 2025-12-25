<?php
/**
 * Get Customer Wallet Balance
 * Endpoint: /api/wallet/get-balance.php
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

if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

try {
    // Get customer wallet balance
    $stmt = $pdo->prepare("
        SELECT 
            c.customer_id,
            c.customer_name,
            c.wallet_balance,
            COUNT(DISTINCT cwt.transaction_id) as total_transactions,
            MAX(cwt.datetime) as last_transaction_date
        FROM customer c
        LEFT JOIN customer_wallet_transactions cwt ON c.customer_id = cwt.customer_id
        WHERE c.customer_id = :customerID
        GROUP BY c.customer_id, c.customer_name, c.wallet_balance
    ");
    
    $stmt->bindParam(':customerID', $customerID);
    $stmt->execute();
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$data) {
        JWTHelper::sendResponse(404, false, 'Customer not found');
    }
    
    // Format response
    $response = [
        'customer_id' => (int)$data['customer_id'],
        'customer_name' => $data['customer_name'],
        'wallet_balance' => (float)$data['wallet_balance'],
        'total_transactions' => (int)$data['total_transactions'],
        'last_transaction_date' => $data['last_transaction_date']
    ];
    
    JWTHelper::sendResponse(200, true, 'Wallet balance retrieved successfully', $response);
    
} catch (Exception $e) {
    error_log('Get Wallet Balance Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving wallet balance: ' . $e->getMessage());
}


