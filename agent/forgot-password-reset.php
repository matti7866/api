<?php
/**
 * Forgot Password - Reset Password
 * Endpoint: POST /api/agent/forgot-password-reset.php
 * 
 * This endpoint resets the password after OTP verification
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
    
    if (!isset($input['password']) || empty($input['password'])) {
        JWTHelper::sendResponse(400, false, 'Password is required');
        exit();
    }
    
    $email = trim($input['email']);
    $otp = trim($input['otp']);
    $password = $input['password'];
    
    // Validate password length
    if (strlen($password) < 6) {
        JWTHelper::sendResponse(400, false, 'Password must be at least 6 characters long');
        exit();
    }
    
    // Find agent by email and verify OTP again
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
    
    // Verify OTP again for security
    if (empty($agent['otp']) || $agent['otp'] !== $otp) {
        JWTHelper::sendResponse(400, false, 'Invalid or expired OTP');
        exit();
    }
    
    // Check if OTP has expired
    $now = date('Y-m-d H:i:s');
    if ($agent['otp_expiry'] < $now) {
        JWTHelper::sendResponse(400, false, 'OTP has expired. Please request a new one.');
        exit();
    }
    
    // Store password as plain text (no hashing)
    // Update password and clear OTP
    $updateSql = "UPDATE agents 
                  SET password = :password, 
                      otp = NULL, 
                      otp_expiry = NULL,
                      datetime_updated = NOW()
                  WHERE id = :id";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->bindParam(':password', $password);
    $updateStmt->bindParam(':id', $agent['id']);
    $updateStmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Password has been reset successfully');
    
} catch (PDOException $e) {
    error_log('Forgot Password Reset Database Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log('Forgot Password Reset Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'An error occurred. Please try again later.');
}


