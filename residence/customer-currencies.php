<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Customer Currencies API
 * Endpoint: /api/residence/customer-currencies.php
 * Returns currencies for a customer/passenger combination
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$customerID = isset($_POST['customerID']) ? (int)$_POST['customerID'] : 0;
$passengerName = isset($_POST['passengerName']) ? trim($_POST['passengerName']) : 'null';

if ($customerID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID is required');
}

try {
    $passengerNameLower = str_replace(' ', '', strtolower($passengerName));
    
    if ($passengerName && $passengerName !== 'null') {
        $sql = "SELECT DISTINCT currency.currencyID, currency.currencyName 
                FROM currency 
                INNER JOIN residence ON residence.saleCurID = currency.currencyID 
                WHERE residence.customer_id = :customerID 
                AND REPLACE(LOWER(passenger_name), ' ', '') = :passengerName 
                AND residence.deleted = 0
                ORDER BY currency.currencyName ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':passengerName', $passengerNameLower);
    } else {
        $sql = "SELECT DISTINCT currency.currencyID, currency.currencyName 
                FROM currency 
                INNER JOIN residence ON residence.saleCurID = currency.currencyID 
                WHERE residence.customer_id = :customerID 
                AND residence.deleted = 0
                ORDER BY currency.currencyName ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
    }
    
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Currencies retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Customer Currencies API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving currencies: ' . $e->getMessage());
}




