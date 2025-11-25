<?php
/**
 * Cheques Search API
 * Endpoint: /api/cheque/search.php
 * Returns filtered cheques list
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
    $user_id = $_SESSION['user_id'];
    $role_id = $_SESSION['role_id'] ?? null;
} else {
    $user = JWTHelper::verifyRequest();
    if ($user) {
        $user_id = $user['staff_id'] ?? null;
        $role_id = $user['role_id'] ?? null;
        
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
    $search = filterInput('search');
    $type = filterInput('type');
    $account_id = filterInput('account_id');
    $startDate = filterInput('startDate');
    $endDate = filterInput('endDate');

    $where = [];
    $params = [];

    if ($search != '') {
        $where[] = "(payee LIKE :search OR number LIKE :search)";
        $params[':search'] = '%' . $search . '%';
    } else {
        if ($type != '') {
            $where[] = "type = :type";
            $params[':type'] = $type;
        }
        if ($account_id != '') {
            $where[] = "cheques.account_id = :account_id";
            $params[':account_id'] = $account_id;
        }
        if ($startDate != '') {
            $where[] = "date >= :startDate";
            $params[':startDate'] = $startDate;
        }
        if ($endDate != '') {
            $where[] = "date <= :endDate";
            $params[':endDate'] = $endDate;
        }
    }

    $whereClause = count($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT cheques.*, IFNULL(accounts.account_Name,'') as account 
            FROM cheques 
            LEFT JOIN accounts ON accounts.account_ID = cheques.account_id
            $whereClause 
            ORDER BY date DESC";
    
    $stmt = $pdo->prepare($sql);
    
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    $stmt->execute();
    $cheques = $stmt->fetchAll(PDO::FETCH_ASSOC);

    JWTHelper::sendResponse([
        'success' => true,
        'status' => 'success',
        'data' => $cheques
    ]);

} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'status' => 'error',
        'message' => 'Server Error: ' . $e->getMessage()
    ], 500);
}


