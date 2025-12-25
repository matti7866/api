<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Update Asset
 * Endpoint: /api/assets/update.php
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
    $sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
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

// Validate required fields
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
    
    $sql = "UPDATE assets SET
                asset_name = :asset_name,
                asset_type_id = :asset_type_id,
                purchase_date = :purchase_date,
                purchase_price = :purchase_price,
                purchase_currency_id = :purchase_currency_id,
                current_value = :current_value,
                depreciation_rate = :depreciation_rate,
                description = :description,
                location = :location,
                serial_number = :serial_number,
                registration_number = :registration_number,
                brand = :brand,
                model = :model,
                year = :year,
                `condition` = :condition,
                status = :status,
                sold_date = :sold_date,
                sold_price = :sold_price,
                sold_to = :sold_to,
                notes = :notes
            WHERE asset_id = :asset_id";
    
    $stmt = $pdo->prepare($sql);
    
    $stmt->bindValue(':asset_id', $assetId);
    $stmt->bindValue(':asset_name', $data['asset_name']);
    $stmt->bindValue(':asset_type_id', $data['asset_type_id']);
    $stmt->bindValue(':purchase_date', isset($data['purchase_date']) ? $data['purchase_date'] : null);
    $stmt->bindValue(':purchase_price', isset($data['purchase_price']) ? $data['purchase_price'] : 0);
    $stmt->bindValue(':purchase_currency_id', isset($data['purchase_currency_id']) ? $data['purchase_currency_id'] : 1);
    $stmt->bindValue(':current_value', isset($data['current_value']) ? $data['current_value'] : 0);
    $stmt->bindValue(':depreciation_rate', isset($data['depreciation_rate']) ? $data['depreciation_rate'] : 0);
    $stmt->bindValue(':description', isset($data['description']) ? $data['description'] : null);
    $stmt->bindValue(':location', isset($data['location']) ? $data['location'] : null);
    $stmt->bindValue(':serial_number', isset($data['serial_number']) ? $data['serial_number'] : null);
    $stmt->bindValue(':registration_number', isset($data['registration_number']) ? $data['registration_number'] : null);
    $stmt->bindValue(':brand', isset($data['brand']) ? $data['brand'] : null);
    $stmt->bindValue(':model', isset($data['model']) ? $data['model'] : null);
    $stmt->bindValue(':year', isset($data['year']) ? $data['year'] : null);
    $stmt->bindValue(':condition', isset($data['condition']) ? $data['condition'] : 'good');
    $stmt->bindValue(':status', isset($data['status']) ? $data['status'] : 'active');
    $stmt->bindValue(':sold_date', isset($data['sold_date']) ? $data['sold_date'] : null);
    $stmt->bindValue(':sold_price', isset($data['sold_price']) ? $data['sold_price'] : null);
    $stmt->bindValue(':sold_to', isset($data['sold_to']) ? $data['sold_to'] : null);
    $stmt->bindValue(':notes', isset($data['notes']) ? $data['notes'] : null);
    
    $stmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Asset updated successfully');
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error updating asset: ' . $e->getMessage());
}

