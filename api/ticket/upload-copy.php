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
    
// Log received data for debugging
    error_log("Upload Copy - POST data: " . json_encode($_POST));
    error_log("Upload Copy - FILES data: " . json_encode(array_keys($_FILES)));
    
    // Validate required fields
    if (!isset($_POST['ticket_id']) || !isset($_FILES['ticketCopy'])) {
        error_log("Upload Copy - Missing fields. POST keys: " . implode(', ', array_keys($_POST)) . " | FILES keys: " . implode(', ', array_keys($_FILES)));
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket ID and file are required',
            'debug' => [
                'post_keys' => array_keys($_POST),
                'files_keys' => array_keys($_FILES)
            ]
        ], 400);
    }
    
    $ticketId = $_POST['ticket_id'];
    $file = $_FILES['ticketCopy'];
    
    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'File upload error'
        ], 400);
    }
    
    // Validate file type (images and PDFs only)
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
    
    // Create upload directory if it doesn't exist
    $uploadDir = '../../uploads/tickets/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'ticket_' . $ticketId . '_' . time() . '.' . $extension;
    $uploadPath = $uploadDir . $filename;
    $dbPath = 'uploads/tickets/' . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Failed to upload file'
        ], 500);
    }
    
    // Update database
    $sql = "UPDATE ticket SET ticketCopy = :ticketCopy WHERE ticket = :ticket_id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':ticketCopy' => $dbPath,
        ':ticket_id' => $ticketId
    ]);
    
    if ($stmt->rowCount() > 0) {
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Ticket copy uploaded successfully',
            'file_path' => $dbPath
        ]);
    } else {
        // Delete uploaded file if database update failed
        if (file_exists($uploadPath)) {
            unlink($uploadPath);
        }
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket not found'
        ], 404);
    }
    
} catch (PDOException $e) {
    error_log("Database Error in ticket/upload-copy.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in ticket/upload-copy.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}

