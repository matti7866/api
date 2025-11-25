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

// Verify JWT token first
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    $type = $_GET['type'] ?? 'all';
    
    // Handle comma-separated types
    $types = [];
    if ($type === 'all') {
        $types = ['customers', 'suppliers', 'accounts', 'currencies', 'staff'];
    } else {
        $types = array_map('trim', explode(',', $type));
    }
    
    $data = [];
    
    // Get customers
    if (in_array('customers', $types)) {
        $stmt = $pdo->prepare("SELECT customer_id, customer_name FROM customer ORDER BY customer_name ASC");
        $stmt->execute();
        $data['customers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get suppliers
    if (in_array('suppliers', $types)) {
        $stmt = $pdo->prepare("SELECT supp_id, supp_name FROM supplier ORDER BY supp_name ASC");
        $stmt->execute();
        $data['suppliers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get accounts
    if (in_array('accounts', $types)) {
        $stmt = $pdo->prepare("SELECT account_ID, account_Name FROM accounts ORDER BY account_Name ASC");
        $stmt->execute();
        $data['accounts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get currencies
    if (in_array('currencies', $types)) {
        $stmt = $pdo->prepare("SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC");
        $stmt->execute();
        $data['currencies'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Get staff
    if (in_array('staff', $types)) {
        $stmt = $pdo->prepare("SELECT staff_id, staff_name FROM staff ORDER BY staff_name ASC");
        $stmt->execute();
        $data['staff'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => $data
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

