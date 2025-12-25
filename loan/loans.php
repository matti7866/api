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
    // Database connection already available as $pdo from connection.php
    
    function filterInput($name) {
        return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : (isset($_GET[$name]) ? $_GET[$name] : ''))));
    }
    
    // Search loans
    if ($action == 'searchLoans') {
        $start_date = filterInput('start_date');
        $end_date = filterInput('end_date');
        $customer = filterInput('customer');
        $search_by_date = filterInput('search_by_date');
        
        $where = '';
        $params = [];
        
        // Build WHERE clause based on search criteria
        if ($search_by_date == '1' && !empty($customer)) {
            // Date and Customer
            $where .= " AND loan.customer_id = :customer AND DATE(loan.datetime) BETWEEN :start_date AND :end_date";
            $params[':customer'] = $customer;
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        } else if ($search_by_date == '1' && empty($customer)) {
            // Date only
            $where .= " AND DATE(loan.datetime) BETWEEN :start_date AND :end_date";
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        } else if (!empty($customer)) {
            // Customer only
            $where .= " AND loan.customer_id = :customer";
            $params[':customer'] = $customer;
        }
        
        $sql = "
        SELECT 
            loan.loan_id, 
            customer.customer_name,
            loan.amount,
            currency.currencyName,
            currency.currencyID,
            accounts.account_Name,
            accounts.account_ID as accountID,
            loan.datetime, 
            loan.remarks,
            staff.staff_name
        FROM `loan` 
        INNER JOIN customer ON customer.customer_id = loan.customer_id 
        INNER JOIN staff ON staff.staff_id = loan.staffID 
        INNER JOIN accounts ON accounts.account_ID = loan.accountID 
        INNER JOIN currency ON currency.currencyID = loan.currencyID
        WHERE 1 $where
        ORDER BY loan.loan_id DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $loans = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $loans
        ]);
    }
    
    // Get totals
    if ($action == 'getTotal') {
        $start_date = filterInput('start_date');
        $end_date = filterInput('end_date');
        $customer = filterInput('customer');
        $search_by_date = filterInput('search_by_date');
        
        $where = '';
        $params = [];
        
        // Build WHERE clause based on search criteria
        if ($search_by_date == '1' && !empty($customer)) {
            $where .= " AND loan.customer_id = :customer AND DATE(datetime) BETWEEN :start_date AND :end_date";
            $params[':customer'] = $customer;
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        } else if ($search_by_date == '1' && empty($customer)) {
            $where .= " AND DATE(datetime) BETWEEN :start_date AND :end_date";
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        } else if (!empty($customer)) {
            $where .= " AND loan.customer_id = :customer";
            $params[':customer'] = $customer;
        }
        
        $sql = "
        SELECT * FROM (
            SELECT 
                SUM(amount) AS amount,
                currency.currencyName 
            FROM `loan` 
            INNER JOIN currency ON currency.currencyID = loan.currencyID
            WHERE 1 $where
            GROUP BY currency.currencyName
        ) AS baseTable 
        WHERE amount != 0
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $totals = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $totals
        ]);
    }
    
    // Get single loan
    if ($action == 'getLoan') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Loan ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM `loan` WHERE `loan_id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $loan = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($loan) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $loan
            ]);
        } else {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Loan not found'
            ]);
        }
    }
    
    // Add loan
    if ($action == 'addLoan') {
        $customer_id = filterInput('customer_id');
        $amount = filterInput('amount');
        $currency_id = filterInput('currency_id');
        $account_id = filterInput('account_id');
        $remarks = filterInput('remarks');
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($amount)) $errors['amount'] = 'Amount is required';
        if (empty($currency_id)) $errors['currency_id'] = 'Currency is required';
        if (empty($account_id)) $errors['account_id'] = 'Account is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        $sql = "INSERT INTO `loan` (`customer_id`, `amount`, `currencyID`, `remarks`, `staffID`, `accountID`) 
                VALUES (:customer_id, :amount, :currency_id, :remarks, :staff_id, :account_id)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Loan added successfully'
        ]);
    }
    
    // Update loan
    if ($action == 'updateLoan') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Loan ID is required'
            ]);
        }
        
        $customer_id = filterInput('customer_id');
        $amount = filterInput('amount');
        $currency_id = filterInput('currency_id');
        $account_id = filterInput('account_id');
        $remarks = filterInput('remarks');
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($amount)) $errors['amount'] = 'Amount is required';
        if (empty($currency_id)) $errors['currency_id'] = 'Currency is required';
        if (empty($account_id)) $errors['account_id'] = 'Account is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $sql = "UPDATE `loan` SET 
                `customer_id` = :customer_id,
                `amount` = :amount,
                `currencyID` = :currency_id,
                `remarks` = :remarks,
                `accountID` = :account_id
                WHERE `loan_id` = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':amount', $amount);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Loan updated successfully'
        ]);
    }
    
    // Delete loan
    if ($action == 'deleteLoan') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Loan ID is required'
            ]);
        }
        
        $sql = "DELETE FROM `loan` WHERE `loan_id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Loan deleted successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Loans API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}


