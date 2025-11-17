<?php
/**
 * Generate thumbnail for images and PDFs
 * Returns thumbnail image or preview
 */

// Include CORS headers
require_once __DIR__ . '/api/cors-headers.php';

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Start output buffering
ob_start();

// Try session first, then JWT token
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if(!isset($_SESSION['user_id'])){
    // Try JWT token from Authorization header
    require_once(__DIR__ . '/api/auth/JWTHelper.php');
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        $decoded = JWTHelper::validateToken($token);
        if ($decoded && isset($decoded->data)) {
            $_SESSION['user_id'] = $decoded->data->staff_id ?? null;
            $_SESSION['role_id'] = $decoded->data->role_id ?? null;
            $_SESSION['staff_name'] = $decoded->data->staff_name ?? '';
        }
    }
    
    if(!isset($_SESSION['user_id'])){
        ob_end_clean();
        header('Content-Type: image/png');
        // Create placeholder
        $placeholder = imagecreatetruecolor(200, 200);
        $bgColor = imagecolorallocate($placeholder, 245, 245, 247);
        imagefilledrectangle($placeholder, 0, 0, 200, 200, $bgColor);
        imagepng($placeholder);
        imagedestroy($placeholder);
        exit;
    }
}

error_reporting(0);
ini_set('display_errors', 0);

include __DIR__ . '/connection.php';

$PermissionSQL = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Company Documents' ";
$PermissionStmt = $pdo->prepare($PermissionSQL);
$PermissionStmt->bindParam(':role_id', $_SESSION['role_id']);
$PermissionStmt->execute();
$records = $PermissionStmt->fetchAll(\PDO::FETCH_ASSOC);
$select = $records[0]['select'];
if($select == 0){
    ob_end_clean();
    // Set CORS headers before image output
    $allowedOrigins = [
        'http://localhost:5174', 
        'http://127.0.0.1:5174',
        'http://localhost:5176', 
        'http://127.0.0.1:5176',
        'https://ssn.sntrips.com',
        'http://ssn.sntrips.com',
        'https://app.sntrips.com',
        'http://app.sntrips.com'
    ];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Content-Type: image/png');
    // Create placeholder instead of reading file
    $placeholder = imagecreatetruecolor(200, 200);
    $bgColor = imagecolorallocate($placeholder, 245, 245, 247);
    imagefilledrectangle($placeholder, 0, 0, 200, 200, $bgColor);
    imagepng($placeholder);
    imagedestroy($placeholder);
    exit;
}

ob_end_clean();

if (!isset($_GET['CustomID']) || !isset($_GET['ParentCustomID'])) {
    // Set CORS headers before image output
    $allowedOrigins = [
        'http://localhost:5174', 
        'http://127.0.0.1:5174',
        'http://localhost:5176', 
        'http://127.0.0.1:5176',
        'https://ssn.sntrips.com',
        'http://ssn.sntrips.com',
        'https://app.sntrips.com',
        'http://app.sntrips.com'
    ];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Content-Type: image/png');
    // Create placeholder
    $placeholder = imagecreatetruecolor(200, 200);
    $bgColor = imagecolorallocate($placeholder, 245, 245, 247);
    imagefilledrectangle($placeholder, 0, 0, 200, 200, $bgColor);
    imagepng($placeholder);
    imagedestroy($placeholder);
    exit;
}

$pdo->beginTransaction();
$sql = "SELECT directory_name FROM company_directories WHERE directory_id = :directory_id";
$stmt = $pdo->prepare($sql);
$stmt->bindParam(':directory_id', $_GET['ParentCustomID']);
$stmt->execute();
$directory = $stmt->fetchColumn();

// If directory is null or empty, try to find it from the file's directory_id
if(!$directory){
    $fileDirSQL = "SELECT dir_id FROM company_documents WHERE document_id = :document_id";
    $fileDirStmt = $pdo->prepare($fileDirSQL);
    $fileDirStmt->bindParam(':document_id', $_GET['CustomID']);
    $fileDirStmt->execute();
    $fileDirId = $fileDirStmt->fetchColumn();
    
    if($fileDirId){
        $dirSQL = "SELECT directory_name FROM company_directories WHERE directory_id = :directory_id";
        $dirStmt = $pdo->prepare($dirSQL);
        $dirStmt->bindParam(':directory_id', $fileDirId);
        $dirStmt->execute();
        $directory = $dirStmt->fetchColumn();
    }
}

if($directory){
    // Get the actual directory_id from the file if ParentCustomID is 0
    $actualDirId = $_GET['ParentCustomID'];
    if($actualDirId == 0 || !$actualDirId){
        $fileDirSQL = "SELECT dir_id FROM company_documents WHERE document_id = :document_id";
        $fileDirStmt = $pdo->prepare($fileDirSQL);
        $fileDirStmt->bindParam(':document_id', $_GET['CustomID']);
        $fileDirStmt->execute();
        $actualDirId = $fileDirStmt->fetchColumn();
    }
    
    $fileExists = "SELECT file_name FROM company_documents WHERE dir_id = :directory_id AND document_id = :document_id";
    $fileExistsStmt = $pdo->prepare($fileExists);
    $fileExistsStmt->bindParam(':directory_id', $actualDirId);
    $fileExistsStmt->bindParam(':document_id', $_GET['CustomID']);
    $fileExistsStmt->execute();
    $fileInDatabase = $fileExistsStmt->fetchColumn();
    $pdo->commit();
    
    if($fileInDatabase){
        $filePath = __DIR__ . '/company_files/'.$directory. '/'. $fileInDatabase;
        if(file_exists($filePath)){
            $extension = strtolower(pathinfo($fileInDatabase, PATHINFO_EXTENSION));
            
            // For images, create thumbnail
            if(in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])){
                $thumbnailPath = __DIR__ . '/company_files/thumbnails/' . $directory . '_' . $_GET['CustomID'] . '_thumb.jpg';
                
                // Check if thumbnail exists
                if(file_exists($thumbnailPath) && filemtime($thumbnailPath) >= filemtime($filePath)){
                    ob_end_clean();
                    // Set CORS headers before image output
                    $allowedOrigins = [
                        'http://localhost:5174', 
                        'http://127.0.0.1:5174',
                        'http://localhost:5176', 
                        'http://127.0.0.1:5176',
                        'https://ssn.sntrips.com',
                        'http://ssn.sntrips.com',
                        'https://app.sntrips.com',
                        'http://app.sntrips.com'
                    ];
                    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
                    if (in_array($origin, $allowedOrigins)) {
                        header('Access-Control-Allow-Origin: ' . $origin);
                        header('Access-Control-Allow-Credentials: true');
                    }
                    header('Content-Type: image/jpeg');
                    header('Cache-Control: public, max-age=31536000');
                    readfile($thumbnailPath);
                    exit;
                }
                
                // Create thumbnail directory if it doesn't exist
                $thumbDir = __DIR__ . '/company_files/thumbnails';
                if(!is_dir($thumbDir)){
                    @mkdir($thumbDir, 0777, true);
                    @chmod($thumbDir, 0777);
                }
                
                // Generate thumbnail
                $sourceImage = null;
                switch($extension){
                    case 'jpg':
                    case 'jpeg':
                        $sourceImage = imagecreatefromjpeg($filePath);
                        break;
                    case 'png':
                        $sourceImage = imagecreatefrompng($filePath);
                        break;
                    case 'gif':
                        $sourceImage = imagecreatefromgif($filePath);
                        break;
                    case 'webp':
                        $sourceImage = imagecreatefromwebp($filePath);
                        break;
                }
                
                if($sourceImage){
                    $width = imagesx($sourceImage);
                    $height = imagesy($sourceImage);
                    
                    // Calculate thumbnail size (max 200x200)
                    $thumbSize = 200;
                    if($width > $height){
                        $newWidth = $thumbSize;
                        $newHeight = intval($height * ($thumbSize / $width));
                    } else {
                        $newHeight = $thumbSize;
                        $newWidth = intval($width * ($thumbSize / $height));
                    }
                    
                    // Create thumbnail
                    $thumbnail = imagecreatetruecolor($newWidth, $newHeight);
                    
                    // Preserve transparency for PNG
                    if($extension == 'png' || $extension == 'gif'){
                        imagealphablending($thumbnail, false);
                        imagesavealpha($thumbnail, true);
                        $transparent = imagecolorallocatealpha($thumbnail, 255, 255, 255, 127);
                        imagefilledrectangle($thumbnail, 0, 0, $newWidth, $newHeight, $transparent);
                    }
                    
                    imagecopyresampled($thumbnail, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    
                    // Save thumbnail
                    imagejpeg($thumbnail, $thumbnailPath, 85);
                    imagedestroy($sourceImage);
                    imagedestroy($thumbnail);
                    
                    // Output thumbnail
                    ob_end_clean();
                    // Set CORS headers before image output
                    $allowedOrigins = [
                        'http://localhost:5174', 
                        'http://127.0.0.1:5174',
                        'http://localhost:5176', 
                        'http://127.0.0.1:5176',
                        'https://ssn.sntrips.com',
                        'http://ssn.sntrips.com',
                        'https://app.sntrips.com',
                        'http://app.sntrips.com'
                    ];
                    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
                    if (in_array($origin, $allowedOrigins)) {
                        header('Access-Control-Allow-Origin: ' . $origin);
                        header('Access-Control-Allow-Credentials: true');
                    }
                    header('Content-Type: image/jpeg');
                    header('Cache-Control: public, max-age=31536000');
                    readfile($thumbnailPath);
                    exit;
                }
            }
            
            // For PDFs, return first page as image (requires Imagick or similar)
            if($extension == 'pdf'){
                // Try to use Imagick if available
                if(class_exists('Imagick')){
                    try{
                        $imagick = new Imagick();
                        $imagick->setResolution(150, 150);
                        $imagick->readImage($filePath . '[0]'); // First page
                        $imagick->setImageFormat('jpeg');
                        $imagick->thumbnailImage(200, 200, true);
                        
                        ob_end_clean();
                        // Set CORS headers before image output
                        $allowedOrigins = [
                            'http://localhost:5174', 
                            'http://127.0.0.1:5174',
                            'http://localhost:5176', 
                            'http://127.0.0.1:5176',
                            'https://ssn.sntrips.com',
                            'http://ssn.sntrips.com',
                            'https://app.sntrips.com',
                            'http://app.sntrips.com'
                        ];
                        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
                        if (in_array($origin, $allowedOrigins)) {
                            header('Access-Control-Allow-Origin: ' . $origin);
                            header('Access-Control-Allow-Credentials: true');
                        }
                        header('Content-Type: image/jpeg');
                        header('Cache-Control: public, max-age=31536000');
                        echo $imagick->getImageBlob();
                        $imagick->clear();
                        $imagick->destroy();
                        exit;
                    } catch(Exception $e){
                        // Fall through to placeholder
                    }
                }
            }
        }
    }
}

// Return placeholder if file not found or can't generate thumbnail
ob_end_clean();
// Set CORS headers before image output
$allowedOrigins = [
    'http://localhost:5174', 
    'http://127.0.0.1:5174',
    'http://localhost:5176', 
    'http://127.0.0.1:5176',
    'https://ssn.sntrips.com',
    'http://ssn.sntrips.com',
    'https://app.sntrips.com',
    'http://app.sntrips.com'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Content-Type: image/png');
header('Cache-Control: public, max-age=3600');

// Create a simple placeholder image
$placeholder = imagecreatetruecolor(200, 200);
$bgColor = imagecolorallocate($placeholder, 245, 245, 247);
$textColor = imagecolorallocate($placeholder, 142, 142, 147);
imagefilledrectangle($placeholder, 0, 0, 200, 200, $bgColor);
imagestring($placeholder, 5, 50, 90, 'No Preview', $textColor);
imagepng($placeholder);
imagedestroy($placeholder);
exit;

