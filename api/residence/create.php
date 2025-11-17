<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Create New Residence - Complete version matching old app
 * Endpoint: /api/residence/create.php
 * Supports multipart/form-data for file uploads
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
    $sql = "SELECT permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['insert'] == 0) {
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

// Helper function to upload file (matches old app)
function uploadFile($name) {
    global $pdo;
    $new_image_name = '';
    if (isset($_FILES[$name]) && $_FILES[$name]['size'] > 0 && $_FILES[$name]['size'] <= 20971520) { // 20MB limit
        $file_name = $_FILES[$name]['name'];
        $extension = pathinfo($file_name, PATHINFO_EXTENSION);
        $valid_extensions = array('jpg', 'png', 'jpeg', 'doc', 'docx', 'pdf', 'gif', 'txt', 'csv', 'ppt', 'pptx', 'rar', 'xls', 'xlsx', 'zip');
        if (in_array(strtolower($extension), $valid_extensions)) {
            $new_image_name = rand() . '.' . $extension;
            $path = __DIR__ . '/../../residence/' . $new_image_name;
            
            // Ensure residence directory exists
            $upload_dir = __DIR__ . '/../../residence/';
            if (!file_exists($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            
            if (move_uploaded_file($_FILES[$name]['tmp_name'], $path)) {
                return $new_image_name;
            }
        }
    }
    return $new_image_name;
}

try {
    // Get form data (support both JSON and multipart/form-data)
    $customer_id = isset($_POST['customer_id']) ? (int)$_POST['customer_id'] : (isset($_REQUEST['customer_id']) ? (int)$_REQUEST['customer_id'] : null);
    $passenger_name = isset($_POST['passengerName']) ? trim($_POST['passengerName']) : (isset($_REQUEST['passengerName']) ? trim($_REQUEST['passengerName']) : null);
    $nationality = isset($_POST['nationality']) ? (int)$_POST['nationality'] : (isset($_REQUEST['nationality']) ? (int)$_REQUEST['nationality'] : null);
    $passportNumber = isset($_POST['passportNumber']) ? trim($_POST['passportNumber']) : (isset($_REQUEST['passportNumber']) ? trim($_REQUEST['passportNumber']) : null);
    $passportExpiryDate = isset($_POST['passportExpiryDate']) ? $_POST['passportExpiryDate'] : (isset($_REQUEST['passportExpiryDate']) ? $_REQUEST['passportExpiryDate'] : null);
    $gender = isset($_POST['gender']) ? $_POST['gender'] : (isset($_REQUEST['gender']) ? $_REQUEST['gender'] : null);
    $dob = isset($_POST['dob']) ? $_POST['dob'] : (isset($_REQUEST['dob']) ? $_REQUEST['dob'] : null);
    $visaType = isset($_POST['visaType']) ? (int)$_POST['visaType'] : (isset($_REQUEST['visaType']) ? (int)$_REQUEST['visaType'] : 17);
    $sale_amount = isset($_POST['sale_amount']) ? (float)$_POST['sale_amount'] : (isset($_REQUEST['sale_amount']) ? (float)$_REQUEST['sale_amount'] : null);
    $sale_currency_type = isset($_POST['sale_currency_type']) ? (int)$_POST['sale_currency_type'] : (isset($_REQUEST['sale_currency_type']) ? (int)$_REQUEST['sale_currency_type'] : null);
    $insideOutside = isset($_POST['insideOutside']) ? $_POST['insideOutside'] : (isset($_REQUEST['insideOutside']) ? $_REQUEST['insideOutside'] : null);
    $uid = isset($_POST['uid']) ? trim($_POST['uid']) : (isset($_REQUEST['uid']) ? trim($_REQUEST['uid']) : null);
    $salary_amount = isset($_POST['salary_amount']) ? (float)$_POST['salary_amount'] : (isset($_REQUEST['salary_amount']) ? (float)$_REQUEST['salary_amount'] : null);
    $position = isset($_POST['position']) ? (int)$_POST['position'] : (isset($_REQUEST['position']) ? (int)$_REQUEST['position'] : 0);
    $res_type = isset($_POST['res_type']) ? $_POST['res_type'] : (isset($_REQUEST['res_type']) ? $_REQUEST['res_type'] : 'mainland');
    $tawjeeh_included = isset($_POST['tawjeeh_included']) ? (int)$_POST['tawjeeh_included'] : (isset($_REQUEST['tawjeeh_included']) ? (int)$_REQUEST['tawjeeh_included'] : 0);
    $insurance_included = isset($_POST['insurance_included']) ? (int)$_POST['insurance_included'] : (isset($_REQUEST['insurance_included']) ? (int)$_REQUEST['insurance_included'] : 0);
    
    // Validate required fields
    if (!$customer_id || !$passenger_name || !$nationality || !$passportNumber || !$passportExpiryDate || 
        !$gender || !$dob || !$sale_amount || !$sale_currency_type || !$insideOutside || !$salary_amount) {
        JWTHelper::sendResponse(400, false, 'Missing required fields');
    }
    
    // Normalize date fields to full format if only year provided
    if (preg_match('/^\d{4}$/', $passportExpiryDate)) {
        $passportExpiryDate = $passportExpiryDate . '-01-01';
    }
    if (preg_match('/^\d{4}$/', $dob)) {
        $dob = $dob . '-01-01';
    }
    
    // Start transaction
    $pdo->beginTransaction();
    
    // Check for duplicate active residence (matching old app logic)
    $checkDuplicateSql = "SELECT residenceID, current_status, passenger_name FROM `residence` 
                          WHERE LOWER(TRIM(passenger_name)) = LOWER(TRIM(:passenger_name)) 
                          AND LOWER(TRIM(passportNumber)) = LOWER(TRIM(:passportNumber)) 
                          AND current_status = 'active'";
    $checkStmt = $pdo->prepare($checkDuplicateSql);
    $checkStmt->bindParam(':passenger_name', $passenger_name);
    $checkStmt->bindParam(':passportNumber', $passportNumber);
    $checkStmt->execute();
    
    $existingRecord = $checkStmt->fetch(PDO::FETCH_ASSOC);
    if ($existingRecord) {
        $pdo->rollback();
        JWTHelper::sendResponse(409, false, 'DUPLICATE_ACTIVE|' . $existingRecord['residenceID'] . '|' . $existingRecord['passenger_name']);
    }
    
    // Upload files
    $image = '';
    if (isset($_FILES['basicInfoFile']) && $_FILES['basicInfoFile']['size'] > 0) {
        $image = uploadFile('basicInfoFile');
        if ($image == '') {
            $pdo->rollback();
            JWTHelper::sendResponse(400, false, 'Failed to upload passport file');
        }
    }
    
    $imagePhoto = '';
    if (isset($_FILES['basicInfoFilePhoto']) && $_FILES['basicInfoFilePhoto']['size'] > 0) {
        $imagePhoto = uploadFile('basicInfoFilePhoto');
    }
    
    $imageIDFront = '';
    if (isset($_FILES['basicInfoFileIDFront']) && $_FILES['basicInfoFileIDFront']['size'] > 0) {
        $imageIDFront = uploadFile('basicInfoFileIDFront');
    }
    
    $imageIDBack = '';
    if (isset($_FILES['basicInfoFileIDBack']) && $_FILES['basicInfoFileIDBack']['size'] > 0) {
        $imageIDBack = uploadFile('basicInfoFileIDBack');
    }
    
    // Insert residence record
    $sql = "INSERT INTO `residence`
            (`customer_id`, `passenger_name`, `Nationality`, `passportNumber`, `passportExpiryDate`, `VisaType`, `sale_price`,
            `saleCurID`, `StepOneUploader`, `completedStep`,`status`,InsideOutside,`uid`,`salary_amount`,`positionID`, `gender`,`dob`,`res_type`) 
            VALUES(:customer_id,:passenger_name,:Nationality, :passportNumber, :passportExpiryDate,
            :VisaType,:sale_price,:saleCurID,:StepOneUploader,:completedStep,:status, :insideOutside,:uid,:salary_amount,:positionID, :gender,:dob,:res_type)";
    
    $stmt = $pdo->prepare($sql);
    $stepCompleted = 1;
    $status = 1;
    
    $stmt->bindParam(':customer_id', $customer_id);
    $stmt->bindParam(':passenger_name', $passenger_name);
    $stmt->bindParam(':Nationality', $nationality);
    $stmt->bindParam(':VisaType', $visaType);
    $stmt->bindParam(':sale_price', $sale_amount);
    $stmt->bindParam(':saleCurID', $sale_currency_type);
    $stmt->bindParam(':StepOneUploader', $staff_id);
    $stmt->bindParam(':passportNumber', $passportNumber);
    $stmt->bindParam(':passportExpiryDate', $passportExpiryDate);
    $stmt->bindParam(':insideOutside', $insideOutside);
    $stmt->bindParam(':uid', $uid);
    $stmt->bindParam(':salary_amount', $salary_amount);
    $stmt->bindParam(':positionID', $position);
    $stmt->bindParam(':gender', $gender);
    $stmt->bindParam(':dob', $dob);
    $stmt->bindParam(':res_type', $res_type);
    $stmt->bindParam(':completedStep', $stepCompleted);
    $stmt->bindParam(':status', $status);
    
    $stmt->execute();
    $residenceID = $pdo->lastInsertId();
    
    // Save passport file (fileType = 1)
    if ($image != '') {
        $filetype = '1';
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $image);
        $original_name = isset($_FILES['basicInfoFile']['name']) ? $_FILES['basicInfoFile']['name'] : 'passport.pdf';
        $fileStmt->bindParam(':original_name', $original_name);
        $fileStmt->bindParam(':fileType', $filetype);
        $fileStmt->execute();
    }
    
    // Save photo file (fileType = 11)
    if ($imagePhoto != '') {
        $filetype = 11;
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $imagePhoto);
        $original_name = isset($_FILES['basicInfoFilePhoto']['name']) ? $_FILES['basicInfoFilePhoto']['name'] : 'photo.jpg';
        $fileStmt->bindParam(':original_name', $original_name);
        $fileStmt->bindParam(':fileType', $filetype);
        $fileStmt->execute();
    }
    
    // Save Emirates ID Front (fileType = 12)
    if ($imageIDFront != '') {
        $filetype = 12;
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $imageIDFront);
        $original_name = isset($_FILES['basicInfoFileIDFront']['name']) ? $_FILES['basicInfoFileIDFront']['name'] : 'emirates_id_front.jpg';
        $fileStmt->bindParam(':original_name', $original_name);
        $fileStmt->bindParam(':fileType', $filetype);
        $fileStmt->execute();
    }
    
    // Save Emirates ID Back (fileType = 13)
    if ($imageIDBack != '') {
        $filetype = 13;
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $imageIDBack);
        $original_name = isset($_FILES['basicInfoFileIDBack']['name']) ? $_FILES['basicInfoFileIDBack']['name'] : 'emirates_id_back.jpg';
        $fileStmt->bindParam(':original_name', $original_name);
        $fileStmt->bindParam(':fileType', $filetype);
        $fileStmt->execute();
    }
    
    // Create residence_charges entry for TAWJEEH/Insurance settings
    $checkChargesSQL = "SELECT id FROM residence_charges WHERE residence_id = :residence_id";
    $checkChargesStmt = $pdo->prepare($checkChargesSQL);
    $checkChargesStmt->bindParam(':residence_id', $residenceID);
    $checkChargesStmt->execute();
    
    if ($checkChargesStmt->rowCount() == 0) {
        $insertChargesSQL = "INSERT INTO residence_charges 
                            (residence_id, tawjeeh_included_in_sale, insurance_included_in_sale, tawjeeh_amount, insurance_amount) 
                            VALUES (:residence_id, :tawjeeh_included, :insurance_included, 150, 126)";
        $insertChargesStmt = $pdo->prepare($insertChargesSQL);
        $insertChargesStmt->bindParam(':residence_id', $residenceID);
        $insertChargesStmt->bindParam(':tawjeeh_included', $tawjeeh_included);
        $insertChargesStmt->bindParam(':insurance_included', $insurance_included);
        $insertChargesStmt->execute();
    } else {
        $updateChargesSQL = "UPDATE residence_charges SET 
                            tawjeeh_included_in_sale = :tawjeeh_included,
                            insurance_included_in_sale = :insurance_included
                            WHERE residence_id = :residence_id";
        $updateChargesStmt = $pdo->prepare($updateChargesSQL);
        $updateChargesStmt->bindParam(':residence_id', $residenceID);
        $updateChargesStmt->bindParam(':tawjeeh_included', $tawjeeh_included);
        $updateChargesStmt->bindParam(':insurance_included', $insurance_included);
        $updateChargesStmt->execute();
    }
    
    $pdo->commit();
    
    JWTHelper::sendResponse(201, true, 'Residence created successfully', [
        'residenceID' => $residenceID
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Create residence error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error creating residence: ' . $e->getMessage());
}













