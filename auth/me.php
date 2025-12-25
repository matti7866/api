<?php
// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/JWTHelper.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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
    
// Verify JWT token
    $userData = JWTHelper::verifyRequest();
    
    if (!$userData) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid or expired token'
        ], 401);
    }
    
    // Get fresh user data from database
    $stmt = $pdo->prepare("
        SELECT s.staff_id, s.staff_name, s.staff_email, s.staff_pic, 
               s.role_id, r.role_name
        FROM staff s
        LEFT JOIN roles r ON s.role_id = r.role_id
        WHERE s.staff_id = ?
        AND s.status = 1
        LIMIT 1
    ");
    
    $stmt->execute([$userData['staff_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'User not found'
        ], 404);
    }
    
    // Convert staff_pic URL from localhost to production if needed
    if (!empty($user['staff_pic'])) {
        $user['staff_pic'] = convertToProductionUrl($user['staff_pic']);
    }
    
    // Return user data
    JWTHelper::sendResponse([
        'success' => true,
        'user' => $user
    ], 200);
    
} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}

