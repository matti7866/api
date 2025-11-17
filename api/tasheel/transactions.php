<?php
/**
 * Tasheel Transactions API
 * Endpoint: /api/tasheel/transactions.php
 * Handles all CRUD operations for tasheel transactions
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check authentication - try session first, then JWT token
$user_id = null;
$role_id = null;

if (isset($_SESSION['user_id'])) {
    // Use PHP session
    $user_id = $_SESSION['user_id'];
    $role_id = $_SESSION['role_id'] ?? null;
} else {
    // Try JWT token from Authorization header
    $user = JWTHelper::verifyRequest();
    if ($user) {
        $user_id = $user['staff_id'] ?? null;
        $role_id = $user['role_id'] ?? null;
        
        // Create session from JWT token for future requests
        if ($user_id) {
            $_SESSION['user_id'] = $user_id;
            $_SESSION['role_id'] = $role_id;
            $_SESSION['staff_name'] = $user['staff_name'] ?? '';
            $_SESSION['staff_email'] = $user['staff_email'] ?? '';
        }
    }
}

if (!$user_id) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

function filterInput($name) {
    return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : '')));
}

try {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    // Validate action
    if (!in_array($action, ['searchTransactions', 'addTransaction', 'updateTransaction', 'deleteTransaction', 'getTransaction', 'changeStatus', 'addTransactionType', 'markAsCompleted'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'status' => 'error',
            'message' => 'Invalid action'
        ], 400);
    }

    if ($action == 'searchTransactions') {
        $company = filterInput('company');
        $search = filterInput('search');
        $type = filterInput('type');
        $mohrestatus = filterInput('mohrestatus');
        $statusFilter = filterInput('status_filter');
        $page = isset($_POST['page']) ? (int)$_POST['page'] : 1;
        $recordsPerPage = 10;
        $offset = ($page - 1) * $recordsPerPage;

        $where = '';
        $params = [];

        if (!empty($company)) {
            $where .= " AND tt.`company_id` = :company";
            $params[':company'] = $company;
        }
        if (!empty($type)) {
            $where .= " AND tt.`transaction_type_id` = :type";
            $params[':type'] = $type;
        }
        if (!empty($mohrestatus)) {
            $where .= " AND tt.`mohrestatus` = :mohrestatus";
            $params[':mohrestatus'] = $mohrestatus;
        }
        if ($search != '') {
            $where .= " AND (tt.`transaction_number` LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        // Filter by status
        if ($statusFilter == 'in_process') {
            $where .= " AND (tt.`status` = 'in_process' OR tt.`status` IS NULL)";
        } else if ($statusFilter == 'completed') {
            $where .= " AND tt.`status` = 'completed'";
        }

        // Get total count
        $countQuery = "SELECT COUNT(*) 
                      FROM `tasheel_transactions` tt
                      WHERE 1=1 $where";
        $stmt = $pdo->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $totalRecords = $stmt->fetchColumn();
        $totalPages = ceil($totalRecords / $recordsPerPage);

        // Get transactions
        $sql = "SELECT tt.*, c.company_name, t.name as transaction_type_name
                FROM `tasheel_transactions` tt
                LEFT JOIN `company` c ON c.`company_id` = tt.`company_id`
                LEFT JOIN `transaction_type` t ON t.`id` = tt.`transaction_type_id`
                WHERE 1=1 $where
                ORDER BY tt.`id` DESC
                LIMIT :offset, :recordsPerPage";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->bindValue(':recordsPerPage', $recordsPerPage, PDO::PARAM_INT);
        $stmt->execute();
        $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'data' => $transactions,
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => (int)$totalRecords,
            'recordsPerPage' => $recordsPerPage
        ]);
    }

    if ($action == 'getTransaction') {
        $id = filterInput('id');
        
        $sql = "SELECT * FROM `tasheel_transactions` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$transaction) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Transaction not found'
            ], 404);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'data' => $transaction
        ]);
    }

    if ($action == 'addTransaction') {
        $company_id = filterInput('company_id');
        $transaction_type_id = filterInput('transaction_type_id');
        $transaction_number = filterInput('transaction_number');
        $cost = filterInput('cost');
        $mohrestatus = '';
        $status = 'in_process';

        // Convert empty optional fields to NULL
        $company_id = ($company_id === '') ? null : $company_id;
        $cost = ($cost === '') ? null : $cost;

        $errors = [];

        if (empty($transaction_type_id)) {
            $errors['transaction_type_id'] = 'Transaction Type is required';
        }
        if (empty($transaction_number)) {
            $errors['transaction_number'] = 'Transaction Number is required';
        }

        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'status' => 'error',
                'errors' => $errors,
                'message' => 'form_errors'
            ], 400);
        }

        // Check if transaction number already exists
        $sql = "SELECT COUNT(*) FROM `tasheel_transactions` WHERE `transaction_number` = :transaction_number";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':transaction_number', $transaction_number);
        $stmt->execute();
        $count = $stmt->fetchColumn();
        
        if ($count > 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'form_errors',
                'errors' => ['transaction_number' => 'Transaction number already exists']
            ], 400);
        }

        // Insert into database
        $query = "INSERT INTO `tasheel_transactions` (`company_id`, `transaction_type_id`, `transaction_number`, `cost`, `mohrestatus`, `status`) 
                  VALUES (:company_id, :transaction_type_id, :transaction_number, :cost, :mohrestatus, :status)";
        
        $stmt = $pdo->prepare($query);
        if ($company_id === null) {
            $stmt->bindValue(':company_id', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':company_id', $company_id, PDO::PARAM_INT);
        }
        $stmt->bindParam(':transaction_type_id', $transaction_type_id);
        $stmt->bindParam(':transaction_number', $transaction_number);
        if ($cost === null) {
            $stmt->bindValue(':cost', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':cost', $cost);
        }
        $stmt->bindParam(':mohrestatus', $mohrestatus);
        $stmt->bindParam(':status', $status);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Transaction added successfully'
        ]);
    }

    if ($action == 'updateTransaction') {
        $id = filterInput('id');
        $company_id = filterInput('company_id');
        $transaction_type_id = filterInput('transaction_type_id');
        $transaction_number = filterInput('transaction_number');
        $cost = filterInput('cost');
        $mohrestatus = filterInput('mohrestatus');
        $status = filterInput('status');

        // Convert empty optional fields to NULL
        $company_id = ($company_id === '') ? null : $company_id;
        $cost = ($cost === '') ? null : $cost;

        $errors = [];

        if (empty($transaction_type_id)) {
            $errors['transaction_type_id'] = 'Transaction Type is required';
        }
        if (empty($transaction_number)) {
            $errors['transaction_number'] = 'Transaction Number is required';
        }

        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'errors' => $errors,
                'message' => 'form_errors'
            ], 400);
        }

        // Check if transaction number already exists (excluding current transaction)
        $sql = "SELECT COUNT(*) FROM `tasheel_transactions` WHERE `transaction_number` = :transaction_number AND `id` != :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':transaction_number', $transaction_number);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->fetchColumn() > 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'form_errors',
                'errors' => ['transaction_number' => 'Transaction number already exists']
            ], 400);
        }

        // Update transaction
        $sql = "UPDATE `tasheel_transactions` SET 
                    `company_id` = :company_id,
                    `transaction_type_id` = :transaction_type_id,
                    `transaction_number` = :transaction_number,
                    `cost` = :cost,
                    `mohrestatus` = :mohrestatus,
                    `status` = :status
                WHERE `id` = :id";
                
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        if ($company_id === null) {
            $stmt->bindValue(':company_id', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':company_id', $company_id, PDO::PARAM_INT);
        }
        $stmt->bindParam(':transaction_type_id', $transaction_type_id);
        $stmt->bindParam(':transaction_number', $transaction_number);
        if ($cost === null) {
            $stmt->bindValue(':cost', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':cost', $cost);
        }
        $stmt->bindParam(':mohrestatus', $mohrestatus);
        $stmt->bindParam(':status', $status);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Transaction updated successfully'
        ]);
    }

    if ($action == 'deleteTransaction') {
        $id = filterInput('id');
        
        $sql = "DELETE FROM `tasheel_transactions` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Transaction deleted successfully'
        ]);
    }

    if ($action == 'changeStatus') {
        $id = filterInput('id');
        $mohrestatus = filterInput('mohrestatus');
        
        $sql = "UPDATE `tasheel_transactions` SET `mohrestatus` = :mohrestatus WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':mohrestatus', $mohrestatus);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Status updated successfully'
        ]);
    }

    if ($action == 'markAsCompleted') {
        $id = filterInput('id');
        
        $sql = "UPDATE `tasheel_transactions` SET `status` = 'completed' WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Transaction marked as completed'
        ]);
    }

    if ($action == 'addTransactionType') {
        $name = filterInput('name');
        
        if (empty($name)) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Transaction type name is required'
            ], 400);
        }
        
        // Check if type already exists
        $sql = "SELECT COUNT(*) FROM `transaction_type` WHERE name = :name";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->execute();
        
        if ($stmt->fetchColumn() > 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'This transaction type already exists'
            ], 400);
        }
        
        // Insert new type
        $sql = "INSERT INTO `transaction_type` (name) VALUES (:name)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->execute();
        
        $typeId = $pdo->lastInsertId();
        
        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Transaction type added successfully',
            'typeId' => $typeId
        ]);
    }

} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'status' => 'error',
        'message' => 'Server Error: ' . $e->getMessage()
    ], 500);
}

