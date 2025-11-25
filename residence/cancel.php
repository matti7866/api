<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Cancel Residence
 * Endpoint: /api/residence/cancel.php
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

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['residenceID']) || !isset($data['cancellation_charges'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields');
}

try {
    $pdo->beginTransaction();
    
    // Get residence details first
    $stmt = $pdo->prepare("SELECT customer_id, cancelled FROM residence WHERE residenceID = :id");
    $stmt->bindParam(':id', $data['residenceID']);
    $stmt->execute();
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    if ($residence['cancelled'] == 1) {
        JWTHelper::sendResponse(400, false, 'Residence already cancelled');
    }
    
    // Update residence
    $sql = "UPDATE residence SET 
                cancelled = 1,
                current_status = 'Cancelled',
                cancelDate = NOW(),
                cancelRemarks = :remarks,
                canceledBy = :canceledBy,
                cancellation_cost = :charges
            WHERE residenceID = :residenceID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $data['residenceID']);
    $stmt->bindParam(':remarks', $data['remarks']);
    // Get staff_id from userData (JWT token contains staff_id, not user_id)
    $staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
    if (!$staff_id) {
        JWTHelper::sendResponse(400, false, 'Staff ID is required. User not authenticated properly.');
    }
    $stmt->bindParam(':canceledBy', $staff_id, PDO::PARAM_INT);
    $stmt->bindParam(':charges', $data['cancellation_charges']);
    $stmt->execute();
    
    // Insert into residence_cancellation table
    $sql = "INSERT INTO residence_cancellation (
        residence, customer_id, cancellation_charges, remarks, datetime
    ) VALUES (
        :residence, :customer_id, :charges, :remarks, NOW()
    )";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residence', $data['residenceID']);
    $stmt->bindParam(':customer_id', $residence['customer_id']);
    $stmt->bindParam(':charges', $data['cancellation_charges']);
    $stmt->bindParam(':remarks', $data['remarks']);
    $stmt->execute();
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Residence cancelled successfully');
    
} catch (Exception $e) {
    $pdo->rollBack();
    JWTHelper::sendResponse(500, false, 'Error cancelling residence: ' . $e->getMessage());
}


