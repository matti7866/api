<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Delete Residence Custom Charge
 * Endpoint: /api/residence/delete-custom-charge.php
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
    $sql = "SELECT permission.delete FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['delete'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['chargeID'])) {
    JWTHelper::sendResponse(400, false, 'Missing required field: chargeID');
}

$chargeID = (int)$data['chargeID'];

try {
    // Verify charge exists
    $checkQuery = $pdo->prepare("SELECT id FROM residence_custom_charges WHERE id = :charge_id");
    $checkQuery->bindParam(':charge_id', $chargeID);
    $checkQuery->execute();
    
    if ($checkQuery->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Custom charge not found');
    }
    
    // Delete the custom charge
    $pdo->beginTransaction();
    
    $deleteSQL = "DELETE FROM residence_custom_charges WHERE id = :charge_id";
    $stmt = $pdo->prepare($deleteSQL);
    $stmt->bindParam(':charge_id', $chargeID);
    $stmt->execute();
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Custom charge deleted successfully');
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("DeleteCustomCharge Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error deleting custom charge: ' . $e->getMessage());
}







