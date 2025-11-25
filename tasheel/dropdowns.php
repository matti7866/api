<?php
/**
 * Tasheel Dropdowns API
 * Endpoint: /api/tasheel/dropdowns.php
 * Returns companies and transaction types for dropdowns
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

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get companies
    $sql = "SELECT company_id, company_name FROM `company` ORDER BY company_name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get transaction types
    $sql = "SELECT id, name FROM `transaction_type` ORDER BY name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

    JWTHelper::sendResponse([
        'success' => true,
        'data' => [
            'companies' => $companies,
            'types' => $types
        ]
    ]);

} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server Error: ' . $e->getMessage()
    ], 500);
}

