<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

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

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Handle JSON body for POST requests
    if ($method === 'POST' && empty($_POST)) {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if ($data) {
            $_POST = array_merge($_POST, $data);
        }
    }
    
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    // Get database connection
    // Database connection already available as $pdo from connection.php
    
    function filterInput($name) {
        return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : (isset($_GET[$name]) ? $_GET[$name] : ''))));
    }
    
    function statusLabel($status) {
        $labels = [
            'pending' => '<span class="badge bg-warning">Pending</span>',
            'completed' => '<span class="badge bg-success">Completed</span>',
            'rejected' => '<span class="badge bg-danger">Rejected</span>',
            'refunded' => '<span class="badge bg-info">Refunded</span>',
            'visit_required' => '<span class="badge bg-warning">Visit Required</span>'
        ];
        return $labels[$status] ?? '<span class="badge bg-secondary">Unknown</span>';
    }
    
    // Search transactions
    if ($action == 'searchTransactions') {
        $start_date = filterInput('start_date');
        $end_date = filterInput('end_date');
        $customer = filterInput('customer');
        $search = filterInput('search');
        $type = filterInput('type');
        $status = filterInput('status');
        $account = filterInput('account');
        
        $where = '';
        $params = [];
        
        if (!empty($customer)) {
            $where .= " AND amer.`customer_id` = :customer";
            $params[':customer'] = $customer;
        }
        if (!empty($type)) {
            $where .= " AND amer.`type_id` = :type";
            $params[':type'] = $type;
        }
        if (!empty($status)) {
            $where .= " AND amer.`status` = :status";
            $params[':status'] = $status;
        }
        if (!empty($account)) {
            $where .= " AND amer.`account_id` = :account";
            $params[':account'] = $account;
        }
        
        if ($start_date != '' && $end_date != '') {
            $where .= " AND amer.`datetime` BETWEEN :start_date AND :end_date";
            $params[':start_date'] = "{$start_date} 00:00:00";
            $params[':end_date'] = "{$end_date} 23:59:59";
        }
        if ($search != '') {
            $where .= " AND (amer.`transaction_number` LIKE :search OR amer.`application_number` LIKE :search OR amer.`passenger_name` LIKE :search OR amer.`iban` LIKE :search)";
            $params[':search'] = "%{$search}%";
        }
        
        $sql = "
        SELECT amer.*, customer.customer_name, amer_types.name as type_name, accounts.account_Name
        FROM `amer` 
        LEFT JOIN `customer` ON `customer`.`customer_id` = `amer`.`customer_id`
        LEFT JOIN `amer_types` ON `amer_types`.`id` = `amer`.`type_id`
        LEFT JOIN `accounts` ON `accounts`.`account_ID` = `amer`.`account_id`
        WHERE 1 $where
        GROUP BY `amer`.`id`
        ORDER BY `amer`.`id` DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $transactions
        ]);
    }
    
    // Get single transaction
    if ($action == 'getTransaction') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transaction ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM `amer` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($transaction) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $transaction
            ]);
        } else {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transaction not found'
            ]);
        }
    }
    
    // Add transaction
    if ($action == 'addTransaction') {
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $type_id = filterInput('type_id');
        $application_number = filterInput('application_number');
        $transaction_number = filterInput('transaction_number');
        $payment_date = filterInput('payment_date');
        $cost_price = filterInput('cost_price');
        $sale_price = filterInput('sale_price');
        $iban = filterInput('iban');
        $account_id = filterInput('account_id');
        $created_by = filterInput('created_by');
        $status = filterInput('status') ?: 'pending';
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger Name is required';
        if (empty($type_id)) $errors['type_id'] = 'Type is required';
        if (empty($application_number)) $errors['application_number'] = 'Application Number is required';
        if (empty($transaction_number)) $errors['transaction_number'] = 'Transaction Number is required';
        if (empty($payment_date)) $errors['payment_date'] = 'Payment Date is required';
        if (empty($cost_price)) $errors['cost_price'] = 'Net Cost is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale Cost is required';
        if (empty($account_id)) $errors['account_id'] = 'Account is required';
        if (empty($created_by)) $errors['created_by'] = 'Staff Member is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        // Check if transaction number already exists
        $sql = "SELECT COUNT(*) FROM `amer` WHERE `transaction_number` = :transaction_number";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':transaction_number', $transaction_number);
        $stmt->execute();
        if ($stmt->fetchColumn() > 0) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transaction number already exists',
                'errors' => ['transaction_number' => 'Transaction number already exists']
            ]);
        }
        
        // Check if application number already exists
        $sql = "SELECT COUNT(*) FROM `amer` WHERE `application_number` = :application_number";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':application_number', $application_number);
        $stmt->execute();
        if ($stmt->fetchColumn() > 0) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Application number already exists',
                'errors' => ['application_number' => 'Application number already exists']
            ]);
        }
        
        $query = "
        INSERT INTO `amer` (`customer_id`, `passenger_name`, `type_id`, `application_number`, `transaction_number`, `payment_date`, `cost_price`, `sale_price`, `iban`, `account_id`, `created_by`, `status`, `datetime`) 
        VALUES (:customer_id, :passenger_name, :type_id, :application_number, :transaction_number, :payment_date, :cost_price, :sale_price, :iban, :account_id, :created_by, :status, :datetime)
        ";
        $stmt = $pdo->prepare($query);
        $datetime = date("Y-m-d H:i:s");
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':passenger_name', $passenger_name);
        $stmt->bindParam(':type_id', $type_id);
        $stmt->bindParam(':application_number', $application_number);
        $stmt->bindParam(':transaction_number', $transaction_number);
        $stmt->bindParam(':payment_date', $payment_date);
        $stmt->bindParam(':cost_price', $cost_price);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->bindParam(':iban', $iban);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->bindParam(':created_by', $created_by);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':datetime', $datetime);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transaction added successfully'
        ]);
    }
    
    // Update transaction
    if ($action == 'updateTransaction') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transaction ID is required'
            ]);
        }
        
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $type_id = filterInput('type_id');
        $application_number = filterInput('application_number');
        $transaction_number = filterInput('transaction_number');
        $payment_date = filterInput('payment_date');
        $cost_price = filterInput('cost_price');
        $sale_price = filterInput('sale_price');
        $iban = filterInput('iban');
        $account_id = filterInput('account_id');
        $created_by = filterInput('created_by');
        $status = filterInput('status');
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger Name is required';
        if (empty($type_id)) $errors['type_id'] = 'Type is required';
        if (empty($application_number)) $errors['application_number'] = 'Application Number is required';
        if (empty($transaction_number)) $errors['transaction_number'] = 'Transaction Number is required';
        if (empty($payment_date)) $errors['payment_date'] = 'Payment Date is required';
        if (empty($cost_price)) $errors['cost_price'] = 'Net Cost is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale Cost is required';
        if (empty($account_id)) $errors['account_id'] = 'Account is required';
        if (empty($created_by)) $errors['created_by'] = 'Staff Member is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $query = "UPDATE `amer` SET 
                    `customer_id` = :customer_id,
                    `passenger_name` = :passenger_name,
                    `type_id` = :type_id,
                    `application_number` = :application_number,
                    `transaction_number` = :transaction_number,
                    `payment_date` = :payment_date,
                    `cost_price` = :cost_price,
                    `sale_price` = :sale_price,
                    `iban` = :iban,
                    `account_id` = :account_id,
                    `created_by` = :created_by,
                    `status` = :status
                  WHERE `id` = :id";
                  
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':passenger_name', $passenger_name);
        $stmt->bindParam(':type_id', $type_id);
        $stmt->bindParam(':application_number', $application_number);
        $stmt->bindParam(':transaction_number', $transaction_number);
        $stmt->bindParam(':payment_date', $payment_date);
        $stmt->bindParam(':cost_price', $cost_price);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->bindParam(':iban', $iban);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->bindParam(':created_by', $created_by);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transaction updated successfully'
        ]);
    }
    
    // Delete transaction
    if ($action == 'deleteTransaction') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Transaction ID is required'
            ]);
        }
        
        $sql = "DELETE FROM `amer` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Transaction deleted successfully'
        ]);
    }
    
    // Change status
    if ($action == 'changeStatus') {
        $id = filterInput('id');
        $status = filterInput('status');
        
        $sql = "UPDATE `amer` SET `status` = :status WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':status', $status);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Status updated successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Transactions API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

