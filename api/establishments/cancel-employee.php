<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Cancel Employee API
 * Endpoint: /api/establishments/cancel-employee.php
 * Cancels an employee (residence)
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
    $sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND (page_name = 'Establishments' OR page_name = 'Establishment' OR page_name = 'Company')";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($permission && $permission['update'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    error_log('Permission check error: ' . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$residenceID = isset($_POST['residenceID']) ? (int)$_POST['residenceID'] : 0;

if ($residenceID == 0) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    // Update residence to cancelled
    $stmt = $pdo->prepare("UPDATE residence SET cancelled = 1 WHERE residenceID = :residenceID");
    $stmt->execute(['residenceID' => $residenceID]);
    
    JWTHelper::sendResponse(200, true, 'Employee cancelled successfully');
} catch (Exception $e) {
    error_log('Cancel Employee API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error cancelling employee: ' . $e->getMessage());
}




