<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Delete Asset
 * Endpoint: /api/assets/delete.php
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

// Restrict access to staff_id = 1 only
if (!isset($userData['staff_id']) || $userData['staff_id'] != 1) {
    JWTHelper::sendResponse(403, false, 'Access denied. This module is restricted to administrators only.');
}

// Check permission
try {
    $sql = "SELECT permission.delete FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
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

// Get asset ID
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['asset_id'])) {
    JWTHelper::sendResponse(400, false, 'Missing required field: asset_id');
}

$assetId = (int)$data['asset_id'];

try {
    // Check if asset exists
    $checkSql = "SELECT asset_id FROM assets WHERE asset_id = :asset_id";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->bindParam(':asset_id', $assetId);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Asset not found');
    }
    
    // Delete asset (cascade will handle documents and maintenance records)
    $sql = "DELETE FROM assets WHERE asset_id = :asset_id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':asset_id', $assetId);
    $stmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Asset deleted successfully');
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error deleting asset: ' . $e->getMessage());
}

