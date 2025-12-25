<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Update TAWJEEH Settings
 * Endpoint: /api/residence/update-tawjeeh.php
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

if (!isset($data['residenceID']) || !isset($data['tawjeehIncluded'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID and tawjeehIncluded');
}

$residenceID = (int)$data['residenceID'];
$tawjeehIncluded = (int)$data['tawjeehIncluded'];
$tawjeehAmount = isset($data['tawjeehAmount']) ? (float)$data['tawjeehAmount'] : 150;

try {
    // Verify residence exists
    $sql = "SELECT residenceID FROM residence WHERE residenceID = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Update TAWJEEH settings
    // Check if residence_charges record exists
    $sql = "SELECT residence_id FROM residence_charges WHERE residence_id = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        // Update existing record
        $sql = "UPDATE residence_charges 
                SET tawjeeh_included_in_sale = :tawjeehIncluded, 
                    tawjeeh_amount = :tawjeehAmount 
                WHERE residence_id = :residenceID";
    } else {
        // Insert new record
        $sql = "INSERT INTO residence_charges (residence_id, tawjeeh_included_in_sale, tawjeeh_amount) 
                VALUES (:residenceID, :tawjeehIncluded, :tawjeehAmount)";
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->bindParam(':tawjeehIncluded', $tawjeehIncluded);
    $stmt->bindParam(':tawjeehAmount', $tawjeehAmount);
    $stmt->execute();
    
    JWTHelper::sendResponse(200, true, 'TAWJEEH settings updated successfully', [
        'residenceID' => $residenceID,
        'tawjeehIncluded' => $tawjeehIncluded,
        'tawjeehAmount' => $tawjeehAmount
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error updating TAWJEEH settings: ' . $e->getMessage());
}


