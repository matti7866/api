<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


// Handle preflight requests FIRST
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $allowedOrigins = ['http://localhost:5174', 'http://127.0.0.1:5174'];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(200);
    exit;
}

// CORS Headers for actual requests
$allowedOrigins = ['http://localhost:5174', 'http://127.0.0.1:5174'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Content-Type: application/json');

require_once __DIR__ . '/JWTHelper.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

try {
    // Start session if not already started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    // Destroy PHP session
    $_SESSION = array();
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    
    // Verify JWT token (optional - just to check if user was logged in)
    try {
        $userData = JWTHelper::verifyRequest();
    } catch (Exception $e) {
        // Token verification failed, but we'll still proceed with logout
    }
    
    // In a real application, you might want to:
    // 1. Add token to a blacklist in database
    // 2. Log the logout action
    
    // For JWT, logout is primarily handled on the client side by removing the token
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Logout successful'
    ], 200);
    
} catch (Exception $e) {
    // Even if there's an error, we can consider logout successful
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Logout successful'
    ], 200);
}












