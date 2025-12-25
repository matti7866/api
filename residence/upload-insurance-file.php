<?php
/**
 * Upload Insurance File API
 * Endpoint: /api/residence/upload-insurance-file.php
 * Updates existing insurance operation with file attachment
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

// Simple test endpoint
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    JWTHelper::sendResponse(200, true, 'Upload insurance file endpoint is working');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        error_log("Upload insurance file - Starting");
        error_log("POST data: " . print_r($_POST, true));
        error_log("FILES data: " . print_r($_FILES, true));
        
        $residenceID = $_POST['residenceID'] ?? null;
        
        if (!$residenceID) {
            error_log("Missing residenceID");
            JWTHelper::sendResponse(400, false, 'Missing residenceID');
            exit;
        }
        
        if (!isset($_FILES['attachment'])) {
            error_log("No attachment file in request");
            JWTHelper::sendResponse(400, false, 'No file uploaded');
            exit;
        }
        
        if ($_FILES['attachment']['error'] != 0) {
            error_log("File upload error: " . $_FILES['attachment']['error']);
            JWTHelper::sendResponse(400, false, 'File upload error: ' . $_FILES['attachment']['error']);
            exit;
        }
        
        $pdo->beginTransaction();
        
        // Get existing insurance operation
        $stmt = $pdo->prepare("
            SELECT * FROM iloe_charges 
            WHERE residence_id = :residence_id 
            AND charge_type = 'insurance' 
            AND status = 'paid'
            ORDER BY charge_date DESC 
            LIMIT 1
        ");
        $stmt->bindParam(':residence_id', $residenceID);
        $stmt->execute();
        $operation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$operation) {
            error_log("No insurance operation found for residence: $residenceID");
            $pdo->rollback();
            JWTHelper::sendResponse(404, false, 'No insurance operation found for this residence');
            exit;
        }
        
        error_log("Found insurance operation ID: " . $operation['id']);
        
        // Handle file upload
        $uploadDir = __DIR__ . '/../../insurance_attachments/';
        error_log("Upload directory: $uploadDir");
        
        if (!is_dir($uploadDir)) {
            error_log("Creating directory: $uploadDir");
            if (!mkdir($uploadDir, 0755, true)) {
                throw new Exception('Failed to create upload directory');
            }
        }
        
        if (!is_writable($uploadDir)) {
            throw new Exception('Upload directory is not writable');
        }
        
        $fileName = uniqid() . '_' . basename($_FILES['attachment']['name']);
        $uploadPath = $uploadDir . $fileName;
        error_log("Attempting to move file to: $uploadPath");
        
        if (!move_uploaded_file($_FILES['attachment']['tmp_name'], $uploadPath)) {
            error_log("Failed to move uploaded file");
            throw new Exception('Failed to upload attachment file. Check directory permissions.');
        }
        
        error_log("File uploaded successfully: $fileName");
        
        $attachment_path = 'insurance_attachments/' . $fileName;
        
        // Update the description to include attachment info
        $currentDesc = $operation['description'];
        
        // Remove old attachment reference if exists
        $currentDesc = preg_replace('/,?\s*Attachment: [^,\)]+/', '', $currentDesc);
        
        // Add new attachment reference before the performed by info
        if (preg_match('/\(Performed by/', $currentDesc, $matches, PREG_OFFSET_CAPTURE)) {
            $pos = $matches[0][1];
            $newDesc = substr($currentDesc, 0, $pos) . ", Attachment: $fileName " . substr($currentDesc, $pos);
        } else {
            $newDesc = $currentDesc . ", Attachment: $fileName";
        }
        
        // Update the operation with new description
        $updateStmt = $pdo->prepare("
            UPDATE iloe_charges 
            SET description = :description 
            WHERE id = :id
        ");
        $updateStmt->bindParam(':description', $newDesc);
        $updateStmt->bindParam(':id', $operation['id']);
        $updateStmt->execute();
        
        error_log("Database updated successfully");
        
        $pdo->commit();
        
        error_log("Transaction committed");
        
        JWTHelper::sendResponse(200, true, 'Insurance file uploaded successfully', ['attachment_path' => $attachment_path]);
        exit;
        
    } catch (Exception $e) {
        error_log("Upload insurance file error: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollback();
        }
        JWTHelper::sendResponse(500, false, 'Error uploading insurance file: ' . $e->getMessage());
        exit;
    }
} else {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

