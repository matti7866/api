<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Get Asset Lookups (dropdowns data)
 * Endpoint: /api/assets/lookups.php
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

try {
    // Check if database connection is available
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    // Get asset types
    $assetTypes = [];
    try {
        $typesSql = "SELECT type_id, type_name, type_icon, description 
                     FROM asset_types 
                     WHERE is_active = 1 
                     ORDER BY type_name";
        $typesStmt = $pdo->query($typesSql);
        $assetTypes = $typesStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // If asset_types table doesn't exist, provide default types
        error_log('Asset types table error: ' . $e->getMessage());
        $assetTypes = [
            ['type_id' => 1, 'type_name' => 'Property/Real Estate', 'type_icon' => 'fa-home', 'description' => 'Houses, apartments, land, commercial buildings'],
            ['type_id' => 2, 'type_name' => 'Vehicle', 'type_icon' => 'fa-car', 'description' => 'Cars, trucks, motorcycles, boats'],
            ['type_id' => 3, 'type_name' => 'Office Equipment', 'type_icon' => 'fa-desktop', 'description' => 'Computers, printers, furniture, machinery'],
            ['type_id' => 4, 'type_name' => 'Electronics', 'type_icon' => 'fa-laptop', 'description' => 'Laptops, tablets, phones, cameras'],
            ['type_id' => 5, 'type_name' => 'Furniture', 'type_icon' => 'fa-couch', 'description' => 'Office and home furniture'],
            ['type_id' => 6, 'type_name' => 'Machinery', 'type_icon' => 'fa-cogs', 'description' => 'Industrial machinery and tools'],
            ['type_id' => 7, 'type_name' => 'Other Assets', 'type_icon' => 'fa-cube', 'description' => 'Other miscellaneous assets']
        ];
    }
    
    // Get currencies
    $currencySql = "SELECT currencyID as currency_id, currencyName as short_name, currencyName as symbol, currencyName as full_name 
                    FROM currency 
                    ORDER BY currencyName";
    $currencyStmt = $pdo->query($currencySql);
    $currencies = $currencyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get status options
    $statuses = [
        ['value' => 'active', 'label' => 'Active'],
        ['value' => 'sold', 'label' => 'Sold'],
        ['value' => 'disposed', 'label' => 'Disposed'],
        ['value' => 'under_maintenance', 'label' => 'Under Maintenance'],
        ['value' => 'rented_out', 'label' => 'Rented Out']
    ];
    
    // Get condition options
    $conditions = [
        ['value' => 'excellent', 'label' => 'Excellent'],
        ['value' => 'good', 'label' => 'Good'],
        ['value' => 'fair', 'label' => 'Fair'],
        ['value' => 'poor', 'label' => 'Poor']
    ];
    
    JWTHelper::sendResponse(200, true, 'Lookups retrieved successfully', [
        'asset_types' => $assetTypes,
        'currencies' => $currencies,
        'statuses' => $statuses,
        'conditions' => $conditions
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error retrieving lookups: ' . $e->getMessage());
}

