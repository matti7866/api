<?php
/**
 * Agent Reset Password API
 * Endpoint: /api/agent/reset-password.php
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
}

try {
    // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['token']) || !isset($input['email']) || !isset($input['password'])) {
        JWTHelper::sendResponse(400, false, 'Token, email, and new password are required');
    }
    
    $token = trim($input['token']);
    $email = trim($input['email']);
    $newPassword = $input['password'];
    
    // Validate password strength
    if (strlen($newPassword) < 6) {
        JWTHelper::sendResponse(400, false, 'Password must be at least 6 characters long');
    }
    
    // Get agent with reset token
    $query = "SELECT id, email, reset_token, reset_token_expiry 
              FROM agents 
              WHERE LOWER(email) = LOWER(:email) 
              AND status = 1 
              AND deleted = 0
              LIMIT 1";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(404, false, 'Invalid reset token or email');
    }
    
    // Check if reset token exists
    if (empty($agent['reset_token']) || empty($agent['reset_token_expiry'])) {
        JWTHelper::sendResponse(400, false, 'No password reset request found. Please request a new one.');
    }
    
    // Verify token
    if ($agent['reset_token'] !== $token) {
        JWTHelper::sendResponse(401, false, 'Invalid reset token');
    }
    
    // Check token expiry
    $current_time = date('Y-m-d H:i:s');
    if ($current_time > $agent['reset_token_expiry']) {
        // Clear expired token
        $clearQuery = "UPDATE agents SET reset_token = NULL, reset_token_expiry = NULL WHERE email = :email";
        $clearStmt = $pdo->prepare($clearQuery);
        $clearStmt->execute([':email' => $email]);
        
        JWTHelper::sendResponse(401, false, 'Reset token has expired. Please request a new one.');
    }
    
    // Hash new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
    
    // Update password and clear reset token
    $updateQuery = "UPDATE agents 
                    SET password = :password, 
                        reset_token = NULL, 
                        reset_token_expiry = NULL,
                        datetime_updated = NOW()
                    WHERE id = :id";
    $updateStmt = $pdo->prepare($updateQuery);
    $updateStmt->bindParam(':password', $hashedPassword);
    $updateStmt->bindParam(':id', $agent['id']);
    $updateStmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Password reset successfully. You can now login with your new password.');
    
} catch (PDOException $e) {
    error_log("Database Error in reset-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log("Error in reset-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
}
?>



