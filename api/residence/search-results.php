<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Residence Report Search Results API
 * Endpoint: /api/residence/search-results.php
 * Returns customer and passenger matches for search
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

$searchTerm = isset($_POST['searchTerm']) ? trim($_POST['searchTerm']) : '';

if (empty($searchTerm) || strlen($searchTerm) < 2) {
    JWTHelper::sendResponse(200, true, 'Search term too short', ['data' => []]);
}

try {
    $searchPattern = '%' . str_replace(' ', '', strtolower($searchTerm)) . '%';
    
    $sql = "SELECT 1 AS identifier, customer_id AS customer_id, customer_name AS customer_name, '' AS passenger_name 
            FROM customer 
            WHERE REPLACE(LOWER(customer_name), ' ', '') LIKE :searchTerm 
            UNION ALL 
            SELECT DISTINCT 2 AS identifier, customer.customer_id AS customer_id, customer_name AS customer_name, 
                   passenger_name AS passenger_name 
            FROM residence 
            INNER JOIN customer ON customer.customer_id = residence.customer_id 
            WHERE REPLACE(LOWER(passenger_name), ' ', '') LIKE :searchTerm 
            AND residence.deleted = 0
            LIMIT 20";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':searchTerm', $searchPattern);
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Search results retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Residence Search API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving search results: ' . $e->getMessage());
}




