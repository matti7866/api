<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Database connection already available as $pdo from connection.php

try {
    // Handle multipart/form-data for file uploads
    if (isset($_POST['action']) && in_array($_POST['action'], ['addStaff', 'updateStaff'])) {
        $input = $_POST;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get all staff
    if ($action == 'getStaff') {
        $sql = "SELECT `staff_id`, `staff_name`, `staff_phone`, `staff_email`, `staff_address`,
                `staff_pic`, branch.Branch_Name, branch.Branch_ID, roles.role_name, roles.role_id,
                CASE WHEN status = 1 THEN 'Active' ELSE 'Deactive' END AS status_text,
                status, salary, currencyName, staff.currencyID 
                FROM `staff` 
                INNER JOIN branch ON staff.staff_branchID = branch.Branch_ID 
                INNER JOIN roles ON roles.role_id = staff.role_id 
                INNER JOIN currency ON currency.currencyID = staff.currencyID  
                ORDER BY staff_name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $staff
        ]);
    }
    
    // Get single staff for editing
    if ($action == 'getStaffById') {
        $staff_id = $input['staff_id'] ?? null;
        
        if (empty($staff_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Staff ID is required'
            ]);
        }
        
        $sql = "SELECT `staff_name`, `staff_phone`, `staff_email`, `staff_address`, 
                `staff_branchID`, `role_id`, `status`, `salary`, currencyID 
                FROM `staff` 
                WHERE staff_id = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $staff_id);
        $stmt->execute();
        $staff = $stmt->fetch(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $staff
        ]);
    }
    
    // Add staff
    if ($action == 'addStaff') {
        $staff_name = $_POST['staff_name'] ?? null;
        $staff_phone = $_POST['staff_phone'] ?? null;
        $staff_email = $_POST['staff_email'] ?? null;
        $staff_address = $_POST['staff_address'] ?? null;
        $branch_id = $_POST['branch_id'] ?? null;
        $role_id = $_POST['role_id'] ?? null;
        $salary = $_POST['salary'] ?? null;
        $currency_id = $_POST['currency_id'] ?? null;
        $status = $_POST['status'] ?? 1;
        $password = $_POST['password'] ?? null;
        
        // Validation
        $errors = [];
        if (empty($staff_name)) $errors[] = 'Staff name is required';
        if (empty($staff_phone)) $errors[] = 'Phone is required';
        if (empty($staff_email)) $errors[] = 'Email is required';
        if (empty($staff_address)) $errors[] = 'Address is required';
        if (empty($branch_id) || $branch_id == '-1') $errors[] = 'Branch is required';
        if (empty($role_id) || $role_id == '-1') $errors[] = 'Role is required';
        if (empty($salary)) $errors[] = 'Salary is required';
        if (empty($currency_id)) $errors[] = 'Currency is required';
        if (empty($password)) $errors[] = 'Password is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => implode(', ', $errors)
            ]);
        }
        
        // Handle photo upload
        $photo_path = '';
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] == 0) {
            if ($_FILES['photo']['size'] > 2097152) {
                http_response_code(400);
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'File size must be less than 2 MB'
                ]);
            }
            
            $allowed_ext = ['jpg', 'jpeg', 'png', 'gif'];
            $file_ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
            
            if (in_array($file_ext, $allowed_ext)) {
                $photo_name = md5($staff_name . date("Y-m-d H:i:s")) . '.' . $file_ext;
                $upload_dir = __DIR__ . '/../../staff/';
                
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0755, true);
                }
                
                $photo_path = 'staff/' . $photo_name;
                move_uploaded_file($_FILES['photo']['tmp_name'], $upload_dir . $photo_name);
            }
        }
        
        $pdo->beginTransaction();
        
        // Always include staff_pic field (use empty string if no photo)
        $sql = "INSERT INTO `staff` (`staff_name`, `Password`, `staff_phone`, `staff_email`, `staff_address`,
                `staff_pic`, `staff_branchID`, `role_id`, `status`, `salary`, `currencyID`) 
                VALUES (:staff_name, :Password, :staff_phone, :staff_email, :staff_address, :staff_pic, 
                :staff_branchID, :role_id, :status, :salary, :currencyID)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':staff_name', $staff_name);
        $stmt->bindParam(':Password', $password);
        $stmt->bindParam(':staff_phone', $staff_phone);
        $stmt->bindParam(':staff_email', $staff_email);
        $stmt->bindParam(':staff_address', $staff_address);
        $stmt->bindParam(':staff_pic', $photo_path);
        $stmt->bindParam(':staff_branchID', $branch_id);
        $stmt->bindParam(':role_id', $role_id);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':salary', $salary);
        $stmt->bindParam(':currencyID', $currency_id);
        
        $stmt->execute();
        $pdo->commit();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Staff added successfully'
        ]);
    }
    
    // Update staff
    if ($action == 'updateStaff') {
        $staff_id = $_POST['staff_id'] ?? null;
        $staff_name = $_POST['staff_name'] ?? null;
        $staff_phone = $_POST['staff_phone'] ?? null;
        $staff_email = $_POST['staff_email'] ?? null;
        $staff_address = $_POST['staff_address'] ?? null;
        $branch_id = $_POST['branch_id'] ?? null;
        $role_id = $_POST['role_id'] ?? null;
        $salary = $_POST['salary'] ?? null;
        $currency_id = $_POST['currency_id'] ?? null;
        $status = $_POST['status'] ?? 1;
        $password = $_POST['password'] ?? '';
        
        // Validation
        $errors = [];
        if (empty($staff_id)) $errors[] = 'Staff ID is required';
        if (empty($staff_name)) $errors[] = 'Staff name is required';
        if (empty($staff_phone)) $errors[] = 'Phone is required';
        if (empty($staff_email)) $errors[] = 'Email is required';
        if (empty($staff_address)) $errors[] = 'Address is required';
        if (empty($branch_id) || $branch_id == '-1') $errors[] = 'Branch is required';
        if (empty($role_id) || $role_id == '-1') $errors[] = 'Role is required';
        if (empty($salary)) $errors[] = 'Salary is required';
        if (empty($currency_id)) $errors[] = 'Currency is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => implode(', ', $errors)
            ]);
        }
        
        // Handle photo upload
        $photo_path = null;
        if (isset($_FILES['photo']) && $_FILES['photo']['error'] == 0) {
            if ($_FILES['photo']['size'] > 2097152) {
                http_response_code(400);
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'File size must be less than 2 MB'
                ]);
            }
            
            $allowed_ext = ['jpg', 'jpeg', 'png', 'gif'];
            $file_ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
            
            if (in_array($file_ext, $allowed_ext)) {
                // Delete old photo
                $old_photo_sql = "SELECT staff_pic FROM staff WHERE staff_id = :staff_id";
                $old_photo_stmt = $pdo->prepare($old_photo_sql);
                $old_photo_stmt->bindParam(':staff_id', $staff_id);
                $old_photo_stmt->execute();
                $old_photo = $old_photo_stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($old_photo && !empty($old_photo['staff_pic'])) {
                    $old_file = __DIR__ . '/../../' . $old_photo['staff_pic'];
                    if (file_exists($old_file)) {
                        unlink($old_file);
                    }
                }
                
                $photo_name = md5($staff_name . date("Y-m-d H:i:s")) . '.' . $file_ext;
                $upload_dir = __DIR__ . '/../../staff/';
                
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0755, true);
                }
                
                $photo_path = 'staff/' . $photo_name;
                move_uploaded_file($_FILES['photo']['tmp_name'], $upload_dir . $photo_name);
            }
        }
        
        $pdo->beginTransaction();
        
        // Build SQL based on what's being updated
        if ($photo_path && !empty($password)) {
            $sql = "UPDATE `staff` SET staff_name = :staff_name, Password = :Password, staff_phone = :staff_phone,
                    staff_email = :staff_email, staff_address = :staff_address, staff_branchID = :staff_branchID,
                    role_id = :role_id, status = :status, salary = :salary, currencyID = :currencyID, staff_pic = :staff_pic 
                    WHERE staff_id = :staff_id";
        } elseif ($photo_path) {
            $sql = "UPDATE `staff` SET staff_name = :staff_name, staff_phone = :staff_phone,
                    staff_email = :staff_email, staff_address = :staff_address, staff_branchID = :staff_branchID,
                    role_id = :role_id, status = :status, salary = :salary, currencyID = :currencyID, staff_pic = :staff_pic 
                    WHERE staff_id = :staff_id";
        } elseif (!empty($password)) {
            $sql = "UPDATE `staff` SET staff_name = :staff_name, Password = :Password, staff_phone = :staff_phone,
                    staff_email = :staff_email, staff_address = :staff_address, staff_branchID = :staff_branchID,
                    role_id = :role_id, status = :status, salary = :salary, currencyID = :currencyID 
                    WHERE staff_id = :staff_id";
        } else {
            $sql = "UPDATE `staff` SET staff_name = :staff_name, staff_phone = :staff_phone,
                    staff_email = :staff_email, staff_address = :staff_address, staff_branchID = :staff_branchID,
                    role_id = :role_id, status = :status, salary = :salary, currencyID = :currencyID 
                    WHERE staff_id = :staff_id";
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':staff_name', $staff_name);
        if (!empty($password)) {
            $stmt->bindParam(':Password', $password);
        }
        $stmt->bindParam(':staff_phone', $staff_phone);
        $stmt->bindParam(':staff_email', $staff_email);
        $stmt->bindParam(':staff_address', $staff_address);
        $stmt->bindParam(':staff_branchID', $branch_id);
        $stmt->bindParam(':role_id', $role_id);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':salary', $salary);
        $stmt->bindParam(':currencyID', $currency_id);
        $stmt->bindParam(':staff_id', $staff_id);
        
        if ($photo_path) {
            $stmt->bindParam(':staff_pic', $photo_path);
        }
        
        $stmt->execute();
        $pdo->commit();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Staff updated successfully'
        ]);
    }
    
    // Delete staff
    if ($action == 'deleteStaff') {
        $staff_id = $input['staff_id'] ?? null;
        
        if (empty($staff_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Staff ID is required'
            ]);
        }
        
        $pdo->beginTransaction();
        
        // Get and delete photo
        $sql = "SELECT staff_pic FROM staff WHERE staff_id = :staff_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->execute();
        $staff = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($staff && !empty($staff['staff_pic'])) {
            $file_path = __DIR__ . '/../../' . $staff['staff_pic'];
            if (file_exists($file_path)) {
                unlink($file_path);
            }
        }
        
        // Delete staff record
        $sql = "DELETE FROM staff WHERE staff_id = :staff_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->execute();
        
        $pdo->commit();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Staff deleted successfully'
        ]);
    }
    
    // Get branches
    if ($action == 'getBranches') {
        $sql = "SELECT * FROM branch ORDER BY Branch_ID ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $branches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $branches
        ]);
    }
    
    // Get roles
    if ($action == 'getRoles') {
        $sql = "SELECT * FROM roles ORDER BY role_name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $roles
        ]);
    }
    
    // Get currencies
    if ($action == 'getCurrencies') {
        $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $currencies
        ]);
    }
    
    // Default response for unknown action
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action: ' . $action
    ]);
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Staff API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Staff API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>

