<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Residence Tasks Controller API
 * Endpoint: /api/residence/tasks-controller.php
 * Handles all task-related actions (setOfferLetterStatus, seteVisaStatus, setHold, etc.)
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

$action = isset($_POST['action']) ? trim($_POST['action']) : '';

if (empty($action)) {
    JWTHelper::sendResponse(400, false, 'Action is required');
}

if (!in_array($action, [
    'setOfferLetterStatus',
    'seteVisaStatus',
    'setHold',
    'getPassenger',
    'setOfferLetter',
    'setInsurance',
    'setLabourCard',
    'setEVisa',
    'setChangeStatus',
    'setMedical',
    'setEmiratesID',
    'setVisaStamping',
    'setContractSubmission',
    'setTawjeeh',
    'setILOE',
    'loadAttachments',
    'moveResidenceToStep',
    'addRemarks',
    'getRemarksHistory'
])) {
    JWTHelper::sendResponse(400, false, 'Invalid action: ' . $action);
}

$staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : (isset($userData['user_id']) ? (int)$userData['user_id'] : null);

// Helper function to upload file
function uploadFile($name, $id, $filetype) {
    global $pdo;
    $new_image_name = '';
    if (isset($_FILES[$name]) && $_FILES[$name]['size'] > 0 && $_FILES[$name]['size'] <= 2097152) {
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
                $fileStmt = $pdo->prepare("INSERT INTO `residencedocuments`(`ResID`, `file_name`, `original_name`, `fileType`) VALUES (:ResID,:file_name,:original_name,:fileType)");
                $fileStmt->bindParam(':ResID', $id);
                $fileStmt->bindParam(':file_name', $new_image_name);
                $fileStmt->bindParam(':original_name', $_FILES[$name]['name']);
                $fileStmt->bindParam(':fileType', $filetype);
                $fileStmt->execute();
                return $new_image_name;
            }
        }
    }
    return $new_image_name;
}

if ($action == 'setOfferLetterStatus') {
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $value = isset($_POST['value']) ? trim($_POST['value']) : '';

    if ($id == 0 || $value == '') {
        JWTHelper::sendResponse(400, false, 'Invalid input: id=' . $id . ', value=' . $value);
    }

    try {
        if ($value == 'accepted') {
            $stmt = $pdo->prepare("UPDATE residence SET offerLetterStatus = :value WHERE residenceID = :id");
            $stmt->execute(['value' => $value, 'id' => $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE residence SET offerLetterStatus = :value, completedStep = 1 WHERE residenceID = :id");
            $stmt->execute(['value' => 'pending', 'id' => $id]);
        }

        JWTHelper::sendResponse(200, true, 'Offer letter status updated successfully');
    } catch (Exception $e) {
        error_log('setOfferLetterStatus error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error updating offer letter status: ' . $e->getMessage());
    }
}

if ($action == 'seteVisaStatus') {
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $value = isset($_POST['value']) ? $_POST['value'] : '';

    if ($id == 0 || $value == '') {
        JWTHelper::sendResponse(400, false, 'Invalid input');
    }

    if ($value == 'accepted') {
        $stmt = $pdo->prepare("UPDATE residence SET eVisaStatus = :value WHERE residenceID = :id");
        $stmt->execute(['value' => $value, 'id' => $id]);
    } else {
        $stmt = $pdo->prepare("UPDATE residence SET eVisaStatus = :value, completedStep = 4 WHERE residenceID = :id");
        $stmt->execute(['value' => 'pending', 'id' => $id]);
    }

    JWTHelper::sendResponse(200, true, 'eVisa status updated successfully');
}

if ($action == 'setHold') {
    $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
    $value = isset($_POST['value']) ? $_POST['value'] : '0';

    if ($id == 0) {
        JWTHelper::sendResponse(400, false, 'Invalid input');
    }

    $stmt = $pdo->prepare("UPDATE residence SET hold = :value WHERE residenceID = :id");
    $stmt->execute(['value' => $value == '1' ? 1 : 0, 'id' => $id]);

    JWTHelper::sendResponse(200, true, 'Hold status updated successfully');
}

if ($action == 'moveResidenceToStep') {
    $id = isset($_POST['residenceId']) ? (int)$_POST['residenceId'] : (isset($_POST['id']) ? (int)$_POST['id'] : 0);
    $targetStep = isset($_POST['targetStep']) ? trim($_POST['targetStep']) : '';

    if ($id == 0 || $targetStep == '') {
        JWTHelper::sendResponse(400, false, 'Invalid input: id=' . $id . ', targetStep=' . $targetStep);
    }

    try {
        // Map step names to completedStep values
        $stepMapping = [
            '1' => 1,      // Offer Letter
            '1a' => 2,    // Offer Letter Submitted (needs acceptance)
            '2' => 3,     // Insurance
            '3' => 4,     // Labour Card
            '4' => 5,     // E-Visa
            '4a' => 5,    // E-Visa Submitted (needs acceptance)
            '5' => 6,     // Change Status
            '6' => 7,     // Medical
            '7' => 8,     // Emirates ID
            '8' => 9,     // Visa Stamping
            '9' => 10,    // Contract Submission
            '10' => 10    // Completed
        ];

        $completedStep = isset($stepMapping[$targetStep]) ? $stepMapping[$targetStep] : (int)$targetStep;
        
        // Handle special cases for step 1a and 4a
        if ($targetStep == '1a') {
            // Set to step 2 and mark offer letter as submitted
            $stmt = $pdo->prepare("UPDATE residence SET completedStep = 2, offerLetterStatus = 'submitted' WHERE residenceID = :id");
            $stmt->execute(['id' => $id]);
        } elseif ($targetStep == '4a') {
            // Set to step 5 and mark eVisa as submitted
            $stmt = $pdo->prepare("UPDATE residence SET completedStep = 5, eVisaStatus = 'submitted' WHERE residenceID = :id");
            $stmt->execute(['id' => $id]);
        } else {
            // Regular step move
            $stmt = $pdo->prepare("UPDATE residence SET completedStep = :completedStep WHERE residenceID = :id");
            $stmt->execute(['completedStep' => $completedStep, 'id' => $id]);
        }

        JWTHelper::sendResponse(200, true, 'Residence moved to step ' . $targetStep . ' successfully');
    } catch (Exception $e) {
        error_log('moveResidenceToStep error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error moving residence: ' . $e->getMessage());
    }
}

if ($action == 'getRemarksHistory') {
    $residence_id = isset($_POST['residence_id']) ? (int)$_POST['residence_id'] : 0;
    
    if ($residence_id == 0) {
        JWTHelper::sendResponse(400, false, 'Residence ID is required', ['history' => []]);
    }
    
    try {
        // Create table if it doesn't exist
        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `residenceremarks` (
                `remarks_id` INT(11) NOT NULL AUTO_INCREMENT,
                `residence_id` INT(11) NOT NULL,
                `remarks` TEXT NOT NULL,
                `step` VARCHAR(10) NOT NULL,
                `datetime` DATETIME NOT NULL,
                `username` VARCHAR(100) DEFAULT NULL,
                PRIMARY KEY (`remarks_id`),
                KEY `residence_id` (`residence_id`),
                KEY `datetime` (`datetime`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $pdo->exec($createTableSql);
        
        // Fetch remarks history for this residence
        $stmt = $pdo->prepare("
            SELECT remarks_id, remarks, step, datetime, username
            FROM residenceremarks
            WHERE residence_id = :residence_id
            ORDER BY datetime DESC
        ");
        $stmt->execute(['residence_id' => $residence_id]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse(200, true, 'Remarks history retrieved successfully', ['history' => $history]);
    } catch (Exception $e) {
        error_log('getRemarksHistory error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error retrieving remarks history: ' . $e->getMessage(), ['history' => []]);
    }
}

if ($action == 'addRemarks') {
    $residence_id = isset($_POST['residence_id']) ? (int)$_POST['residence_id'] : 0;
    $remarks = isset($_POST['remarks']) ? trim($_POST['remarks']) : '';
    $step = isset($_POST['step']) ? trim($_POST['step']) : '';
    
    if ($residence_id == 0) {
        JWTHelper::sendResponse(400, false, 'Residence ID is required');
    }
    
    if ($remarks == '') {
        JWTHelper::sendResponse(400, false, 'Remarks cannot be empty');
    }
    
    if ($step == '') {
        JWTHelper::sendResponse(400, false, 'Step is required');
    }
    
    try {
        // Create table if it doesn't exist
        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `residenceremarks` (
                `remarks_id` INT(11) NOT NULL AUTO_INCREMENT,
                `residence_id` INT(11) NOT NULL,
                `remarks` TEXT NOT NULL,
                `step` VARCHAR(10) NOT NULL,
                `datetime` DATETIME NOT NULL,
                `username` VARCHAR(100) DEFAULT NULL,
                PRIMARY KEY (`remarks_id`),
                KEY `residence_id` (`residence_id`),
                KEY `datetime` (`datetime`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $pdo->exec($createTableSql);
        
        // Get username from users table
        $username = 'Unknown';
        if ($staff_id) {
            try {
                $userStmt = $pdo->prepare("SELECT username FROM users WHERE user_id = :user_id");
                $userStmt->execute(['user_id' => $staff_id]);
                $user = $userStmt->fetch(PDO::FETCH_ASSOC);
                if ($user && isset($user['username'])) {
                    $username = $user['username'];
                }
            } catch (Exception $e) {
                // If users table doesn't exist or column is different, use user_id as fallback
                $username = 'User_' . $staff_id;
            }
        }
        
        // Insert new remarks record
        $stmt = $pdo->prepare("
            INSERT INTO residenceremarks (residence_id, remarks, step, datetime, username)
            VALUES (:residence_id, :remarks, :step, NOW(), :username)
        ");
        $stmt->execute([
            'residence_id' => $residence_id,
            'remarks' => $remarks,
            'step' => $step,
            'username' => $username
        ]);
        
        // Update the residence table with the latest remarks
        $updateStmt = $pdo->prepare("
            UPDATE residence 
            SET remarks = :remarks 
            WHERE residenceID = :residence_id
        ");
        $updateStmt->execute([
            'remarks' => $remarks,
            'residence_id' => $residence_id
        ]);
        
        JWTHelper::sendResponse(200, true, 'Remarks added successfully');
    } catch (Exception $e) {
        error_log('addRemarks error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error adding remarks: ' . $e->getMessage());
    }
}

// For other actions, we'll use the existing update-step.php endpoint
// The component will call updateStep for setOfferLetter, setInsurance, etc.

JWTHelper::sendResponse(400, false, 'Action not implemented yet');

