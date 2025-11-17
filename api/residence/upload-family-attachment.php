<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Upload Family Residence Attachment API
 * Endpoint: /api/residence/upload-family-attachment.php
 * Handles uploading attachments for family residences
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$residence_id = isset($_POST['residence_id']) ? (int)$_POST['residence_id'] : 0;
$file_type = isset($_POST['file_type']) ? trim($_POST['file_type']) : 'other';
$step_number = isset($_POST['step_number']) ? (int)$_POST['step_number'] : 0;

if ($residence_id == 0) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    JWTHelper::sendResponse(400, false, 'File upload error');
}

try {
    // Create table if it doesn't exist
    $createTableSql = "
        CREATE TABLE IF NOT EXISTS `family_residence_documents` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `family_residence_id` INT(11) NOT NULL,
            `document_type` VARCHAR(50) NOT NULL,
            `document_name` VARCHAR(255) NOT NULL,
            `document_path` VARCHAR(500) NOT NULL,
            `document_size` INT(11) DEFAULT NULL,
            `document_extension` VARCHAR(10) DEFAULT NULL,
            `uploaded_by` INT(11) DEFAULT NULL,
            `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `family_residence_id` (`family_residence_id`),
            KEY `document_type` (`document_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $pdo->exec($createTableSql);
    
    $file = $_FILES['file'];
    $file_name = $file['name'];
    $file_size = $file['size'];
    $file_tmp = $file['tmp_name'];
    $extension = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
    
    // Validate file size (5MB limit)
    if ($file_size > 5242880) {
        JWTHelper::sendResponse(400, false, 'File size exceeds 5MB limit');
    }
    
    // Validate file extension
    $valid_extensions = ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'gif'];
    if (!in_array($extension, $valid_extensions)) {
        JWTHelper::sendResponse(400, false, 'Invalid file type. Allowed: jpg, png, pdf, doc, docx');
    }
    
    // Map file_type to document_type
    $fileTypeToDocType = [
        '1' => 'passport',
        '11' => 'photo',
        '12' => 'id_front',
        '13' => 'id_back',
        '14' => 'other'
    ];
    
    $document_type = isset($fileTypeToDocType[$file_type]) ? $fileTypeToDocType[$file_type] : 'other';
    
    // Create unique filename
    $new_file_name = 'family_' . $residence_id . '_' . $document_type . '_' . time() . '_' . rand(1000, 9999) . '.' . $extension;
    
    // Use absolute path
    $upload_dir = __DIR__ . '/../../family_residence_documents/';
    $upload_path = $upload_dir . $new_file_name;
    $relative_path = 'family_residence_documents/' . $new_file_name;
    
    // Create directory if it doesn't exist
    if (!file_exists($upload_dir)) {
        if (!mkdir($upload_dir, 0777, true)) {
            error_log('Failed to create directory: ' . $upload_dir);
            JWTHelper::sendResponse(500, false, 'Failed to create upload directory: ' . $upload_dir);
        }
    }
    
    // Check if directory is writable
    if (!is_writable($upload_dir)) {
        error_log('Directory is not writable: ' . $upload_dir);
        // Try to make it writable
        chmod($upload_dir, 0777);
        if (!is_writable($upload_dir)) {
            JWTHelper::sendResponse(500, false, 'Upload directory is not writable. Please check permissions.');
        }
    }
    
    // Check if file was actually uploaded
    if (!is_uploaded_file($file_tmp)) {
        error_log('File is not an uploaded file: ' . $file_tmp);
        JWTHelper::sendResponse(400, false, 'Invalid file upload');
    }
    
    // Move uploaded file
    if (move_uploaded_file($file_tmp, $upload_path)) {
        $staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : (isset($userData['user_id']) ? (int)$userData['user_id'] : null);
        
        // Insert into database
        $stmt = $pdo->prepare("
            INSERT INTO family_residence_documents 
            (family_residence_id, document_type, document_name, document_path, document_size, document_extension, uploaded_by) 
            VALUES (:family_id, :doc_type, :original_name, :file_path, :file_size, :extension, :uploaded_by)
        ");
        
        $stmt->execute([
            'family_id' => $residence_id,
            'doc_type' => $document_type,
            'original_name' => $file_name,
            'file_path' => $relative_path,
            'file_size' => $file_size,
            'extension' => $extension,
            'uploaded_by' => $staff_id
        ]);
        
        JWTHelper::sendResponse(200, true, 'Document uploaded successfully');
    } else {
        $error = error_get_last();
        error_log('Failed to move uploaded file. Source: ' . $file_tmp . ', Destination: ' . $upload_path);
        error_log('Error: ' . ($error ? $error['message'] : 'Unknown error'));
        error_log('Upload dir exists: ' . (file_exists($upload_dir) ? 'yes' : 'no'));
        error_log('Upload dir writable: ' . (is_writable($upload_dir) ? 'yes' : 'no'));
        error_log('File exists: ' . (file_exists($file_tmp) ? 'yes' : 'no'));
        JWTHelper::sendResponse(500, false, 'Failed to move uploaded file. Check server logs for details.');
    }
} catch (Exception $e) {
    error_log('uploadFamilyAttachment error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error uploading attachment: ' . $e->getMessage());
}

