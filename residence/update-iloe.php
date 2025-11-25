<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Update ILOE Insurance Settings
 * Endpoint: /api/residence/update-iloe.php
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

if (!isset($data['residenceID']) || !isset($data['insuranceIncluded']) || !isset($data['insuranceAmount'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID, insuranceIncluded, and insuranceAmount');
}

$residenceID = (int)$data['residenceID'];
$insuranceIncluded = (int)$data['insuranceIncluded'];
$insuranceAmount = (float)$data['insuranceAmount'];
// Support both iloeFine and iloe_fine for backward compatibility
$iloeFine = isset($data['iloeFine']) ? (float)$data['iloeFine'] : (isset($data['iloe_fine']) ? (float)$data['iloe_fine'] : 0);
$fineRemarks = isset($data['fineRemarks']) ? trim($data['fineRemarks']) : '';

try {
    // Verify residence exists
    $sql = "SELECT residenceID FROM residence WHERE residenceID = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Update ILOE settings
    // Check if residence_charges record exists
    $sql = "SELECT residence_id FROM residence_charges WHERE residence_id = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        // Update existing record
        $sql = "UPDATE residence_charges 
                SET insurance_included_in_sale = :insuranceIncluded, 
                    insurance_amount = :insuranceAmount,
                    insurance_fine = :iloeFine
                WHERE residence_id = :residenceID";
    } else {
        // Insert new record
        $sql = "INSERT INTO residence_charges (residence_id, insurance_included_in_sale, insurance_amount, insurance_fine) 
                VALUES (:residenceID, :insuranceIncluded, :insuranceAmount, :iloeFine)";
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->bindParam(':insuranceIncluded', $insuranceIncluded);
    $stmt->bindParam(':insuranceAmount', $insuranceAmount);
    $stmt->bindParam(':iloeFine', $iloeFine);
    $stmt->execute();
    
    // If fine remarks are provided, we might want to log them somewhere
    // For now, we'll just update the charges table
    
    JWTHelper::sendResponse(200, true, 'ILOE settings updated successfully', [
        'residenceID' => $residenceID,
        'insuranceIncluded' => $insuranceIncluded,
        'insuranceAmount' => $insuranceAmount,
        'iloeFine' => $iloeFine
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error updating ILOE settings: ' . $e->getMessage());
}


