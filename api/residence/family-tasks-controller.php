<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Family Residence Tasks Controller API
 * Endpoint: /api/residence/family-tasks-controller.php
 * Handles all family task-related actions (update step, move step, etc.)
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
    'updateFamilyStep',
    'moveFamilyToStep',
    'addFamilyRemarks',
    'getFamilyRemarksHistory',
    'addFamilyResidence'
])) {
    JWTHelper::sendResponse(400, false, 'Invalid action: ' . $action);
}

$staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : (isset($userData['user_id']) ? (int)$userData['user_id'] : null);

// Update Family Step
if ($action == 'updateFamilyStep') {
    $familyResidenceId = isset($_POST['familyResidenceId']) ? (int)$_POST['familyResidenceId'] : 0;
    $step = isset($_POST['step']) ? (int)$_POST['step'] : 0;
    
    if ($familyResidenceId == 0) {
        JWTHelper::sendResponse(400, false, 'Family Residence ID is required');
    }
    
    if ($step == 0) {
        JWTHelper::sendResponse(400, false, 'Step is required');
    }
    
    try {
        // Get current step
        $currentStmt = $pdo->prepare("SELECT completed_step FROM family_residence WHERE id = :id");
        $currentStmt->execute(['id' => $familyResidenceId]);
        $current = $currentStmt->fetch(PDO::FETCH_ASSOC);
        $currentCompletedStep = $current ? (int)$current['completed_step'] : 0;
        
        // The step parameter indicates which step we're completing
        // After completing this step, we move to the next step
        $nextStep = $step + 1;
        
        // Build update query based on which step is being completed
        $fields = [];
        $params = [];
        
        // Get Dubai timezone datetime
        $datetime = new DateTime('now', new DateTimeZone('Asia/Dubai'));
        $dubaiDateTime = $datetime->format('Y-m-d H:i:s');
        
        switch ($step) {
            case 1: // E-Visa
                $cost = isset($_POST['cost']) ? (float)$_POST['cost'] : 0;
                $account = isset($_POST['account']) ? (int)$_POST['account'] : null;
                $fields = [
                    'evisa_submitter = :sub',
                    'evisa_cost = :cost',
                    'evisa_datetime = :dt',
                    'evisa_account = :acc',
                    'completed_step = :next'
                ];
                $params['sub'] = $staff_id;
                $params['cost'] = $cost;
                $params['dt'] = $dubaiDateTime;
                $params['acc'] = $account;
                break;
            case 2: // Change Status
                $cost = isset($_POST['cost']) ? (float)$_POST['cost'] : 0;
                $account = isset($_POST['account']) ? (int)$_POST['account'] : null;
                $fields = [
                    'change_status_submitter = :sub',
                    'change_status_cost = :cost',
                    'change_status_datetime = :dt',
                    'change_status_account = :acc',
                    'completed_step = :next'
                ];
                $params['sub'] = $staff_id;
                $params['cost'] = $cost;
                $params['dt'] = $dubaiDateTime;
                $params['acc'] = $account;
                break;
            case 3: // Medical
                $cost = isset($_POST['cost']) ? (float)$_POST['cost'] : 0;
                $account = isset($_POST['account']) ? (int)$_POST['account'] : null;
                $fields = [
                    'medical_submitter = :sub',
                    'medical_cost = :cost',
                    'medical_datetime = :dt',
                    'medical_account = :acc',
                    'completed_step = :next'
                ];
                $params['sub'] = $staff_id;
                $params['cost'] = $cost;
                $params['dt'] = $dubaiDateTime;
                $params['acc'] = $account;
                break;
            case 4: // Emirates ID
                $cost = isset($_POST['cost']) ? (float)$_POST['cost'] : 0;
                $account = isset($_POST['account']) ? (int)$_POST['account'] : null;
                $fields = [
                    'eid_submitter = :sub',
                    'eid_cost = :cost',
                    'eid_datetime = :dt',
                    'eid_account = :acc',
                    'completed_step = :next'
                ];
                $params['sub'] = $staff_id;
                $params['cost'] = $cost;
                $params['dt'] = $dubaiDateTime;
                $params['acc'] = $account;
                break;
            case 5: // Visa Stamping
                $cost = isset($_POST['cost']) ? (float)$_POST['cost'] : 0;
                $account = isset($_POST['account']) ? (int)$_POST['account'] : null;
                $expiry = isset($_POST['expiry']) ? trim($_POST['expiry']) : null;
                $fields = [
                    'visa_stamping_submitter = :sub',
                    'visa_stamping_cost = :cost',
                    'visa_stamping_datetime = :dt',
                    'visa_stamping_account = :acc',
                    'visa_stamping_expiry = :exp',
                    'completed_step = :next',
                    'status = :status'
                ];
                $params['sub'] = $staff_id;
                $params['cost'] = $cost;
                $params['dt'] = $dubaiDateTime;
                $params['acc'] = $account;
                $params['exp'] = $expiry;
                $params['status'] = 'completed';
                break;
            default:
                JWTHelper::sendResponse(400, false, 'Invalid step for update');
                return;
        }
        
        $params['next'] = $nextStep;
        $params['id'] = $familyResidenceId;
        
        $sql = "UPDATE family_residence SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        JWTHelper::sendResponse(200, true, 'Step updated successfully and moved to next step');
    } catch (Exception $e) {
        error_log('updateFamilyStep error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error updating step: ' . $e->getMessage());
    }
}

// Move Family to Step
if ($action == 'moveFamilyToStep') {
    $familyResidenceId = isset($_POST['familyResidenceId']) ? (int)$_POST['familyResidenceId'] : 0;
    $targetStep = isset($_POST['targetStep']) ? trim($_POST['targetStep']) : '';
    
    if ($familyResidenceId == 0) {
        JWTHelper::sendResponse(400, false, 'Family Residence ID is required');
    }
    
    if (empty($targetStep)) {
        JWTHelper::sendResponse(400, false, 'Target step is required');
    }
    
    try {
        $stepToCompletedStep = [
            '1' => 1,
            '2' => 2,
            '3' => 3,
            '4' => 4,
            '5' => 5,
            '6' => 6
        ];
        
        $targetCompletedStep = isset($stepToCompletedStep[$targetStep]) ? $stepToCompletedStep[$targetStep] : (int)$targetStep;
        
        // Update the step
        $stmt = $pdo->prepare("UPDATE family_residence SET completed_step = :step WHERE id = :id");
        $stmt->execute(['step' => $targetCompletedStep, 'id' => $familyResidenceId]);
        
        // If moved to step 6 (completed), update status
        if ($targetCompletedStep == 6) {
            $stmt = $pdo->prepare("UPDATE family_residence SET status = 'completed' WHERE id = :id");
            $stmt->execute(['id' => $familyResidenceId]);
        } else {
            // If moved back from completed, set status to active
            $stmt = $pdo->prepare("UPDATE family_residence SET status = 'active' WHERE id = :id");
            $stmt->execute(['id' => $familyResidenceId]);
        }
        
        JWTHelper::sendResponse(200, true, 'Family residence moved to step ' . $targetStep . ' successfully');
    } catch (Exception $e) {
        error_log('moveFamilyToStep error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error moving family residence: ' . $e->getMessage());
    }
}

// Add Family Remarks
if ($action == 'addFamilyRemarks') {
    $familyResidenceId = isset($_POST['familyResidenceId']) ? (int)$_POST['familyResidenceId'] : 0;
    $remarks = isset($_POST['remarks']) ? trim($_POST['remarks']) : '';
    $step = isset($_POST['step']) ? trim($_POST['step']) : '';
    
    if ($familyResidenceId == 0) {
        JWTHelper::sendResponse(400, false, 'Family Residence ID is required');
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
            CREATE TABLE IF NOT EXISTS `familyresidenceremarks` (
                `remarks_id` INT(11) NOT NULL AUTO_INCREMENT,
                `family_residence_id` INT(11) NOT NULL,
                `remarks` TEXT NOT NULL,
                `step` VARCHAR(10) NOT NULL,
                `datetime` DATETIME NOT NULL,
                `username` VARCHAR(100) DEFAULT NULL,
                PRIMARY KEY (`remarks_id`),
                KEY `family_residence_id` (`family_residence_id`),
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
                $username = 'User_' . $staff_id;
            }
        }
        
        // Insert new remarks record
        $stmt = $pdo->prepare("
            INSERT INTO familyresidenceremarks (family_residence_id, remarks, step, datetime, username)
            VALUES (:family_residence_id, :remarks, :step, NOW(), :username)
        ");
        $stmt->execute([
            'family_residence_id' => $familyResidenceId,
            'remarks' => $remarks,
            'step' => $step,
            'username' => $username
        ]);
        
        // Update the family_residence table with the latest remarks
        $updateStmt = $pdo->prepare("
            UPDATE family_residence 
            SET remarks = :remarks 
            WHERE id = :family_residence_id
        ");
        $updateStmt->execute([
            'remarks' => $remarks,
            'family_residence_id' => $familyResidenceId
        ]);
        
        JWTHelper::sendResponse(200, true, 'Remarks added successfully');
    } catch (Exception $e) {
        error_log('addFamilyRemarks error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error adding remarks: ' . $e->getMessage());
    }
}

// Get Family Remarks History
if ($action == 'getFamilyRemarksHistory') {
    $familyResidenceId = isset($_POST['familyResidenceId']) ? (int)$_POST['familyResidenceId'] : 0;
    
    if ($familyResidenceId == 0) {
        JWTHelper::sendResponse(400, false, 'Family Residence ID is required', ['history' => []]);
    }
    
    try {
        // Create table if it doesn't exist
        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `familyresidenceremarks` (
                `remarks_id` INT(11) NOT NULL AUTO_INCREMENT,
                `family_residence_id` INT(11) NOT NULL,
                `remarks` TEXT NOT NULL,
                `step` VARCHAR(10) NOT NULL,
                `datetime` DATETIME NOT NULL,
                `username` VARCHAR(100) DEFAULT NULL,
                PRIMARY KEY (`remarks_id`),
                KEY `family_residence_id` (`family_residence_id`),
                KEY `datetime` (`datetime`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $pdo->exec($createTableSql);
        
        // Fetch remarks history for this family residence
        $stmt = $pdo->prepare("
            SELECT remarks_id, remarks, step, datetime, username
            FROM familyresidenceremarks
            WHERE family_residence_id = :family_residence_id
            ORDER BY datetime DESC
        ");
        $stmt->execute(['family_residence_id' => $familyResidenceId]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse(200, true, 'Remarks history retrieved successfully', ['history' => $history]);
    } catch (Exception $e) {
        error_log('getFamilyRemarksHistory error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error retrieving remarks history: ' . $e->getMessage(), ['history' => []]);
    }
}

// Add Family Residence
if ($action == 'addFamilyResidence') {
    $customer_id = isset($_POST['customer_id']) ? (int)$_POST['customer_id'] : 0;
    $residence_id = isset($_POST['residence_id']) ? (int)$_POST['residence_id'] : 0;
    $passenger_name = isset($_POST['passenger_name']) ? trim($_POST['passenger_name']) : '';
    $passport_number = isset($_POST['passport_number']) ? trim($_POST['passport_number']) : '';
    $passport_expiry = isset($_POST['passport_expiry']) ? trim($_POST['passport_expiry']) : null;
    $date_of_birth = isset($_POST['date_of_birth']) ? trim($_POST['date_of_birth']) : null;
    $gender = isset($_POST['gender']) ? trim($_POST['gender']) : null;
    $nationality = isset($_POST['nationality']) ? (int)$_POST['nationality'] : 0;
    $relation_type = isset($_POST['relation_type']) ? trim($_POST['relation_type']) : '';
    $inside_outside = isset($_POST['inside_outside']) ? trim($_POST['inside_outside']) : '';
    $sale_price = isset($_POST['sale_price']) ? (float)$_POST['sale_price'] : 0;
    $sale_currency = isset($_POST['sale_currency']) ? trim($_POST['sale_currency']) : 'AED';
    $remarks = isset($_POST['remarks']) ? trim($_POST['remarks']) : '';
    
    if ($customer_id == 0) {
        JWTHelper::sendResponse(400, false, 'Customer is required');
    }
    
    if (empty($passenger_name) || empty($passport_number) || empty($relation_type) || empty($inside_outside)) {
        JWTHelper::sendResponse(400, false, 'Please fill all required fields (name, passport, relation, location)');
    }
    
    try {
        // Convert empty residence_id to NULL
        $residence_id = ($residence_id == 0) ? null : $residence_id;
        
        $stmt = $pdo->prepare("
            INSERT INTO family_residence 
            (customer_id, residence_id, passenger_name, passport_number, passport_expiry, date_of_birth, gender, 
             nationality, relation_type, inside_outside, sale_price, sale_currency, remarks, completed_step, status) 
            VALUES (:cid, :rid, :name, :pass, :pexp, :dob, :gender, :nat, :rel, :inout, :sale, :curr, :rem, 1, 'active')
        ");
        
        $stmt->execute([
            'cid' => $customer_id,
            'rid' => $residence_id,
            'name' => $passenger_name,
            'pass' => $passport_number,
            'pexp' => $passport_expiry ?: null,
            'dob' => $date_of_birth ?: null,
            'gender' => $gender ?: null,
            'nat' => $nationality,
            'rel' => $relation_type,
            'inout' => $inside_outside,
            'sale' => $sale_price,
            'curr' => $sale_currency,
            'rem' => $remarks
        ]);
        
        $family_id = $pdo->lastInsertId();
        
        // Upload documents if provided
        $docTypes = [
            'passport_doc' => 'passport',
            'photo_doc' => 'photo',
            'id_front_doc' => 'id_front',
            'id_back_doc' => 'id_back',
            'birth_certificate_doc' => 'birth_certificate',
            'marriage_certificate_doc' => 'marriage_certificate',
            'other_doc' => 'other'
        ];
        
        // Create table if it doesn't exist
        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `family_residence_documents` (
                `id` INT(11) NOT NULL AUTO_INCREMENT,
                `family_residence_id` INT(11) NOT NULL,
                `document_type` VARCHAR(50) NOT NULL,
                `document_name` VARCHAR(255) NOT NULL,
                `document_path` VARCHAR(500) NOT NULL,
                `document_size` INT(11) DEFAULT NULL,
                `document_extension` VARCHAR(10) DEFAULT NULL,
                `uploaded_by` INT(11) DEFAULT NULL,
                `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `family_residence_id` (`family_residence_id`),
                KEY `document_type` (`document_type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ";
        $pdo->exec($createTableSql);
        
        $uploadedCount = 0;
        foreach ($docTypes as $inputName => $docType) {
            if (isset($_FILES[$inputName]) && $_FILES[$inputName]['error'] === UPLOAD_ERR_OK) {
                $file = $_FILES[$inputName];
                $file_name = $file['name'];
                $file_size = $file['size'];
                $file_tmp = $file['tmp_name'];
                $extension = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
                
                // Validate file size (5MB limit)
                if ($file_size <= 5242880) {
                    // Validate file extension
                    $valid_extensions = ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'gif'];
                    if (in_array($extension, $valid_extensions)) {
                        // Create unique filename
                        $new_file_name = 'family_' . $family_id . '_' . $docType . '_' . time() . '_' . rand(1000, 9999) . '.' . $extension;
                        
                        // Use absolute path
                        $upload_dir = __DIR__ . '/../../family_residence_documents/';
                        $upload_path = $upload_dir . $new_file_name;
                        $relative_path = 'family_residence_documents/' . $new_file_name;
                        
                        // Create directory if it doesn't exist
                        if (!file_exists($upload_dir)) {
                            if (!mkdir($upload_dir, 0777, true)) {
                                error_log('Failed to create directory: ' . $upload_dir);
                                continue; // Skip this file
                            }
                        }
                        
                        // Check if directory is writable
                        if (!is_writable($upload_dir)) {
                            error_log('Directory is not writable: ' . $upload_dir);
                            // Try to make it writable
                            chmod($upload_dir, 0777);
                            if (!is_writable($upload_dir)) {
                                error_log('Cannot make directory writable: ' . $upload_dir);
                                continue; // Skip this file
                            }
                        }
                        
                        // Check if file was actually uploaded
                        if (!is_uploaded_file($file_tmp)) {
                            error_log('File is not an uploaded file: ' . $file_tmp);
                            continue; // Skip this file
                        }
                        
                        // Move uploaded file
                        if (move_uploaded_file($file_tmp, $upload_path)) {
                            try {
                                // Insert into database
                                $fileStmt = $pdo->prepare("
                                    INSERT INTO family_residence_documents 
                                    (family_residence_id, document_type, document_name, document_path, document_size, document_extension, uploaded_by) 
                                    VALUES (:family_id, :doc_type, :original_name, :file_path, :file_size, :extension, :uploaded_by)
                                ");
                                
                                $fileStmt->execute([
                                    'family_id' => $family_id,
                                    'doc_type' => $docType,
                                    'original_name' => $file_name,
                                    'file_path' => $relative_path,
                                    'file_size' => $file_size,
                                    'extension' => $extension,
                                    'uploaded_by' => $staff_id
                                ]);
                                
                                $uploadedCount++;
                            } catch (Exception $e) {
                                // Delete file if database insert fails
                                if (file_exists($upload_path)) {
                                    unlink($upload_path);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        JWTHelper::sendResponse(200, true, 'Family residence added successfully' . ($uploadedCount > 0 ? ' with ' . $uploadedCount . ' document(s)' : ''));
    } catch (Exception $e) {
        error_log('addFamilyResidence error: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error adding family residence: ' . $e->getMessage());
    }
}

JWTHelper::sendResponse(400, false, 'Action not implemented');

