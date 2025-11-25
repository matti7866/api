<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Delete Residence Fine
 * Endpoint: /api/residence/delete-fine.php
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
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['update'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['residenceFineID'])) {
    JWTHelper::sendResponse(400, false, 'Missing required field: residenceFineID');
}

$residenceFineID = (int)$data['residenceFineID'];

try {
    // Verify fine exists and get file info
    $sql = "SELECT docName FROM residencefine WHERE residenceFineID = :residenceFineID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceFineID', $residenceFineID);
    $stmt->execute();
    $fine = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$fine) {
        JWTHelper::sendResponse(404, false, 'Fine record not found');
    }
    
    // Delete file if exists
    if ($fine['docName'] && file_exists($fine['docName'])) {
        unlink($fine['docName']);
    }
    
    // Delete fine record
    $sql = "DELETE FROM residencefine WHERE residenceFineID = :residenceFineID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceFineID', $residenceFineID);
    $stmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Fine deleted successfully');
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error deleting fine: ' . $e->getMessage());
}









