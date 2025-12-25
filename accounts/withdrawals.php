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
        WHERE role_id = :role_id AND page_name = 'Withdrawal'");
    $stmt->bindParam(':role_id', $role_id);
    $stmt->execute();
    $permissions = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permissions) {
        // If no permissions found, deny access
        $permissions = ['select' => 0, 'insert' => 0, 'update' => 0, 'delete' => 0];
    }
    
    // Get all withdrawals
    if ($action == 'getWithdrawals') {
        if ($permissions['select'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT w.withdrawal_ID, w.withdrawal_amount, w.currencyID, w.datetime, 
            w.withdrawalBy, w.accountID, w.remarks, 
            c.currencyName, a.account_Name as accountName, s.staff_name as withdrawalByName
            FROM withdrawals w 
            INNER JOIN currency c ON c.currencyID = w.currencyID
            INNER JOIN accounts a ON a.account_ID = w.accountID
            LEFT JOIN staff s ON s.staff_id = w.withdrawalBy
            ORDER BY w.datetime DESC");
        $stmt->execute();
        $withdrawals = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $withdrawals
        ]);
    }
    
    // Get single withdrawal for editing
    if ($action == 'getWithdrawal') {
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
                'message' => 'Withdrawal ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM withdrawals WHERE withdrawal_ID = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $withdrawal = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$withdrawal) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Withdrawal not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $withdrawal
        ]);
    }
    
    // Create withdrawal
    if ($action == 'createWithdrawal') {
        if ($permissions['insert'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $accountID = $input['accountID'] ?? null;
        $withdrawal_amount = $input['withdrawal_amount'] ?? null;
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
        
        if (!$withdrawal_amount || $withdrawal_amount <= 0) {
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
        
        // Insert withdrawal
        $stmt = $pdo->prepare("INSERT INTO `withdrawals`(`withdrawal_amount`, `currencyID`, `withdrawalBy`, `accountID`, `remarks`, `datetime`) 
            VALUES(:withdrawal_amount, :currencyID, :withdrawalBy, :accountID, :remarks, :datetime)");
        $stmt->bindParam(':withdrawal_amount', $withdrawal_amount);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->bindParam(':withdrawalBy', $staff_id);
        $stmt->bindParam(':accountID', $accountID);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Withdrawal added successfully',
            'id' => $pdo->lastInsertId()
        ]);
    }
    
    // Update withdrawal
    if ($action == 'updateWithdrawal') {
        if ($permissions['update'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $withdrawal_ID = $input['withdrawal_ID'] ?? null;
        $accountID = $input['accountID'] ?? null;
        $withdrawal_amount = $input['withdrawal_amount'] ?? null;
        $currencyID = $input['currencyID'] ?? null;
        $datetime = $input['datetime'] ?? null;
        $remarks = $input['remarks'] ?? '';
        
        // Validate required fields
        if (!$withdrawal_ID) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Withdrawal ID is required'
            ]);
        }
        
        if (!$accountID || $accountID == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account is required'
            ]);
        }
        
        if (!$withdrawal_amount || $withdrawal_amount <= 0) {
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
        
        // Update withdrawal
        $stmt = $pdo->prepare("UPDATE `withdrawals` SET withdrawal_amount = :withdrawal_amount, currencyID = :currencyID, 
            withdrawalBy = :withdrawalBy, accountID = :accountID, remarks = :remarks, datetime = :datetime 
            WHERE withdrawal_ID = :withdrawal_ID");
        $stmt->bindParam(':withdrawal_amount', $withdrawal_amount);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->bindParam(':withdrawalBy', $staff_id);
        $stmt->bindParam(':accountID', $accountID);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->bindParam(':withdrawal_ID', $withdrawal_ID);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Withdrawal updated successfully'
        ]);
    }
    
    // Delete withdrawal
    if ($action == 'deleteWithdrawal') {
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
                'message' => 'Withdrawal ID is required'
            ]);
        }
        
        // Delete withdrawal
        $stmt = $pdo->prepare("DELETE FROM withdrawals WHERE withdrawal_ID = :withdrawal_ID");
        $stmt->bindParam(':withdrawal_ID', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Withdrawal deleted successfully'
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

