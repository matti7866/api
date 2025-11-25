<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Get Single Asset Details
 * Endpoint: /api/assets/get.php?id={asset_id}
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
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
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

// Get asset ID
$assetId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$assetId) {
    JWTHelper::sendResponse(400, false, 'Asset ID is required');
}

try {
    // Get asset details
    $sql = "SELECT 
                a.*,
                at.type_name as asset_type_name,
                at.type_icon,
                c1.currencyName as purchase_currency,
                c1.currencyName as purchase_currency_symbol,
                s.staff_name as created_by_name
            FROM assets a
            LEFT JOIN asset_types at ON a.asset_type_id = at.type_id
            LEFT JOIN currency c1 ON a.purchase_currency_id = c1.currencyID
            LEFT JOIN staff s ON a.created_by = s.staff_id
            WHERE a.asset_id = :asset_id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':asset_id', $assetId);
    $stmt->execute();
    
    $asset = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$asset) {
        JWTHelper::sendResponse(404, false, 'Asset not found');
    }
    
    // Get documents
    $docSql = "SELECT * FROM asset_documents WHERE asset_id = :asset_id ORDER BY upload_date DESC";
    $docStmt = $pdo->prepare($docSql);
    $docStmt->bindParam(':asset_id', $assetId);
    $docStmt->execute();
    $asset['documents'] = $docStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get maintenance records
    $maintSql = "SELECT 
                    m.*,
                    c.currencyName as currency,
                    c.currencyName as currency_symbol,
                    s.staff_name as created_by_name
                 FROM asset_maintenance m
                 LEFT JOIN currency c ON m.currency_id = c.currencyID
                 LEFT JOIN staff s ON m.created_by = s.staff_id
                 WHERE m.asset_id = :asset_id 
                 ORDER BY m.maintenance_date DESC";
    $maintStmt = $pdo->prepare($maintSql);
    $maintStmt->bindParam(':asset_id', $assetId);
    $maintStmt->execute();
    $asset['maintenance_records'] = $maintStmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Asset retrieved successfully', $asset);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error retrieving asset: ' . $e->getMessage());
}

