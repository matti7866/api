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

$action = $_POST['action'] ?? '';

if (!in_array($action, ['seteVisa', 'seteVisaAccept', 'rejectEVisa', 'setChangeStatus', 'setMedical', 'setEmiratesID', 'setVisaStamping', 'addFreezoneResidence'])) {
    JWTHelper::sendResponse(400, false, 'Invalid action');
}

try {
    function uploadFile($name, $id, $filetype, $pdo, $userData = null) {
        if (!isset($_FILES[$name]) || $_FILES[$name]['error'] !== UPLOAD_ERR_OK) {
            return '';
        }
        
        $file = $_FILES[$name];
        if ($file['size'] > 2097152) { // 2MB limit
            return '';
        }
        
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $valid_extensions = ['jpg', 'png', 'jpeg', 'doc', 'docx', 'pdf', 'gif', 'txt', 'csv', 'ppt', 'pptx', 'rar', 'xls', 'xlsx', 'zip'];
        
        if (!in_array(strtolower($extension), $valid_extensions)) {
            return '';
        }
        
        $new_image_name = rand() . '.' . $extension;
        $path = __DIR__ . "/../../../freezoneFiles/" . $new_image_name;
        
        $uploadDir = dirname($path);
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        if (move_uploaded_file($file['tmp_name'], $path)) {
            global $userData;
            $userID = isset($userData) ? ($userData['user_id'] ?? $userData['staff_id'] ?? 0) : 0;
            
            $fileStmt = $pdo->prepare("INSERT INTO `freezonedocuments` (`freezoneID`, `file_name`, `original_name`, `fileType`, `uploaded_by`) 
                        VALUES (:ResID, :file_name, :original_name, :fileType, :uploaded_by)");
            $fileStmt->bindParam(':ResID', $id);
            $fileStmt->bindParam(':file_name', $new_image_name);
            $fileStmt->bindParam(':original_name', $file['name']);
            $fileStmt->bindParam(':fileType', $filetype);
            $fileStmt->bindParam(':uploaded_by', $userID);
            $fileStmt->execute();
            
            return $pdo->lastInsertId();
        }
        
        return '';
    }
    
    if ($action == 'seteVisa') {
        $companyID = $_POST['companyID'] ?? '';
        $eVisaPositionID = $_POST['eVisaPositionID'] ?? '';
        $eVisaCost = $_POST['eVisaCost'] ?? '4020';
        $eVisaAccountID = $_POST['eVisaAccountID'] ?? '';
        $eVisaCurrencyID = $_POST['eVisaCurrencyID'] ?? '';
        $id = $_POST['id'] ?? '';
        
        if (empty($companyID) || empty($eVisaPositionID) || empty($id)) {
            JWTHelper::sendResponse(400, false, 'Company, Position, and ID are required');
        }
        
        if (empty($eVisaAccountID)) {
            JWTHelper::sendResponse(400, false, 'Account is required');
        }
        
        if (empty($eVisaCurrencyID)) {
            JWTHelper::sendResponse(400, false, 'Currency is required');
        }
        
        $stmt = $pdo->prepare("
            UPDATE residence SET
                `company` = :companyID,
                `positionID` = :eVisaPositionID,
                `eVisaCost` = :eVisaCost,
                `eVisaAccount` = :eVisaAccountID,
                `eVisaCur` = :eVisaCurrencyID,
                `eVisaStatus` = 'submitted',
                `eVisaDate` = NOW(),
                `completedStep` = 1
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':companyID', $companyID);
        $stmt->bindParam(':eVisaPositionID', $eVisaPositionID);
        $stmt->bindParam(':eVisaCost', $eVisaCost);
        $stmt->bindParam(':eVisaAccountID', $eVisaAccountID);
        $stmt->bindParam(':eVisaCurrencyID', $eVisaCurrencyID);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'eVisa set successfully');
    }
    
    if ($action == 'rejectEVisa') {
        $id = $_POST['id'] ?? '';
        
        if (empty($id)) {
            JWTHelper::sendResponse(400, false, 'ID is required');
        }
        
        $stmt = $pdo->prepare("UPDATE residence SET `evisaStatus` = 'pending' WHERE `id` = :id AND `type` = 'Freezone'");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'eVisa rejected successfully');
    }
    
    if ($action == 'seteVisaAccept') {
        $id = $_POST['id'] ?? '';
        
        if (empty($id)) {
            JWTHelper::sendResponse(400, false, 'ID is required');
        }
        
        $residence = $pdo->prepare("SELECT * FROM residence WHERE residenceID = :id AND res_type = 'Freezone'");
        $residence->bindParam(':id', $id);
        $residence->execute();
        $residenceData = $residence->fetch(PDO::FETCH_ASSOC);
        
        // For freezone, after eVisa approval, move to step 2 (Change Status)
        $nextStatus = 2;
        // Upload file to freezonedocuments table (file is stored there, not in residence table)
        uploadFile('eVisaFile', $id, 'eVisa', $pdo, $userData);
        
        $stmt = $pdo->prepare("
            UPDATE residence SET 
                `eVisaStatus` = 'accepted',
                `completedStep` = :nextStatus
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':nextStatus', $nextStatus);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'eVisa accepted successfully');
    }
    
    if ($action == 'setChangeStatus') {
        $id = $_POST['id'] ?? '';
        $changeStatusCost = $_POST['changeStatusCost'] ?? '1520';
        $changeStatusAccountType = $_POST['changeStatusAccountType'] ?? '1';
        $changeStatusAccountID = $_POST['changeStatusAccountID'] ?? '';
        $changeStatusSupplierID = $_POST['changeStatusSupplierID'] ?? '';
        $changeStatusCurrencyID = $_POST['changeStatusCurrencyID'] ?? '';
        
        if (empty($id) || empty($changeStatusCost)) {
            JWTHelper::sendResponse(400, false, 'ID and Cost are required');
        }
        
        if (empty($changeStatusCurrencyID)) {
            JWTHelper::sendResponse(400, false, 'Currency is required');
        }
        
        if ($changeStatusAccountType == '1' && empty($changeStatusAccountID)) {
            JWTHelper::sendResponse(400, false, 'Account is required');
        }
        
        if ($changeStatusAccountType == '2' && empty($changeStatusSupplierID)) {
            JWTHelper::sendResponse(400, false, 'Supplier is required');
        }
        
        // Upload file to freezonedocuments table
        uploadFile('changeStatusFile', $id, 'changeStatus', $pdo, $userData);
        $accountID = ($changeStatusAccountType == '1') ? $changeStatusAccountID : $changeStatusSupplierID;
        $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
        
        $stmt = $pdo->prepare("
            UPDATE residence SET 
                `changeStatusCost` = :changeStatusCost,
                `changeStatusAccount` = :changeStatusCostAccount,
                `changeStatusCur` = :changeStatusCurrencyID,
                `changeStatusDate` = NOW(),
                `completedStep` = 3
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':changeStatusCost', $changeStatusCost);
        $stmt->bindParam(':changeStatusCostAccount', $accountID);
        $stmt->bindParam(':changeStatusCurrencyID', $changeStatusCurrencyID);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'Status changed successfully');
    }
    
    if ($action == 'setMedical') {
        $id = $_POST['id'] ?? '';
        $medicalCost = $_POST['medicalCost'] ?? '275';
        $medicalAccountID = $_POST['medicalAccountID'] ?? '';
        $medicalCurrencyID = $_POST['medicalCurrencyID'] ?? '';
        
        if (empty($id) || empty($medicalCost)) {
            JWTHelper::sendResponse(400, false, 'ID and Cost are required');
        }
        
        if (empty($medicalAccountID)) {
            JWTHelper::sendResponse(400, false, 'Account is required');
        }
        
        if (empty($medicalCurrencyID)) {
            JWTHelper::sendResponse(400, false, 'Currency is required');
        }
        
        // Upload file to freezonedocuments table
        uploadFile('medicalFile', $id, 'medical', $pdo, $userData);
        $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
        
        $stmt = $pdo->prepare("
            UPDATE residence SET 
                `medicalTCost` = :medicalCost,
                `medicalAccount` = :medicalAccountID,
                `medicalTCur` = :medicalCurrencyID,
                `medicalDate` = NOW(),
                `completedStep` = 4
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':medicalCost', $medicalCost);
        $stmt->bindParam(':medicalAccountID', $medicalAccountID);
        $stmt->bindParam(':medicalCurrencyID', $medicalCurrencyID);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'Medical set successfully');
    }
    
    if ($action == 'setEmiratesID') {
        $id = $_POST['id'] ?? '';
        $emiratesIDCost = $_POST['emiratesIDCost'] ?? '375';
        $emiratesIDAccountID = $_POST['emiratesIDAccountID'] ?? '';
        $emiratesIDCurrencyID = $_POST['emiratesIDCurrencyID'] ?? '';
        
        if (empty($id) || empty($emiratesIDCost)) {
            JWTHelper::sendResponse(400, false, 'ID and Cost are required');
        }
        
        if (empty($emiratesIDAccountID)) {
            JWTHelper::sendResponse(400, false, 'Account is required');
        }
        
        if (empty($emiratesIDCurrencyID)) {
            JWTHelper::sendResponse(400, false, 'Currency is required');
        }
        
        // Upload file to freezonedocuments table
        uploadFile('emiratesIDFile', $id, 'emiratesID', $pdo, $userData);
        $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
        
        $stmt = $pdo->prepare("
            UPDATE residence SET 
                `emiratesIDCost` = :emiratesIDCost,
                `emiratesIDAccount` = :emiratesIDAccountID,
                `emiratesIDCur` = :emiratesIDCurrencyID,
                `emiratesIDDate` = NOW(),
                `completedStep` = 5
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':emiratesIDCost', $emiratesIDCost);
        $stmt->bindParam(':emiratesIDAccountID', $emiratesIDAccountID);
        $stmt->bindParam(':emiratesIDCurrencyID', $emiratesIDCurrencyID);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'Emirates ID set successfully');
    }
    
    if ($action == 'setVisaStamping') {
        $id = $_POST['id'] ?? '';
        $emiratesIDNumber = $_POST['emiratesIDNumber'] ?? '';
        $visaExpiryDate = $_POST['visaExpiryDate'] ?? '';
        
        if (empty($id) || empty($emiratesIDNumber) || empty($visaExpiryDate)) {
            JWTHelper::sendResponse(400, false, 'ID, Emirates ID Number, and Visa Expiry Date are required');
        }
        
        $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
        
        $stmt = $pdo->prepare("
            UPDATE residence SET 
                `visaStampingDate` = NOW(),
                `visaStampingStaffID` = :visaStampingStaffID,
                `eidNumber` = :emiratesIDNumber,
                `visaExpiryDate` = :visaExpiryDate,
                `completedStep` = 6
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':visaStampingStaffID', $userID);
        $stmt->bindParam(':emiratesIDNumber', $emiratesIDNumber);
        $stmt->bindParam(':visaExpiryDate', $visaExpiryDate);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'Visa stamping set successfully');
    }
    
    if ($action == 'addFreezoneResidence') {
        $customerID = $_POST['customerID'] ?? '';
        $uid = $_POST['uid'] ?? '';
        $passportNumber = $_POST['passportNumber'] ?? '';
        $passportExpiryDate = $_POST['passportExpiryDate'] ?? '';
        $passangerName = $_POST['passangerName'] ?? '';
        $nationality = $_POST['nationality'] ?? '';
        $gender = $_POST['gender'] ?? '';
        $dob = $_POST['dob'] ?? '';
        $insideOutside = $_POST['insideOutside'] ?? '';
        $positionID = $_POST['positionID'] ?? '';
        $salary = $_POST['salary'] ?? '';
        $salePrice = $_POST['salePrice'] ?? '';
        $saleCurrency = $_POST['saleCurrency'] ?? '';
        
        $errors = [];
        if (empty($customerID)) $errors['customerID'] = 'Customer is required';
        if (empty($uid)) $errors['uid'] = 'UID is required';
        if (empty($passportNumber)) $errors['passportNumber'] = 'Passport number is required';
        if (empty($passportExpiryDate)) $errors['passportExpiryDate'] = 'Passport expiry date is required';
        if (empty($passangerName)) $errors['passangerName'] = 'Passenger name is required';
        if (empty($nationality)) $errors['nationality'] = 'Nationality is required';
        if (empty($gender)) $errors['gender'] = 'Gender is required';
        if (empty($dob)) $errors['dob'] = 'Date of birth is required';
        if (empty($insideOutside)) $errors['insideOutside'] = 'Inside/Outside is required';
        if (empty($positionID)) $errors['positionID'] = 'Position is required';
        if (empty($salary)) $errors['salary'] = 'Salary is required';
        if (empty($salePrice)) $errors['salePrice'] = 'Sale price is required';
        if (empty($saleCurrency)) $errors['saleCurrency'] = 'Sale currency is required';
        
        if (!isset($_FILES['passportFile']) || $_FILES['passportFile']['error'] !== UPLOAD_ERR_OK) {
            $errors['passportFile'] = 'Passport file is required';
        }
        if (!isset($_FILES['photoFile']) || $_FILES['photoFile']['error'] !== UPLOAD_ERR_OK) {
            $errors['photoFile'] = 'Photo file is required';
        }
        
        if (!empty($errors)) {
            JWTHelper::sendResponse(400, false, 'Validation errors', $errors);
        }
        
        $userID = $userData['user_id'] ?? $userData['staff_id'] ?? 0;
        
        $stmt = $pdo->prepare("
            INSERT INTO residence SET
                `res_type` = 'Freezone',
                `customer_id` = :customerID,
                `uid` = :uid,
                `passenger_name` = :passangerName,
                `passportNumber` = :passportNumber,
                `passportExpiryDate` = :passportExpiryDate,
                `Nationality` = :nationality,
                `dob` = :dob,
                `gender` = :gender,
                `insideOutside` = :insideOutside,
                `positionID` = :positionID,
                `salary` = :salary,
                `salePrice` = :salePrice,
                `saleCurrency` = :saleCurrency,
                `completedStep` = 1,
                `added_by` = :addedBy
        ");
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':uid', $uid);
        $stmt->bindParam(':passangerName', $passangerName);
        $stmt->bindParam(':passportNumber', $passportNumber);
        $stmt->bindParam(':passportExpiryDate', $passportExpiryDate);
        $stmt->bindParam(':nationality', $nationality);
        $stmt->bindParam(':dob', $dob);
        $stmt->bindParam(':gender', $gender);
        $stmt->bindParam(':insideOutside', $insideOutside);
        $stmt->bindParam(':positionID', $positionID);
        $stmt->bindParam(':salary', $salary);
        $stmt->bindParam(':salePrice', $salePrice);
        $stmt->bindParam(':saleCurrency', $saleCurrency);
        $stmt->bindParam(':addedBy', $userID);
        $stmt->execute();
        
        $lastInsertId = $pdo->lastInsertId();
        
        // Upload files
        $passportFileId = uploadFile('passportFile', $lastInsertId, 'passport', $pdo);
        $photoFileId = uploadFile('photoFile', $lastInsertId, 'photo', $pdo);
        $idFrontFileId = uploadFile('idFrontFile', $lastInsertId, 'idFront', $pdo);
        $idBackFileId = uploadFile('idBackFile', $lastInsertId, 'idBack', $pdo);
        
        // Update file IDs
        $stmt = $pdo->prepare("
            UPDATE residence SET
                `passportFile` = :passportFile,
                `photoFile` = :photoFile,
                `idFrontFile` = :idFrontFile,
                `idBackFile` = :idBackFile
            WHERE `residenceID` = :id AND `res_type` = 'Freezone'
        ");
        $stmt->bindParam(':passportFile', $passportFileId);
        $stmt->bindParam(':photoFile', $photoFileId);
        $stmt->bindParam(':idFrontFile', $idFrontFileId);
        $stmt->bindParam(':idBackFile', $idBackFileId);
        $stmt->bindParam(':id', $lastInsertId);
        $stmt->execute();
        
        JWTHelper::sendResponse(200, true, 'Freezone residence added successfully', ['id' => $lastInsertId]);
    }
    
} catch (Exception $e) {
    error_log("Error in freezone/tasks-controller.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

