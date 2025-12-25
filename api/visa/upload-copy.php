<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Validate required fields
    if (!isset($_POST['visa_id']) || !isset($_FILES['visaCopy'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Visa ID and file are required'
        ], 400);
    }
    
    $visaId = $_POST['visa_id'];
    $file = $_FILES['visaCopy'];
    
    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'File upload error'
        ], 400);
    }
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    $fileType = mime_content_type($file['tmp_name']);
    
    if (!in_array($fileType, $allowedTypes)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid file type. Only JPG, PNG, GIF, and PDF are allowed'
        ], 400);
    }
    
    // Validate file size (max 5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'File size must be less than 5MB'
        ], 400);
    }
    
    // Create upload directory
    $uploadDir = __DIR__ . '/../../uploads/visas/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'visa_' . $visaId . '_' . time() . '.' . $extension;
    $uploadPath = $uploadDir . $filename;
    $dbPath = 'uploads/visas/' . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Failed to upload file'
        ], 500);
    }
    
    // Update database
    $sql = "UPDATE visa SET visaCopy = :visaCopy WHERE visa_id = :visa_id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':visaCopy' => $dbPath,
        ':visa_id' => $visaId
    ]);
    
    if ($stmt->rowCount() > 0) {
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Visa copy uploaded successfully',
            'file_path' => $dbPath
        ]);
    } else {
        // Delete uploaded file if database update failed
        if (file_exists($uploadPath)) {
            unlink($uploadPath);
        }
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Visa not found'
        ], 404);
    }
    
} catch (PDOException $e) {
    error_log("Database Error in visa/upload-copy.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in visa/upload-copy.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













