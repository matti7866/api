<?php
// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/JWTHelper.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

try {
    // Verify JWT token
    $userData = JWTHelper::verifyRequest();
    
    if (!$userData) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid or expired token'
        ], 401);
    }
    
    // Token is valid
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Token is valid'
    ], 200);
    
} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}












