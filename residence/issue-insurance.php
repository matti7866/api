<?php
/**
 * Issue Insurance Operation API
 * Endpoint: /api/residence/issue-insurance.php
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

// Perform Insurance Operation
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $pdo->beginTransaction();
        
        $residenceID = $_POST['residenceID'] ?? null;
        $uid_number = $_POST['uid_number'] ?? '';
        $labour_card_number = $_POST['labour_card_number'] ?? '';
        $passport_number = $_POST['passport_number'] ?? '';
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
        if (empty($uid_number) || empty($labour_card_number) || empty($passport_number)) {
            $resQuery = $pdo->prepare("SELECT passenger_name, uid, mb_number, passportNumber FROM residence WHERE residenceID = :id");
            $resQuery->bindParam(':id', $residenceID);
            $resQuery->execute();
            $resInfo = $resQuery->fetch(PDO::FETCH_ASSOC);
            
            if (!$uid_number) $uid_number = $resInfo['uid'] ?? '';
            if (!$labour_card_number) $labour_card_number = $resInfo['mb_number'] ?? '';
            if (!$passport_number) $passport_number = $resInfo['passportNumber'] ?? '';
        }
        
        // Check if insurance operation already exists for this residence
        $checkQuery = $pdo->prepare("SELECT COUNT(*) FROM iloe_charges 
            WHERE residence_id = :residence_id AND charge_type = 'insurance' AND status = 'paid'");
        $checkQuery->bindParam(':residence_id', $residenceID);
        $checkQuery->execute();
        
        if ($checkQuery->fetchColumn() > 0) {
            JWTHelper::sendResponse(400, false, 'Insurance operation has already been performed for this residence');
        }
        
        // Handle file upload if provided
        $attachment_path = null;
        if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] == 0) {
            $uploadDir = __DIR__ . '/../../insurance_attachments/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $fileName = uniqid() . '_' . basename($_FILES['attachment']['name']);
            $uploadPath = $uploadDir . $fileName;
            
            if (move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadPath)) {
                $attachment_path = 'insurance_attachments/' . $fileName;
            } else {
                throw new Exception('Failed to upload attachment file');
            }
        }
        
        // Create operation details description
        $description = "Insurance issued - UID: $uid_number, Labour Card: $labour_card_number, Passport: $passport_number";
        if ($notes) {
            $description .= ", Notes: $notes";
        }
        if ($attachment_path) {
            $description .= ", Attachment: $attachment_path";
        }
        $description .= " (Performed by user ID: $performed_by)";
        
        // Insert insurance charge record in iloe_charges table as completed/paid
        $insertQuery = $pdo->prepare("INSERT INTO iloe_charges 
            (residence_id, amount, currency_id, description, charge_date, charge_type, status, created_by, account_id) 
            VALUES (:residence_id, :amount, 1, :description, CURDATE(), 'insurance', 'paid', :created_by, :account_id)");
        
        $insertQuery->bindParam(':residence_id', $residenceID);
        $insertQuery->bindParam(':amount', $cost);
        $insertQuery->bindParam(':description', $description);
        $insertQuery->bindParam(':created_by', $performed_by);
        $insertQuery->bindParam(':account_id', $account_id);
        $insertQuery->execute();
        
        $pdo->commit();
        
        JWTHelper::sendResponse(200, true, 'Insurance issued successfully');
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollback();
        }
        JWTHelper::sendResponse(500, false, 'Error issuing insurance: ' . $e->getMessage());
    }
} else {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

