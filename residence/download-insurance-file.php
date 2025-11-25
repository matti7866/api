<?php
/**
 * Download Insurance File API
 * Endpoint: /api/residence/download-insurance-file.php
 * Downloads insurance attachment file
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

session_start();

// Check session authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../../connection.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $residenceID = $_GET['residenceID'] ?? null;
        
        if (!$residenceID) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing residenceID parameter']);
            exit;
        }
        
        // Get insurance operation with attachment
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
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No insurance operation found']);
            exit;
        }
        
        // Extract attachment path from description
        $attachmentPath = null;
        if ($operation['description']) {
            if (preg_match('/Attachment: ([^,\)]+)/', $operation['description'], $matches)) {
                $attachmentPath = trim($matches[1]);
            }
        }
        
        if (!$attachmentPath) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'No file attached to this operation']);
            exit;
        }
        
        // Build full file path
        $filePath = __DIR__ . '/../../insurance_attachments/' . basename($attachmentPath);
        
        if (!file_exists($filePath)) {
            error_log("File not found: $filePath");
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'File not found on server']);
            exit;
        }
        
        // Get file info
        $fileSize = filesize($filePath);
        $fileName = basename($filePath);
        
        // Determine content type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $filePath);
        finfo_close($finfo);
        
        // Send file headers
        header('Content-Type: ' . $mimeType);
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . $fileSize);
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: public');
        
        // Clear output buffer
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        // Read and output file
        readfile($filePath);
        exit;
        
    } catch (Exception $e) {
        error_log("Download insurance file error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error downloading file: ' . $e->getMessage()]);
        exit;
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

