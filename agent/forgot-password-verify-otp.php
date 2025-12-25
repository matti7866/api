<?php
/**
 * Forgot Password - Verify OTP
 * Endpoint: POST /api/agent/forgot-password-verify-otp.php
 * 
 * This endpoint verifies the OTP entered by the user
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

header('Content-Type: application/json; charset=UTF-8');

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
    exit();
}

try {
    // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    // Get input data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || empty($input['email'])) {
        JWTHelper::sendResponse(400, false, 'Email is required');
        exit();
    }
    
    if (!isset($input['otp']) || empty($input['otp'])) {
        JWTHelper::sendResponse(400, false, 'OTP is required');
        exit();
    }
    
    $email = trim($input['email']);
    $otp = trim($input['otp']);
    
    // Find agent by email and verify OTP
    $sql = "SELECT id, email, otp, otp_expiry FROM agents 
            WHERE LOWER(email) = LOWER(:email) AND deleted = 0 AND status = 1";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(404, false, 'Invalid email or OTP');
        exit();
    }
    
    // Check if OTP exists
    if (empty($agent['otp']) || empty($agent['otp_expiry'])) {
        JWTHelper::sendResponse(400, false, 'No OTP found. Please request a new one.');
        exit();
    }
    
    // Check if OTP has expired
    $now = date('Y-m-d H:i:s');
    if ($agent['otp_expiry'] < $now) {
        JWTHelper::sendResponse(400, false, 'OTP has expired. Please request a new one.');
        exit();
    }
    
    // Verify OTP
    if ($agent['otp'] !== $otp) {
        JWTHelper::sendResponse(400, false, 'Invalid OTP');
        exit();
    }
    
    // OTP verified successfully
    // Don't clear OTP yet - we'll use it in the reset step for additional verification
    JWTHelper::sendResponse(200, true, 'OTP verified successfully');
    
} catch (PDOException $e) {
    error_log('Forgot Password Verify OTP Database Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log('Forgot Password Verify OTP Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'An error occurred. Please try again later.');
}


