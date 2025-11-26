<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../connection/index.php';
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
    // Get database connection
    // Database connection already available as $pdo from connection.php
    
    // Get customers
    $sql = "SELECT customer_id, customer_name FROM `customer` ORDER BY customer_name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get amer types
    $sql = "SELECT * FROM `amer_types` ORDER BY name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $types = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get accounts
    $sql = "SELECT account_ID, account_Name FROM `accounts` ORDER BY account_Name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get staff
    $sql = "SELECT staff_id, staff_name FROM `staff` ORDER BY staff_name";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => [
            'customers' => $customers,
            'types' => $types,
            'accounts' => $accounts,
            'staff' => $staff
        ]
    ]);
    
} catch (Exception $e) {
    error_log('Dropdowns API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

