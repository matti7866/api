<?php
/**
 * Perform Tawjeeh Operation API
 * Endpoint: /api/residence/perform-tawjeeh.php
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

header('Content-Type: application/json');

// Perform Tawjeeh Operation
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $pdo->beginTransaction();
        
        $residenceID = $_POST['residenceID'] ?? null;
        $uid_number = $_POST['uid_number'] ?? '';
        $labour_card_number = $_POST['labour_card_number'] ?? '';
        $cost = $_POST['cost'] ?? 0;
        $account_id = $_POST['account_id'] ?? null;
        $notes = $_POST['notes'] ?? '';
        $performed_by = isset($userData['staff_id']) ? (int)$userData['staff_id'] : (isset($userData['user_id']) ? (int)$userData['user_id'] : null);
        
        if (!$performed_by) {
            JWTHelper::sendResponse(400, false, 'User ID is required. User not authenticated properly.');
        }
        
        if (!$residenceID || !$cost || !$account_id) {
            JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID, cost, or account_id');
        }
        
        // Get residence info if not provided
        if (empty($uid_number) || empty($labour_card_number)) {
            $resQuery = $pdo->prepare("SELECT passenger_name, uid, mb_number FROM residence WHERE residenceID = :id");
            $resQuery->bindParam(':id', $residenceID);
            $resQuery->execute();
            $resInfo = $resQuery->fetch(PDO::FETCH_ASSOC);
            
            if (!$uid_number) $uid_number = $resInfo['uid'] ?? '';
            if (!$labour_card_number) $labour_card_number = $resInfo['mb_number'] ?? '';
        }
        
        // Check if tawjeeh operation already exists for this residence
        $checkQuery = $pdo->prepare("SELECT COUNT(*) FROM tawjeeh_charges 
            WHERE residence_id = :residence_id AND status = 'paid'");
        $checkQuery->bindParam(':residence_id', $residenceID);
        $checkQuery->execute();
        
        if ($checkQuery->fetchColumn() > 0) {
            JWTHelper::sendResponse(400, false, 'Tawjeeh operation has already been performed for this residence');
        }
        
        // Create operation details description
        $description = "Tawjeeh performed - UID: $uid_number, Labour Card: $labour_card_number";
        if ($notes) {
            $description .= ", Notes: $notes";
        }
        $description .= " (Performed by user ID: $performed_by)";
        
        // Insert tawjeeh charge record as completed/paid
        $insertQuery = $pdo->prepare("INSERT INTO tawjeeh_charges 
            (residence_id, amount, currency_id, description, charge_date, status, created_by, account_id) 
            VALUES (:residence_id, :amount, 1, :description, CURDATE(), 'paid', :created_by, :account_id)");
        
        $insertQuery->bindParam(':residence_id', $residenceID);
        $insertQuery->bindParam(':amount', $cost);
        $insertQuery->bindParam(':description', $description);
        $insertQuery->bindParam(':created_by', $performed_by);
        $insertQuery->bindParam(':account_id', $account_id);
        $insertQuery->execute();
        
        $pdo->commit();
        
        JWTHelper::sendResponse(200, true, 'Tawjeeh operation completed successfully');
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollback();
        }
        JWTHelper::sendResponse(500, false, 'Error performing tawjeeh operation: ' . $e->getMessage());
    }
} else {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

