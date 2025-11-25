<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Create New Asset
 * Endpoint: /api/assets/create.php
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
    $sql = "SELECT permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['insert'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($data['asset_name']) || !isset($data['asset_type_id'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: asset_name and asset_type_id');
}

try {
    $sql = "INSERT INTO assets (
                asset_name,
                asset_type_id,
                purchase_date,
                purchase_price,
                purchase_currency_id,
                current_value,
                depreciation_rate,
                description,
                location,
                serial_number,
                registration_number,
                brand,
                model,
                year,
                `condition`,
                status,
                notes,
                created_by
            ) VALUES (
                :asset_name,
                :asset_type_id,
                :purchase_date,
                :purchase_price,
                :purchase_currency_id,
                :current_value,
                :depreciation_rate,
                :description,
                :location,
                :serial_number,
                :registration_number,
                :brand,
                :model,
                :year,
                :condition,
                :status,
                :notes,
                :created_by
            )";
    
    $stmt = $pdo->prepare($sql);
    
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
    $stmt->bindValue(':notes', isset($data['notes']) ? $data['notes'] : null);
    $stmt->bindValue(':created_by', $userData['staff_id']);
    
    $stmt->execute();
    
    $assetId = $pdo->lastInsertId();
    
    JWTHelper::sendResponse(200, true, 'Asset created successfully', [
        'asset_id' => $assetId
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error creating asset: ' . $e->getMessage());
}

