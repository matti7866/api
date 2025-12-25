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

// Verify JWT token first
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Get database connection (already available as $pdo from connection.php)

try {
    // Read JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? $_GET['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Check permissions
    $role_id = $user['role_id'];
    $stmt = $pdo->prepare("SELECT `select`, `insert`, `update`, `delete` FROM `permission` 
        WHERE role_id = :role_id AND page_name = 'Deposit'");
    $stmt->bindParam(':role_id', $role_id);
    $stmt->execute();
    $permissions = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permissions) {
        // If no permissions found, deny access
        $permissions = ['select' => 0, 'insert' => 0, 'update' => 0, 'delete' => 0];
    }
    
    // Get all deposits
    if ($action == 'getDeposits') {
        if ($permissions['select'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT d.deposit_ID, d.deposit_amount, d.currencyID, d.datetime, 
            d.depositBy, d.accountID, d.remarks, 
            c.currencyName, a.account_Name as accountName, s.staff_name as depositByName
            FROM deposits d 
            INNER JOIN currency c ON c.currencyID = d.currencyID
            INNER JOIN accounts a ON a.account_ID = d.accountID
            LEFT JOIN staff s ON s.staff_id = d.depositBy
            ORDER BY d.datetime DESC");
        $stmt->execute();
        $deposits = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $deposits
        ]);
    }
    
    // Get single deposit for editing
    if ($action == 'getDeposit') {
        if ($permissions['select'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $id = $input['id'] ?? null;
        if (!$id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Deposit ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM deposits WHERE deposit_ID = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $deposit = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$deposit) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Deposit not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $deposit
        ]);
    }
    
    // Create deposit
    if ($action == 'createDeposit') {
        if ($permissions['insert'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $accountID = $input['accountID'] ?? null;
        $deposit_amount = $input['deposit_amount'] ?? null;
        $currencyID = $input['currencyID'] ?? null;
        $datetime = $input['datetime'] ?? null;
        $remarks = $input['remarks'] ?? '';
        
        // Validate required fields
        if (!$accountID || $accountID == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account is required'
            ]);
        }
        
        if (!$deposit_amount || $deposit_amount <= 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Amount must be greater than 0'
            ]);
        }
        
        if (!$currencyID || $currencyID == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency is required'
            ]);
        }
        
        if (!$datetime) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Date and time is required'
            ]);
        }
        
        // Insert deposit
        $stmt = $pdo->prepare("INSERT INTO `deposits`(`deposit_amount`, `currencyID`, `depositBy`, `accountID`, `remarks`, `datetime`) 
            VALUES(:deposit_amount, :currencyID, :depositBy, :accountID, :remarks, :datetime)");
        $stmt->bindParam(':deposit_amount', $deposit_amount);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->bindParam(':depositBy', $staff_id);
        $stmt->bindParam(':accountID', $accountID);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Deposit added successfully',
            'id' => $pdo->lastInsertId()
        ]);
    }
    
    // Update deposit
    if ($action == 'updateDeposit') {
        if ($permissions['update'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $deposit_ID = $input['deposit_ID'] ?? null;
        $accountID = $input['accountID'] ?? null;
        $deposit_amount = $input['deposit_amount'] ?? null;
        $currencyID = $input['currencyID'] ?? null;
        $datetime = $input['datetime'] ?? null;
        $remarks = $input['remarks'] ?? '';
        
        // Validate required fields
        if (!$deposit_ID) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Deposit ID is required'
            ]);
        }
        
        if (!$accountID || $accountID == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account is required'
            ]);
        }
        
        if (!$deposit_amount || $deposit_amount <= 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Amount must be greater than 0'
            ]);
        }
        
        if (!$currencyID || $currencyID == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency is required'
            ]);
        }
        
        if (!$datetime) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Date and time is required'
            ]);
        }
        
        // Update deposit
        $stmt = $pdo->prepare("UPDATE `deposits` SET deposit_amount = :deposit_amount, currencyID = :currencyID, 
            depositBy = :depositBy, accountID = :accountID, remarks = :remarks, datetime = :datetime 
            WHERE deposit_ID = :deposit_ID");
        $stmt->bindParam(':deposit_amount', $deposit_amount);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->bindParam(':depositBy', $staff_id);
        $stmt->bindParam(':accountID', $accountID);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->bindParam(':deposit_ID', $deposit_ID);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Deposit updated successfully'
        ]);
    }
    
    // Delete deposit
    if ($action == 'deleteDeposit') {
        if ($permissions['delete'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $id = $input['id'] ?? null;
        if (!$id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Deposit ID is required'
            ]);
        }
        
        // Delete deposit
        $stmt = $pdo->prepare("DELETE FROM deposits WHERE deposit_ID = :deposit_ID");
        $stmt->bindParam(':deposit_ID', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Deposit deleted successfully'
        ]);
    }
    
    // If no action matched
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}

