<?php
/**
 * Get Customers for Wallet Management
 * Endpoint: /api/wallet/get-customers.php
 * Returns list of customers with wallet balances
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

$page = isset($request['page']) ? max(1, (int)$request['page']) : 1;
$limit = isset($request['limit']) ? min(100, max(1, (int)$request['limit'])) : 20;
$offset = ($page - 1) * $limit;
$search = isset($request['search']) ? trim($request['search']) : '';

try {
    // Build WHERE clause
    $whereClause = "WHERE 1=1";
    $params = [];
    
    if (!empty($search)) {
        $whereClause .= " AND (
            c.customer_name LIKE :search 
            OR c.customer_email LIKE :search 
            OR c.customer_phone LIKE :search
            OR c.customer_whatsapp LIKE :search
        )";
        $params[':search'] = '%' . $search . '%';
    }
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM customer c $whereClause";
    $stmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $totalRecords = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalRecords / $limit);
    
    // Get customers with wallet information
    $sql = "SELECT 
        c.customer_id,
        c.customer_name,
        c.customer_email,
        c.customer_phone,
        c.customer_whatsapp,
        c.wallet_account_number,
        IFNULL(c.wallet_balance, 0) as wallet_balance,
        COUNT(DISTINCT cwt.transaction_id) as total_transactions,
        MAX(cwt.datetime) as last_transaction_date
    FROM customer c
    LEFT JOIN customer_wallet_transactions cwt ON c.customer_id = cwt.customer_id
    $whereClause
    GROUP BY c.customer_id, c.customer_name, c.customer_email, c.customer_phone, c.customer_whatsapp, c.wallet_account_number, c.wallet_balance
    ORDER BY c.customer_name ASC
    LIMIT :limit OFFSET :offset";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format data
    $formattedCustomers = array_map(function($c) {
        return [
            'customer_id' => (int)$c['customer_id'],
            'customer_name' => $c['customer_name'],
            'customer_email' => $c['customer_email'],
            'customer_phone' => $c['customer_phone'],
            'customer_whatsapp' => $c['customer_whatsapp'],
            'wallet_account_number' => $c['wallet_account_number'],
            'wallet_balance' => (float)$c['wallet_balance'],
            'total_transactions' => (int)$c['total_transactions'],
            'last_transaction_date' => $c['last_transaction_date']
        ];
    }, $customers);
    
    JWTHelper::sendResponse(200, true, 'Customers retrieved successfully', [
        'data' => $formattedCustomers,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => (int)$totalRecords,
            'recordsPerPage' => $limit,
            'hasNextPage' => $page < $totalPages,
            'hasPreviousPage' => $page > 1
        ]
    ]);
    
} catch (Exception $e) {
    error_log('Get Wallet Customers Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving customers: ' . $e->getMessage());
}

