<?php
// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/JWTHelper.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['username']) || !isset($input['password'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Username and password are required'
        ], 400);
    }
    
    $username = $input['username'];
    $password = $input['password'];
    
    // Query staff table - using email or staff_name as username
    $stmt = $pdo->prepare("
        SELECT s.staff_id, s.staff_name, s.staff_email, s.staff_pic, 
               s.staff_password, s.role_id, r.role_name
        FROM staff s
        LEFT JOIN roles r ON s.role_id = r.role_id
        WHERE (s.staff_email = ? OR s.staff_name = ?)
        AND s.status = 1
        LIMIT 1
    ");
    
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid credentials'
        ], 401);
    }
    
    // Verify password
    // Check if password is hashed or plain text (for backward compatibility)
    $passwordValid = false;
    
    if (password_verify($password, $user['staff_password'])) {
        // Password is hashed
        $passwordValid = true;
    } else if ($password === $user['staff_password']) {
        // Plain text password (old system)
        $passwordValid = true;
    }
    
    if (!$passwordValid) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid credentials'
        ], 401);
    }
    
    // Remove password from user data
    unset($user['staff_password']);
    
    // Start PHP session for backend compatibility
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    // Set session variables
    $_SESSION['user_id'] = $user['staff_id'];
    $_SESSION['staff_name'] = $user['staff_name'];
    $_SESSION['staff_email'] = $user['staff_email'];
    $_SESSION['role_id'] = $user['role_id'];
    $_SESSION['role_name'] = $user['role_name'] ?? '';
    
    // Generate JWT token
    $token = JWTHelper::generateToken([
        'staff_id' => $user['staff_id'],
        'staff_name' => $user['staff_name'],
        'staff_email' => $user['staff_email'],
        'role_id' => $user['role_id']
    ], 24); // 24 hours expiry
    
    // Return success response
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Login successful',
        'token' => $token,
        'user' => $user
    ], 200);
    
} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}

