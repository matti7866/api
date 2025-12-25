<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Upload Attachment for a Residence
 * Endpoint: /api/residence/upload-attachment.php
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

// Get staff_id from JWT token
$staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
if (!$staff_id) {
    JWTHelper::sendResponse(400, false, 'Staff ID is required. User not authenticated properly.');
}

// Get form data
$residenceID = isset($_POST['residenceID']) ? (int)$_POST['residenceID'] : 0;
$stepNumber = isset($_POST['stepNumber']) ? (int)$_POST['stepNumber'] : 0;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    JWTHelper::sendResponse(400, false, 'File upload error');
}

// Map step number to fileType
// For step 0 (Initial Documents), we need to determine fileType based on file name or allow user to specify
// For now, we'll use a default mapping but allow override via optional fileType parameter
$stepToFileType = [
    0 => 1,   // Initial Documents - default to passport (1), but can be 1, 11, 12, or 13
    1 => 2,   // Offer Letter
    2 => 3,   // Insurance
    3 => 4,   // Labor Card
    4 => 5,   // E-Visa
    5 => 6,   // Change Status
    6 => 7,   // Medical
    7 => 8,   // Emirates ID
    8 => 9,   // Visa Stamping
    9 => 10,  // Final Documents
    10 => 10, // Completed - Final Documents
];

// Allow override fileType for step 0 if provided
$requestedFileType = isset($_POST['fileType']) ? (int)$_POST['fileType'] : null;
if ($requestedFileType && in_array($requestedFileType, [1, 11, 12, 13])) {
    $fileType = $requestedFileType;
} else {
    $fileType = isset($stepToFileType[$stepNumber]) ? $stepToFileType[$stepNumber] : 1;
}

// Helper function to upload file
function uploadResidenceFile($file, $residenceID, $fileType, &$errorMessage = '') {
    global $pdo;
    
    $new_image_name = '';
    
    // Check file size
    if ($file['size'] > 20971520) { // 20MB limit
        $errorMessage = 'File size exceeds 20MB limit';
        error_log("Upload failed: " . $errorMessage);
        return '';
    }
    
    if ($file['size'] == 0) {
        $errorMessage = 'File is empty';
        error_log("Upload failed: " . $errorMessage);
        return '';
    }
    
    $file_name = $file['name'];
    $extension = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
    $valid_extensions = array('jpg', 'png', 'jpeg', 'doc', 'docx', 'pdf', 'gif', 'txt', 'csv', 'ppt', 'pptx', 'rar', 'xls', 'xlsx', 'zip');
    
    if (!in_array($extension, $valid_extensions)) {
        $errorMessage = 'Invalid file type. Allowed: ' . implode(', ', $valid_extensions);
        error_log("Upload failed: " . $errorMessage);
        return '';
    }
    
    $new_image_name = rand() . '_' . time() . '.' . $extension;
    $upload_dir = __DIR__ . '/../../residence/';
    
    // Ensure residence directory exists
    if (!file_exists($upload_dir)) {
        if (!mkdir($upload_dir, 0777, true)) {
            $errorMessage = 'Failed to create upload directory: ' . $upload_dir;
            error_log("Upload failed: " . $errorMessage);
            return '';
        }
    }
    
    // Check if directory is writable - try to fix permissions if not
    if (!is_writable($upload_dir)) {
        // Try to make it writable
        @chmod($upload_dir, 0777);
        
        // Check again
        if (!is_writable($upload_dir)) {
            $errorMessage = 'Upload directory is not writable: ' . $upload_dir . '. Current permissions: ' . substr(sprintf('%o', fileperms($upload_dir)), -4);
            error_log("Upload failed: " . $errorMessage);
            error_log("Directory owner: " . fileowner($upload_dir) . ", PHP user: " . get_current_user() . ", Process user: " . (function_exists('posix_getpwuid') && function_exists('posix_geteuid') ? posix_getpwuid(posix_geteuid())['name'] : 'unknown'));
            return '';
        }
    }
    
    $path = $upload_dir . $new_image_name;
    
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        $errorMessage = 'Failed to move uploaded file. Check server permissions.';
        error_log("move_uploaded_file failed. tmp_name: " . $file['tmp_name'] . ", path: " . $path . ", error: " . $file['error']);
        return '';
    }
    
    // Verify file was actually saved
    if (!file_exists($path)) {
        $errorMessage = 'File not found after upload';
        error_log("File upload failed: File not found after move_uploaded_file. Path: " . $path);
        return '';
    }
    
    // Insert into database
    try {
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`, `uploaded_at`) 
                   VALUES (:ResID,:file_name,:original_name,:fileType, NOW())";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $new_image_name);
        $fileStmt->bindParam(':original_name', $file['name']);
        $fileStmt->bindParam(':fileType', $fileType);
        
        if (!$fileStmt->execute()) {
            $errorInfo = $fileStmt->errorInfo();
            $errorMessage = 'Database insert failed: ' . $errorInfo[2];
            error_log("Database insert failed: " . implode(", ", $errorInfo));
            // Delete the uploaded file if DB insert fails
            if (file_exists($path)) {
                unlink($path);
            }
            return '';
        }
    } catch (PDOException $e) {
        $errorMessage = 'Database error: ' . $e->getMessage();
        error_log("Database exception: " . $e->getMessage());
        // Delete the uploaded file if DB insert fails
        if (file_exists($path)) {
            unlink($path);
        }
        return '';
    }
    
    error_log("File uploaded successfully: " . $new_image_name . " to " . $path);
    return $new_image_name;
}

try {
    $pdo->beginTransaction();
    
    // Verify residence exists
    $checkResidence = $pdo->prepare("SELECT residenceID FROM residence WHERE residenceID = :residenceID");
    $checkResidence->bindParam(':residenceID', $residenceID);
    $checkResidence->execute();
    
    if ($checkResidence->rowCount() === 0) {
        $pdo->rollback();
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Upload file
    $uploadError = '';
    $uploadedFileName = uploadResidenceFile($_FILES['file'], $residenceID, $fileType, $uploadError);
    
    if (!$uploadedFileName) {
        $pdo->rollback();
        $errorMsg = $uploadError ?: 'Failed to upload file. ';
        if ($_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $uploadErrorCodes = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize directive',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE directive',
                UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
            ];
            $errorMsg .= 'Upload error: ' . ($uploadErrorCodes[$_FILES['file']['error']] ?? 'Unknown error code ' . $_FILES['file']['error']);
        }
        error_log("Upload failed: " . $errorMsg);
        JWTHelper::sendResponse(400, false, $errorMsg);
    }
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Attachment uploaded successfully', [
        'residenceID' => $residenceID,
        'stepNumber' => $stepNumber,
        'fileType' => $fileType,
        'fileName' => $uploadedFileName
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Upload attachment error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error uploading attachment: ' . $e->getMessage());
}

