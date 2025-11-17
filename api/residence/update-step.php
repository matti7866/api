<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Update Residence Step - Comprehensive version matching old residenceController.php
 * Endpoint: /api/residence/update-step.php
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

// Helper function to save/update document
function saveDocument($residenceID, $fileName, $originalName, $fileType) {
    global $pdo;
    
    // Check if document already exists
    $checkStmt = $pdo->prepare("SELECT * FROM `residencedocuments` WHERE ResID = :ResID AND fileType = :fileType");
    $checkStmt->bindParam(':ResID', $residenceID);
    $checkStmt->bindParam(':fileType', $fileType);
    $checkStmt->execute();
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) {
        // Delete old file
        if (file_exists(__DIR__ . '/../../residence/' . $existing['file_name'])) {
            unlink(__DIR__ . '/../../residence/' . $existing['file_name']);
        }
        // Update existing record
        $fileSql = "UPDATE `residencedocuments` SET `file_name` = :file_name, `original_name` = :original_name WHERE ResID = :ResID AND fileType = :fileType";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $fileName);
        $fileStmt->bindParam(':original_name', $originalName);
        $fileStmt->bindParam(':fileType', $fileType);
        $fileStmt->execute();
    } else {
        // Insert new record
        $fileSql = "INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)";
        $fileStmt = $pdo->prepare($fileSql);
        $fileStmt->bindParam(':ResID', $residenceID);
        $fileStmt->bindParam(':file_name', $fileName);
        $fileStmt->bindParam(':original_name', $originalName);
        $fileStmt->bindParam(':fileType', $fileType);
        $fileStmt->execute();
    }
}

// Get request data (support both JSON and multipart/form-data)
$residenceID = isset($_POST['residenceID']) ? (int)$_POST['residenceID'] : (isset($_POST['ID']) ? (int)$_POST['ID'] : (isset($_REQUEST['residenceID']) ? (int)$_REQUEST['residenceID'] : 0));
$step = isset($_POST['step']) ? (int)$_POST['step'] : (isset($_REQUEST['step']) ? (int)$_REQUEST['step'] : 0);
$markComplete = isset($_POST['markComplete']) ? (bool)$_POST['markComplete'] : (isset($_POST['Type']) && $_POST['Type'] === 'active');

if (!$residenceID || !$step) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID and step');
}

try {
    $pdo->beginTransaction();
    
    // Step 1: Offer Letter (matches React StepWorkflow where Step 1 is Offer Letter)
    if ($step == 1) {
        $salary_amount = isset($_POST['salary_amount']) ? (float)$_POST['salary_amount'] : null;
        $salaryCurID = isset($_POST['salaryCur']) ? (int)$_POST['salaryCur'] : null;
        $positionID = isset($_POST['position']) ? (int)$_POST['position'] : null;
        $company = isset($_POST['company']) ? (int)$_POST['company'] : null;
        $offerLetterCost = isset($_POST['offerLetterCost']) ? (float)$_POST['offerLetterCost'] : null;
        $offerLetterCostCur = isset($_POST['offerLetterCostCur']) ? (int)$_POST['offerLetterCostCur'] : null;
        $mb_number = isset($_POST['mb_number']) ? trim($_POST['mb_number']) : null;
        
        // Handle charged entity (Account or Supplier)
        $offerLetterSupplier = null;
        $offerLetterAccount = null;
        $chargedOpt = isset($_POST['offerLChargOpt']) ? (int)$_POST['offerLChargOpt'] : null;
        $chargedEntity = isset($_POST['offerLChargedEntity']) ? (int)$_POST['offerLChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $offerLetterAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $offerLetterSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                salary_amount=:salary_amount,
                salaryCurID=:salaryCurID,
                positionID=:positionID,
                company=:company,
                offerLetterCost=:offerLetterCost,
                offerLetterCostCur=:offerLetterCostCur,
                offerLetterSupplier=:offerLetterSupplier,
                offerLetterAccount=:offerLetterAccount,
                stepTwoUploder=:stepTwoUploder,
                mb_number=:mb_number,
                offerLetterStatus='submitted',
                offerLetterDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=2";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':salary_amount', $salary_amount);
        $stmt->bindParam(':salaryCurID', $salaryCurID);
        $stmt->bindParam(':positionID', $positionID);
        $stmt->bindParam(':company', $company);
        $stmt->bindParam(':offerLetterCost', $offerLetterCost);
        $stmt->bindParam(':offerLetterCostCur', $offerLetterCostCur);
        $stmt->bindParam(':offerLetterSupplier', $offerLetterSupplier);
        $stmt->bindParam(':offerLetterAccount', $offerLetterAccount);
        $stmt->bindParam(':stepTwoUploder', $staff_id);
        $stmt->bindParam(':mb_number', $mb_number);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['offerLetterFile']) && $_FILES['offerLetterFile']['size'] > 0) {
            $image = uploadFile('offerLetterFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['offerLetterFile']['name'], 2);
            }
        }
    }
    
    // Step 2: Insurance
    elseif ($step == 2) {
        $insuranceCost = isset($_POST['insuranceCost']) ? (float)$_POST['insuranceCost'] : null;
        $insuranceCur = isset($_POST['insuranceCur']) ? (int)$_POST['insuranceCur'] : null;
        
        // Handle charged entity
        $insuranceSupplier = null;
        $insuranceAccount = null;
        $chargedOpt = isset($_POST['insuranceChargOpt']) ? (int)$_POST['insuranceChargOpt'] : null;
        $chargedEntity = isset($_POST['insuranceChargedEntity']) ? (int)$_POST['insuranceChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $insuranceAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $insuranceSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                insuranceCost=:insuranceCost,
                insuranceCur=:insuranceCur,
                insuranceSupplier=:insuranceSupplier,
                insuranceAccount=:insuranceAccount,
                stepThreeUploader=:stepThreeUploader,
                insuranceDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=3";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':insuranceCost', $insuranceCost);
        $stmt->bindParam(':insuranceCur', $insuranceCur);
        $stmt->bindParam(':insuranceSupplier', $insuranceSupplier);
        $stmt->bindParam(':insuranceAccount', $insuranceAccount);
        $stmt->bindParam(':stepThreeUploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['insuranceFile']) && $_FILES['insuranceFile']['size'] > 0) {
            $image = uploadFile('insuranceFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['insuranceFile']['name'], 3);
            }
        }
    }
    
    // Step 3: Labor Card
    elseif ($step == 3) {
        $laborCardID = isset($_POST['labor_card_id']) ? trim($_POST['labor_card_id']) : null;
        $laborCardFee = isset($_POST['labour_card_fee']) ? (float)$_POST['labour_card_fee'] : null;
        $laborCardCur = isset($_POST['laborCardCur']) ? (int)$_POST['laborCardCur'] : null;
        
        // Handle charged entity
        $laborCardSupplier = null;
        $laborCardAccount = null;
        $chargedOpt = isset($_POST['lrbChargOpt']) ? (int)$_POST['lrbChargOpt'] : null;
        $chargedEntity = isset($_POST['lbrChargedEntity']) ? (int)$_POST['lbrChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $laborCardAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $laborCardSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                laborCardID=:laborCardID,
                laborCardFee=:laborCardFee,
                laborCardCur=:laborCardCur,
                laborCardSupplier=:laborCardSupplier,
                laborCardAccount=:laborCardAccount,
                stepfourUploader=:stepfourUploader,
                laborCardDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=4";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':laborCardID', $laborCardID);
        $stmt->bindParam(':laborCardFee', $laborCardFee);
        $stmt->bindParam(':laborCardCur', $laborCardCur);
        $stmt->bindParam(':laborCardSupplier', $laborCardSupplier);
        $stmt->bindParam(':laborCardAccount', $laborCardAccount);
        $stmt->bindParam(':stepfourUploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['laborCardFile']) && $_FILES['laborCardFile']['size'] > 0) {
            $image = uploadFile('laborCardFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['laborCardFile']['name'], 4);
            }
        }
    }
    
    // Step 4: E-Visa
    elseif ($step == 4) {
        $eVisaCost = isset($_POST['evisa_cost']) ? (float)$_POST['evisa_cost'] : null;
        $eVisaCur = isset($_POST['eVisaCostCur']) ? (int)$_POST['eVisaCostCur'] : null;
        
        // Handle charged entity
        $eVisaSupplier = null;
        $eVisaAccount = null;
        $chargedOpt = isset($_POST['eVisaTChargOpt']) ? (int)$_POST['eVisaTChargOpt'] : null;
        $chargedEntity = isset($_POST['eVisaTChargedEntity']) ? (int)$_POST['eVisaTChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $eVisaAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $eVisaSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                eVisaCost=:eVisaCost,
                eVisaCur=:eVisaCur,
                eVisaSupplier=:eVisaSupplier,
                eVisaAccount=:eVisaAccount,
                eVisaStatus='submitted',
                stepfiveUploader=:stepfiveUploader,
                eVisaDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=5";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':eVisaCost', $eVisaCost);
        $stmt->bindParam(':eVisaCur', $eVisaCur);
        $stmt->bindParam(':eVisaSupplier', $eVisaSupplier);
        $stmt->bindParam(':eVisaAccount', $eVisaAccount);
        $stmt->bindParam(':stepfiveUploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['eVisaFile']) && $_FILES['eVisaFile']['size'] > 0) {
            $image = uploadFile('eVisaFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['eVisaFile']['name'], 5);
            }
        }
    }
    
    // Step 5: Change Status
    elseif ($step == 5) {
        $changeStatusCost = isset($_POST['changeStatusCost']) ? (float)$_POST['changeStatusCost'] : null;
        $changeStatusCur = isset($_POST['changeStatusCur']) ? (int)$_POST['changeStatusCur'] : null;
        
        // Handle charged entity
        $changeStatusSupplier = null;
        $changeStatusAccount = null;
        $chargedOpt = isset($_POST['changeSChargOpt']) ? (int)$_POST['changeSChargOpt'] : null;
        $chargedEntity = isset($_POST['changeSChargedEntity']) ? (int)$_POST['changeSChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $changeStatusAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $changeStatusSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                changeStatusCost=:changeStatusCost,
                changeStatusCur=:changeStatusCur,
                changeStatusSupplier=:changeStatusSupplier,
                changeStatusAccount=:changeStatusAccount,
                stepsixUploader=:stepsixUploader,
                changeStatusDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=6";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':changeStatusCost', $changeStatusCost);
        $stmt->bindParam(':changeStatusCur', $changeStatusCur);
        $stmt->bindParam(':changeStatusSupplier', $changeStatusSupplier);
        $stmt->bindParam(':changeStatusAccount', $changeStatusAccount);
        $stmt->bindParam(':stepsixUploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['changeStatusFile']) && $_FILES['changeStatusFile']['size'] > 0) {
            $image = uploadFile('changeStatusFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['changeStatusFile']['name'], 6);
            }
        }
    }
    
    // Step 6: Medical
    elseif ($step == 6) {
        $medicalTCost = isset($_POST['medical_cost']) ? (float)$_POST['medical_cost'] : null;
        $medicalTCur = isset($_POST['medicalCostCur']) ? (int)$_POST['medicalCostCur'] : null;
        
        // Handle charged entity
        $medicalSupplier = null;
        $medicalAccount = null;
        $chargedOpt = isset($_POST['medicalTChargOpt']) ? (int)$_POST['medicalTChargOpt'] : null;
        $chargedEntity = isset($_POST['medicalTChargedEntity']) ? (int)$_POST['medicalTChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $medicalAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $medicalSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                medicalTCost=:medicalTCost,
                medicalTCur=:medicalTCur,
                medicalSupplier=:medicalSupplier,
                medicalAccount=:medicalAccount,
                stepsevenUpploader=:stepsevenUpploader,
                medicalDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=7";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':medicalTCost', $medicalTCost);
        $stmt->bindParam(':medicalTCur', $medicalTCur);
        $stmt->bindParam(':medicalSupplier', $medicalSupplier);
        $stmt->bindParam(':medicalAccount', $medicalAccount);
        $stmt->bindParam(':stepsevenUpploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['medicalFile']) && $_FILES['medicalFile']['size'] > 0) {
            $image = uploadFile('medicalFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['medicalFile']['name'], 7);
            }
        }
    }
    
    // Step 7: Emirates ID
    elseif ($step == 7) {
        $emiratesIDCost = isset($_POST['emiratesIDCost']) ? (float)$_POST['emiratesIDCost'] : null;
        $emiratesIDCur = isset($_POST['emiratesIDCostCur']) ? (int)$_POST['emiratesIDCostCur'] : null;
        $EmiratesIDNumber = isset($_POST['EmiratesIDNumber']) ? trim($_POST['EmiratesIDNumber']) : null;
        
        // Handle charged entity
        $emiratesIDSupplier = null;
        $emiratesIDAccount = null;
        $chargedOpt = isset($_POST['emirateIDChargOpt']) ? (int)$_POST['emirateIDChargOpt'] : null;
        $chargedEntity = isset($_POST['emiratesIDChargedEntity']) ? (int)$_POST['emiratesIDChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $emiratesIDAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $emiratesIDSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                emiratesIDCost=:emiratesIDCost,
                emiratesIDCur=:emiratesIDCur,
                emiratesIDSupplier=:emiratesIDSupplier,
                emiratesIDAccount=:emiratesIDAccount,
                EmiratesIDNumber=:EmiratesIDNumber,
                stepEightUploader=:stepEightUploader,
                emiratesIDDate=NOW()";
        
        if ($markComplete) {
            $sql .= ", completedStep=8";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':emiratesIDCost', $emiratesIDCost);
        $stmt->bindParam(':emiratesIDCur', $emiratesIDCur);
        $stmt->bindParam(':emiratesIDSupplier', $emiratesIDSupplier);
        $stmt->bindParam(':emiratesIDAccount', $emiratesIDAccount);
        $stmt->bindParam(':EmiratesIDNumber', $EmiratesIDNumber);
        $stmt->bindParam(':stepEightUploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['emiratesIDFile']) && $_FILES['emiratesIDFile']['size'] > 0) {
            $image = uploadFile('emiratesIDFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['emiratesIDFile']['name'], 8);
            }
        }
    }
    
    // Step 8: Visa Stamping
    elseif ($step == 8) {
        $visaStampingCost = isset($_POST['visaStampingCost']) ? (float)$_POST['visaStampingCost'] : null;
        $visaStampingCur = isset($_POST['visaStampingCur']) ? (int)$_POST['visaStampingCur'] : null;
        $LabourCardNumber = isset($_POST['LabourCardNumber']) ? trim($_POST['LabourCardNumber']) : null;
        $expiry_date = isset($_POST['expiry_date']) ? $_POST['expiry_date'] : null;
        
        // Handle charged entity
        $visaStampingSupplier = null;
        $visaStampingAccount = null;
        $chargedOpt = isset($_POST['visaStampChargOpt']) ? (int)$_POST['visaStampChargOpt'] : null;
        $chargedEntity = isset($_POST['visaStampChargedEntity']) ? (int)$_POST['visaStampChargedEntity'] : null;
        
        if ($chargedOpt == 1) {
            $visaStampingAccount = $chargedEntity;
        } elseif ($chargedOpt == 2) {
            $visaStampingSupplier = $chargedEntity;
        }
        
        $sql = "UPDATE `residence` SET 
                visaStampingCost=:visaStampingCost,
                visaStampingCur=:visaStampingCur,
                visaStampingSupplier=:visaStampingSupplier,
                visaStampingAccount=:visaStampingAccount,
                LabourCardNumber=:LabourCardNumber,
                expiry_date=:expiry_date,
                stepNineUpploader=:stepNineUpploader";
        
        if ($markComplete) {
            $sql .= ", completedStep=9";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':visaStampingCost', $visaStampingCost);
        $stmt->bindParam(':visaStampingCur', $visaStampingCur);
        $stmt->bindParam(':visaStampingSupplier', $visaStampingSupplier);
        $stmt->bindParam(':visaStampingAccount', $visaStampingAccount);
        $stmt->bindParam(':LabourCardNumber', $LabourCardNumber);
        $stmt->bindParam(':expiry_date', $expiry_date);
        $stmt->bindParam(':stepNineUpploader', $staff_id);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle file upload
        if (isset($_FILES['visaStampingFile']) && $_FILES['visaStampingFile']['size'] > 0) {
            $image = uploadFile('visaStampingFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['visaStampingFile']['name'], 9);
            }
        }
    }
    
    // Step 9: Contract Submission (EID Received/Delivered)
    elseif ($step == 9) {
        $eid_received = isset($_POST['eid_received']) ? (int)$_POST['eid_received'] : 0;
        $eid_receive_datetime = isset($_POST['eid_receive_datetime']) ? $_POST['eid_receive_datetime'] : null;
        $eid_expiry = isset($_POST['eid_expiry']) ? $_POST['eid_expiry'] : null;
        $eid_delivered = isset($_POST['eid_delivered']) ? (int)$_POST['eid_delivered'] : 0;
        $eid_delivered_datetime = isset($_POST['eid_delivered_datetime']) ? $_POST['eid_delivered_datetime'] : null;
        
        // Handle EID images
        $eid_front_image = '';
        $eid_back_image = '';
        
        if (isset($_FILES['eid_front_image']) && $_FILES['eid_front_image']['size'] > 0) {
            $eid_front_image = uploadFile('eid_front_image');
        }
        if (isset($_FILES['eid_back_image']) && $_FILES['eid_back_image']['size'] > 0) {
            $eid_back_image = uploadFile('eid_back_image');
        }
        
        $sql = "UPDATE `residence` SET 
                eid_received=:eid_received,
                eid_receive_datetime=:eid_receive_datetime,
                eid_expiry=:eid_expiry,
                eid_delivered=:eid_delivered,
                eid_delivered_datetime=:eid_delivered_datetime";
        
        if ($eid_front_image) {
            $sql .= ", eid_front_image=:eid_front_image";
        }
        if ($eid_back_image) {
            $sql .= ", eid_back_image=:eid_back_image";
        }
        
        if ($markComplete) {
            $sql .= ", completedStep=10";
        } else {
            $sql .= ", steptenUploader=:steptenUploader";
        }
        
        $sql .= " WHERE residenceID=:residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':eid_received', $eid_received);
        $stmt->bindParam(':eid_receive_datetime', $eid_receive_datetime);
        $stmt->bindParam(':eid_expiry', $eid_expiry);
        $stmt->bindParam(':eid_delivered', $eid_delivered);
        $stmt->bindParam(':eid_delivered_datetime', $eid_delivered_datetime);
        if ($eid_front_image) {
            $stmt->bindParam(':eid_front_image', $eid_front_image);
        }
        if ($eid_back_image) {
            $stmt->bindParam(':eid_back_image', $eid_back_image);
        }
        if (!$markComplete) {
            $stmt->bindParam(':steptenUploader', $staff_id);
        }
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        
        // Handle contract submission file upload
        if (isset($_FILES['contractSubmissionFile']) && $_FILES['contractSubmissionFile']['size'] > 0) {
            $image = uploadFile('contractSubmissionFile');
            if ($image) {
                saveDocument($residenceID, $image, $_FILES['contractSubmissionFile']['name'], 10);
            }
        }
    }
    
    else {
        $pdo->rollBack();
        JWTHelper::sendResponse(400, false, 'Invalid step number. Must be between 1 and 10');
    }
    
    $pdo->commit();
    JWTHelper::sendResponse(200, true, 'Step updated successfully');
    
} catch (Exception $e) {
    $pdo->rollBack();
    JWTHelper::sendResponse(500, false, 'Error updating step: ' . $e->getMessage());
}











