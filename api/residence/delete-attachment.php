<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Delete Attachment for a Residence
 * Endpoint: /api/residence/delete-attachment.php
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
    
$sql = "SELECT permission.delete FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['delete'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['attachmentId'])) {
    JWTHelper::sendResponse(400, false, 'Missing required field: attachmentId');
}

$attachmentId = (int)$data['attachmentId'];

try {
    $pdo->beginTransaction();
    
    // Get attachment details before deleting
    $getAttachment = $pdo->prepare("SELECT file_name, ResID FROM residencedocuments WHERE ResidenceDocID = :attachmentId");
    $getAttachment->bindParam(':attachmentId', $attachmentId);
    $getAttachment->execute();
    $attachment = $getAttachment->fetch(PDO::FETCH_ASSOC);
    
    if (!$attachment) {
        $pdo->rollback();
        JWTHelper::sendResponse(404, false, 'Attachment not found');
    }
    
    // Delete file from filesystem
    $filePath = __DIR__ . '/../../residence/' . $attachment['file_name'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }
    
    // Delete from database
    $deleteSQL = "DELETE FROM residencedocuments WHERE ResidenceDocID = :attachmentId";
    $deleteStmt = $pdo->prepare($deleteSQL);
    $deleteStmt->bindParam(':attachmentId', $attachmentId);
    $deleteStmt->execute();
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Attachment deleted successfully');
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Delete attachment error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error deleting attachment: ' . $e->getMessage());
}







