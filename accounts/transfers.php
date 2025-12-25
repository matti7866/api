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
    
    // Check permissions - try Transfer first, then Accounts as fallback
    $role_id = $user['role_id'];
    
    // First try to get Transfer permission
    $stmt = $pdo->prepare("SELECT `select`, `insert`, `update`, `delete` FROM `permission` 
        WHERE role_id = :role_id AND page_name = 'Transfer'");
    $stmt->bindParam(':role_id', $role_id);
    $stmt->execute();
    $permissions = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // If Transfer permission doesn't exist, use Accounts permission as fallback
    if (!$permissions) {
        $stmt = $pdo->prepare("SELECT `select`, `insert`, `update`, `delete` FROM `permission` 
            WHERE role_id = :role_id AND page_name = 'Accounts'");
        $stmt->bindParam(':role_id', $role_id);
        $stmt->execute();
        $permissions = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    // If still no permissions found, deny access
    if (!$permissions) {
        $permissions = ['select' => 0, 'insert' => 0, 'update' => 0, 'delete' => 0];
    }
    
    // Get all transfers
    if ($action == 'getTransfers') {
        if ($permissions['select'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        try {
            $stmt = $pdo->prepare("SELECT t.id, t.datetime, t.from_account, t.to_account, t.remarks, 
                t.amount, t.charges, t.exchange_rate, t.trx, t.filename, t.added_by,
                fa.account_Name as fromAccountName, ta.account_Name as toAccountName,
                s.staff_name as addedByName
                FROM transfers t 
                INNER JOIN accounts fa ON fa.account_ID = t.from_account
                INNER JOIN accounts ta ON ta.account_ID = t.to_account
                LEFT JOIN staff s ON s.staff_id = t.added_by
                ORDER BY t.datetime DESC");
            $stmt->execute();
            $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $transfers ? $transfers : []
            ]);
        } catch (PDOException $e) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Get single transfer for editing
    if ($action == 'getTransfer') {
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
                'message' => 'Transfer ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM transfers WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $transfer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$transfer) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transfer not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $transfer
        ]);
    }
    
    // Create transfer
    if ($action == 'createTransfer') {
        if ($permissions['insert'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $from_account = $input['from_account'] ?? null;
        $to_account = $input['to_account'] ?? null;
        $amount = $input['amount'] ?? null;
        $charges = $input['charges'] ?? 0;
        $exchange_rate = $input['exchange_rate'] ?? 1;
        $datetime = $input['datetime'] ?? null;
        $remarks = $input['remarks'] ?? '';
        $trx = $input['trx'] ?? '';
        
        // Validate required fields
        if (!$from_account || $from_account == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'From Account is required'
            ]);
        }
        
        if (!$to_account || $to_account == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'To Account is required'
            ]);
        }
        
        if ($from_account == $to_account) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'From and To accounts must be different'
            ]);
        }
        
        if (!$amount || $amount <= 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Amount must be greater than 0'
            ]);
        }
        
        if (!$datetime) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Date and time is required'
            ]);
        }
        
        // Insert transfer
        $stmt = $pdo->prepare("INSERT INTO `transfers`(`from_account`, `to_account`, `amount`, `charges`, `exchange_rate`, `datetime`, `remarks`, `trx`, `added_by`) 
            VALUES(:from_account, :to_account, :amount, :charges, :exchange_rate, :datetime, :remarks, :trx, :added_by)");
        $stmt->bindParam(':from_account', $from_account);
        $stmt->bindParam(':to_account', $to_account);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':charges', $charges);
        $stmt->bindParam(':exchange_rate', $exchange_rate);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':trx', $trx);
        $stmt->bindParam(':added_by', $staff_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transfer added successfully',
            'id' => $pdo->lastInsertId()
        ]);
    }
    
    // Update transfer
    if ($action == 'updateTransfer') {
        if ($permissions['update'] != 1) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permission denied'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        $id = $input['id'] ?? null;
        $from_account = $input['from_account'] ?? null;
        $to_account = $input['to_account'] ?? null;
        $amount = $input['amount'] ?? null;
        $charges = $input['charges'] ?? 0;
        $exchange_rate = $input['exchange_rate'] ?? 1;
        $datetime = $input['datetime'] ?? null;
        $remarks = $input['remarks'] ?? '';
        $trx = $input['trx'] ?? '';
        
        // Validate required fields
        if (!$id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transfer ID is required'
            ]);
        }
        
        if (!$from_account || $from_account == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'From Account is required'
            ]);
        }
        
        if (!$to_account || $to_account == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'To Account is required'
            ]);
        }
        
        if ($from_account == $to_account) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'From and To accounts must be different'
            ]);
        }
        
        if (!$amount || $amount <= 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Amount must be greater than 0'
            ]);
        }
        
        if (!$datetime) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Date and time is required'
            ]);
        }
        
        // Update transfer
        $stmt = $pdo->prepare("UPDATE `transfers` SET from_account = :from_account, to_account = :to_account, 
            amount = :amount, charges = :charges, exchange_rate = :exchange_rate, datetime = :datetime, 
            remarks = :remarks, trx = :trx, added_by = :added_by 
            WHERE id = :id");
        $stmt->bindParam(':from_account', $from_account);
        $stmt->bindParam(':to_account', $to_account);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':charges', $charges);
        $stmt->bindParam(':exchange_rate', $exchange_rate);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':trx', $trx);
        $stmt->bindParam(':added_by', $staff_id);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transfer updated successfully'
        ]);
    }
    
    // Delete transfer
    if ($action == 'deleteTransfer') {
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
                'message' => 'Transfer ID is required'
            ]);
        }
        
        // Delete transfer
        $stmt = $pdo->prepare("DELETE FROM transfers WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transfer deleted successfully'
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

