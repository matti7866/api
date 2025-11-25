<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    if ($action === 'get') {
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            JWTHelper::sendResponse(400, false, 'ID is required');
        }
        
        // Verify the residence exists and is Freezone type
        $checkStmt = $pdo->prepare("SELECT residenceID FROM residence WHERE residenceID = :id AND res_type = 'Freezone'");
        $checkStmt->bindParam(':id', $id);
        $checkStmt->execute();
        if (!$checkStmt->fetch()) {
            JWTHelper::sendResponse(404, false, 'Freezone residence not found');
        }
        
        // Get attachments - freezonedocuments.freezoneID now references residence.residenceID
        $stmt = $pdo->prepare("SELECT * FROM freezonedocuments WHERE freezoneID = :id ORDER BY id DESC");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedFiles = [];
        foreach ($files as $file) {
            $formattedFiles[] = [
                'id' => (int)$file['id'],
                'file_name' => $file['file_name'],
                'original_name' => $file['original_name'],
                'fileType' => $file['fileType'],
                'uploaded_at' => $file['uploaded_at'] ?? ''
            ];
        }
        
        JWTHelper::sendResponse(200, true, 'Files fetched successfully', ['attachments' => $formattedFiles]);
    }
    
    if ($action === 'upload') {
        $id = $_POST['id'] ?? '';
        $fileType = $_POST['fileType'] ?? '';
        
        if (empty($id) || empty($fileType)) {
            JWTHelper::sendResponse(400, false, 'ID and File Type are required');
        }
        
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            JWTHelper::sendResponse(400, false, 'File is required');
        }
        
        $file = $_FILES['file'];
        if ($file['size'] > 2097152) { // 2MB limit
            JWTHelper::sendResponse(400, false, 'File size exceeds 2MB limit');
        }
        
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $valid_extensions = ['jpg', 'png', 'jpeg', 'doc', 'docx', 'pdf', 'gif', 'txt', 'csv', 'ppt', 'pptx', 'rar', 'xls', 'xlsx', 'zip'];
        
        if (!in_array(strtolower($extension), $valid_extensions)) {
            JWTHelper::sendResponse(400, false, 'Invalid file type');
        }
        
        $new_image_name = rand() . '.' . $extension;
        $path = __DIR__ . "/../../../freezoneFiles/" . $new_image_name;
        
        $uploadDir = dirname($path);
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        if (move_uploaded_file($file['tmp_name'], $path)) {
            // Verify the residence exists and is Freezone type
            $checkStmt = $pdo->prepare("SELECT residenceID FROM residence WHERE residenceID = :id AND res_type = 'Freezone'");
            $checkStmt->bindParam(':id', $id);
            $checkStmt->execute();
            if (!$checkStmt->fetch()) {
                unlink($path); // Clean up uploaded file
                JWTHelper::sendResponse(404, false, 'Freezone residence not found');
            }
            
            $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
            
            // freezonedocuments.freezoneID now references residence.residenceID where res_type = 'Freezone'
            $fileStmt = $pdo->prepare("INSERT INTO `freezonedocuments` (`freezoneID`, `file_name`, `original_name`, `fileType`, `uploaded_by`) 
                        VALUES (:ResID, :file_name, :original_name, :fileType, :uploaded_by)");
            $fileStmt->bindParam(':ResID', $id);
            $fileStmt->bindParam(':file_name', $new_image_name);
            $fileStmt->bindParam(':original_name', $file['name']);
            $fileStmt->bindParam(':fileType', $fileType);
            $fileStmt->bindParam(':uploaded_by', $userID);
            $fileStmt->execute();
            
            JWTHelper::sendResponse(200, true, 'File uploaded successfully', ['id' => $pdo->lastInsertId()]);
        } else {
            JWTHelper::sendResponse(500, false, 'Failed to upload file');
        }
    }
    
    if ($action === 'delete') {
        $id = $_POST['id'] ?? '';
        
        if (empty($id)) {
            JWTHelper::sendResponse(400, false, 'ID is required');
        }
        
        // Get file info
        $stmt = $pdo->prepare("SELECT file_name FROM freezonedocuments WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($file) {
            $filePath = __DIR__ . "/../../../freezoneFiles/" . $file['file_name'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        
        $stmt = $pdo->prepare("DELETE FROM freezonedocuments WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'File deleted successfully');
    }
    
    JWTHelper::sendResponse(400, false, 'Invalid action');
    
} catch (Exception $e) {
    error_log("Error in freezone/attachments.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

