<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Family Residence Attachments API
 * Endpoint: /api/residence/family-attachments.php
 * Handles fetching and deleting family residence attachments
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
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

$method = $_SERVER['REQUEST_METHOD'];

// GET - Fetch attachments
if ($method === 'GET') {
    $residence_id = isset($_GET['residence_id']) ? (int)$_GET['residence_id'] : 0;
    
    if ($residence_id == 0) {
        JWTHelper::sendResponse(400, false, 'Residence ID is required', ['data' => []]);
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
        
        // Map document types to file types for compatibility
        $docTypeToFileType = [
            'passport' => 1,
            'photo' => 11,
            'id_front' => 12,
            'id_back' => 13,
            'birth_certificate' => 14,
            'marriage_certificate' => 14,
            'other' => 14
        ];
        
        $stmt = $pdo->prepare("
            SELECT 
                id as attachment_id,
                family_residence_id as residenceID,
                document_path as file_path,
                document_name as file_name,
                document_type,
                document_size,
                document_extension,
                uploaded_at,
                0 as step_number,
                CASE 
                    WHEN document_type = 'passport' THEN 1
                    WHEN document_type = 'photo' THEN 11
                    WHEN document_type = 'id_front' THEN 12
                    WHEN document_type = 'id_back' THEN 13
                    WHEN document_type IN ('birth_certificate', 'marriage_certificate', 'other') THEN 14
                    ELSE 14
                END as file_type
            FROM family_residence_documents
            WHERE family_residence_id = :residence_id
            ORDER BY uploaded_at DESC
        ");
        $stmt->execute(['residence_id' => $residence_id]);
        $attachments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse(200, true, 'Attachments retrieved successfully', ['data' => $attachments]);
    } catch (Exception $e) {
        error_log('getFamilyAttachments error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error retrieving attachments: ' . $e->getMessage(), ['data' => []]);
    }
}

// DELETE - Delete attachment
if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    
    if ($id == 0) {
        JWTHelper::sendResponse(400, false, 'Attachment ID is required');
    }
    
    try {
        // Get file path before deleting
        $stmt = $pdo->prepare("SELECT document_path FROM family_residence_documents WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $attachment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$attachment) {
            JWTHelper::sendResponse(404, false, 'Attachment not found');
        }
        
        // Delete from database
        $deleteStmt = $pdo->prepare("DELETE FROM family_residence_documents WHERE id = :id");
        $deleteStmt->execute(['id' => $id]);
        
        // Delete file from server
        $filePath = __DIR__ . '/../../' . $attachment['document_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        JWTHelper::sendResponse(200, true, 'Attachment deleted successfully');
    } catch (Exception $e) {
        error_log('deleteFamilyAttachment error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error deleting attachment: ' . $e->getMessage());
    }
}

JWTHelper::sendResponse(405, false, 'Method not allowed');

