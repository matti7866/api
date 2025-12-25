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

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get account currency
    if ($action == 'getAccountCurrency') {
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        
        if (!$account_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT curID FROM `accounts` WHERE account_ID = :account_id");
        $stmt->bindParam(':account_id', $account_id);
        $stmt->execute();
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($account) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => [
                    'currency_id' => $account['curID']
                ]
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account not found'
            ]);
        }
    }
    
    // Search payments
    if ($action == 'searchPayments') {
        $start_date = isset($input['start_date']) ? trim($input['start_date']) : null;
        $end_date = isset($input['end_date']) ? trim($input['end_date']) : null;
        $customer_id = isset($input['customer']) ? intval($input['customer']) : null;
        $account_id = isset($input['account']) ? intval($input['account']) : null;
        $search = isset($input['search']) ? trim($input['search']) : null;
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $per_page = isset($input['per_page']) ? max(1, min(100, intval($input['per_page']))) : 20;
        $offset = ($page - 1) * $per_page;
        
        $sql = "SELECT cp.pay_id, cp.customer_id, cp.payment_amount, cp.datetime, cp.remarks, cp.accountID, cp.staff_id,
                       c.customer_name, a.account_Name, cu.currencyName, s.staff_name, cp.currencyID
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN accounts a ON cp.accountID = a.account_ID
                LEFT JOIN currency cu ON cp.currencyID = cu.currencyID
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE 1=1";
        
        $countSql = "SELECT COUNT(*) as total
                     FROM customer_payments cp
                     LEFT JOIN customer c ON cp.customer_id = c.customer_id
                     LEFT JOIN accounts a ON cp.accountID = a.account_ID
                     LEFT JOIN currency cu ON cp.currencyID = cu.currencyID
                     LEFT JOIN staff s ON cp.staff_id = s.staff_id
                     WHERE 1=1";
        
        $params = [];
        
        if (!empty($start_date)) {
            $sql .= " AND DATE(cp.datetime) >= :start_date";
            $countSql .= " AND DATE(cp.datetime) >= :start_date";
            $params[':start_date'] = $start_date;
        }
        
        if (!empty($end_date)) {
            $sql .= " AND DATE(cp.datetime) <= :end_date";
            $countSql .= " AND DATE(cp.datetime) <= :end_date";
            $params[':end_date'] = $end_date;
        }
        
        if (!empty($customer_id)) {
            $sql .= " AND cp.customer_id = :customer_id";
            $countSql .= " AND cp.customer_id = :customer_id";
            $params[':customer_id'] = $customer_id;
        }
        
        if (!empty($account_id)) {
            $sql .= " AND cp.accountID = :account_id";
            $countSql .= " AND cp.accountID = :account_id";
            $params[':account_id'] = $account_id;
        }
        
        if (!empty($search)) {
            $sql .= " AND (c.customer_name LIKE :search OR cp.remarks LIKE :search OR s.staff_name LIKE :search OR cp.payment_amount LIKE :search)";
            $countSql .= " AND (c.customer_name LIKE :search OR cp.remarks LIKE :search OR s.staff_name LIKE :search OR cp.payment_amount LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        // Get total count
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
        $total = intval($totalResult['total']);
        
        // Get paginated results
        $sql .= " ORDER BY cp.datetime DESC LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $payments,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ]);
    }
    
    // Add payment
    if ($action == 'addPayment') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : null;
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        $remarks = isset($input['remarks']) ? trim($input['remarks']) : '';
        $staff_id = isset($input['staff_id']) ? intval($input['staff_id']) : null;
        
        if (!$customer_id || !$payment_amount || !$account_id || !$currency_id || !$staff_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'All required fields must be filled'
            ]);
        }
        
        $sql = "INSERT INTO customer_payments (customer_id, payment_amount, accountID, currencyID, remarks, staff_id, datetime) 
                VALUES (:customer_id, :payment_amount, :account_id, :currency_id, :remarks, :staff_id, NOW())";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment added successfully'
        ]);
    }
    
    // Update payment
    if ($action == 'updatePayment') {
        $pay_id = isset($input['pay_id']) ? intval($input['pay_id']) : null;
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : null;
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        $remarks = isset($input['remarks']) ? trim($input['remarks']) : '';
        $staff_id = isset($input['staff_id']) ? intval($input['staff_id']) : null;
        
        if (!$pay_id || !$customer_id || !$payment_amount || !$account_id || !$currency_id || !$staff_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'All required fields must be filled'
            ]);
        }
        
        $sql = "UPDATE customer_payments SET 
                customer_id = :customer_id, 
                payment_amount = :payment_amount, 
                accountID = :account_id, 
                currencyID = :currency_id, 
                remarks = :remarks, 
                staff_id = :staff_id
                WHERE pay_id = :pay_id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':pay_id', $pay_id);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment updated successfully'
        ]);
    }
    
    // Get payment by ID
    if ($action == 'getPayment') {
        $pay_id = isset($input['pay_id']) ? intval($input['pay_id']) : null;
        
        if (!$pay_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment ID is required'
            ]);
        }
        
        $sql = "SELECT cp.*, c.customer_name, a.account_Name, cu.currencyName, s.staff_name
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN accounts a ON cp.accountID = a.account_ID
                LEFT JOIN currency cu ON cp.currencyID = cu.currencyID
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.pay_id = :pay_id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':pay_id', $pay_id);
        $stmt->execute();
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($payment) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $payment
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment not found'
            ]);
        }
    }
    
    // Delete payment
    if ($action == 'deletePayment') {
        $pay_id = isset($input['pay_id']) ? intval($input['pay_id']) : null;
        
        if (!$pay_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment ID is required'
            ]);
        }
        
        $sql = "DELETE FROM customer_payments WHERE pay_id = :pay_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':pay_id', $pay_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment deleted successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

