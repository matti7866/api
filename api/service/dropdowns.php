<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

try {
    // Database connection already available from connection.php as $pdo
    
    // Get customers
    $sql = "SELECT customer_id, CONCAT(customer_name, ' -- ', customer_phone) as customer_name FROM `customer` ORDER BY customer_name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get service types
    $sql = "SELECT serviceID, serviceName FROM `service` ORDER BY serviceName";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get suppliers
    $sql = "SELECT supp_id, supp_name FROM `supplier` ORDER BY supp_name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get currencies
    $sql = "SELECT currencyID, currencyName FROM `currency` ORDER BY currencyName";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get accounts
    $sql = "SELECT account_ID, account_Name FROM `accounts` ORDER BY account_Name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => [
            'customers' => $customers,
            'services' => $services,
            'suppliers' => $suppliers,
            'currencies' => $currencies,
            'accounts' => $accounts
        ]
    ]);
    
} catch (Exception $e) {
    error_log('Service Dropdowns API Error: ' . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}


