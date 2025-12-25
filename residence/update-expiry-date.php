<?php
/**
 * Update Expiry Date API
 * Endpoint: /api/residence/update-expiry-date.php
 * Updates the expiry_date field for a residence
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
    $sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['update'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied - Update permission required');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get POST data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    JWTHelper::sendResponse(400, false, 'Invalid JSON data');
}

$residenceID = isset($data['residenceID']) ? (int)$data['residenceID'] : 0;
$expiryDate = isset($data['expiry_date']) ? trim($data['expiry_date']) : '';

if ($residenceID <= 0) {
    JWTHelper::sendResponse(400, false, 'Invalid residence ID');
}

if (empty($expiryDate)) {
    JWTHelper::sendResponse(400, false, 'Expiry date is required');
}

// Validate date format
$dateObj = DateTime::createFromFormat('Y-m-d', $expiryDate);
if (!$dateObj || $dateObj->format('Y-m-d') !== $expiryDate) {
    JWTHelper::sendResponse(400, false, 'Invalid date format. Use YYYY-MM-DD');
}

try {
    // Check if residence exists
    $checkSql = "SELECT residenceID FROM residence WHERE residenceID = :residenceID";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->bindParam(':residenceID', $residenceID);
    $checkStmt->execute();
    
    if ($checkStmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }

    // Update the expiry_date
    $updateSql = "UPDATE residence SET expiry_date = :expiry_date WHERE residenceID = :residenceID";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->bindParam(':expiry_date', $expiryDate);
    $updateStmt->bindParam(':residenceID', $residenceID);
    
    if (!$updateStmt->execute()) {
        $errorInfo = $updateStmt->errorInfo();
        throw new Exception('SQL Error: ' . $errorInfo[2]);
    }

    JWTHelper::sendResponse(200, true, 'Expiry date updated successfully', [
        'residenceID' => $residenceID,
        'expiry_date' => $expiryDate
    ]);
} catch (Exception $e) {
    error_log('Update Expiry Date API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    
    $errorMessage = 'Error updating expiry date: ' . $e->getMessage();
    
    JWTHelper::sendResponse(500, false, $errorMessage);
}


