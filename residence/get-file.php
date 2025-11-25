<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Serve Residence Document Files
 * Endpoint: /api/residence/get-file.php?id=ResidenceDocID
 * 
 * Note: This endpoint doesn't require JWT for images because browsers
 * don't send Authorization headers when loading images via <img> tags.
 * We still verify the file exists and belongs to a valid residence.
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../connection.php';

// Get file ID
$fileID = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$fileID) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'File ID is required']);
    exit;
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get file information from database
    $sql = "SELECT file_name, original_name, ResID 
            FROM residencedocuments 
            WHERE ResidenceDocID = :fileID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':fileID', $fileID, PDO::PARAM_INT);
    $stmt->execute();
    $file = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$file) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'File not found in database']);
        exit;
    }
    
    // Verify residence exists (basic security check)
    $checkResidence = $pdo->prepare("SELECT residenceID FROM residence WHERE residenceID = :residenceID");
    $checkResidence->bindParam(':residenceID', $file['ResID']);
    $checkResidence->execute();
    
    if ($checkResidence->rowCount() === 0) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Residence not found']);
        exit;
    }
    
    // Construct file path - use absolute path from project root
    // __DIR__ is /path/to/snt/api/residence
    // We need to go up two levels: api/residence -> api -> project root (snt)
    $projectRoot = dirname(dirname(__DIR__)); // Go up from api/residence to project root (snt)
    $filePath = $projectRoot . DIRECTORY_SEPARATOR . 'residence' . DIRECTORY_SEPARATOR . $file['file_name'];
    
    // Normalize the path to resolve any .. or . segments
    $resolvedPath = realpath($filePath);
    
    // Check if file exists
    if (!$resolvedPath || !file_exists($resolvedPath)) {
        error_log("File not found on disk. File name: {$file['file_name']}, Constructed path: {$filePath}, Resolved path: " . ($resolvedPath ?: 'null'));
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false, 
            'message' => 'File not found on server',
            'file_name' => $file['file_name'],
            'constructed_path' => $filePath,
            'resolved_path' => $resolvedPath ?: 'null'
        ]);
        exit;
    }
    
    // Use the resolved path
    $filePath = $resolvedPath;
    
    // Get file extension to determine content type
    $extension = strtolower(pathinfo($file['file_name'], PATHINFO_EXTENSION));
    $contentTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'zip' => 'application/zip',
        'rar' => 'application/x-rar-compressed',
        'txt' => 'text/plain',
        'csv' => 'text/csv'
    ];
    
    $contentType = isset($contentTypes[$extension]) ? $contentTypes[$extension] : 'application/octet-stream';
    
    // Set headers
    header('Content-Type: ' . $contentType);
    header('Content-Disposition: inline; filename="' . htmlspecialchars($file['original_name']) . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=3600');
    header('Access-Control-Allow-Origin: *'); // Allow CORS for images
    
    // Output file
    readfile($filePath);
    exit;
    
} catch (Exception $e) {
    error_log("Get file error: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Error serving file: ' . $e->getMessage()]);
    exit;
}
