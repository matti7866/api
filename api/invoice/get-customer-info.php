<?php
/**
 * Get Customer Info API
 * Endpoint: /api/invoice/get-customer-info.php
 * Returns customer information
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$customerID = isset($_POST['ID']) ? (int)$_POST['ID'] : 0;

if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

try {
    $sql = "SELECT customer_name, customer_phone, customer_email FROM `customer` WHERE customer_id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':id', $customerID);
    $stmt->execute();
    $customer = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Customer info retrieved successfully', ['data' => $customer]);
} catch (Exception $e) {
    error_log('Get Customer Info API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving customer info: ' . $e->getMessage());
}



