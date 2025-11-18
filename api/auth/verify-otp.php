<?php
// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json; charset=UTF-8');

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
    
    if (!$input || !isset($input['email']) || !isset($input['otp'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Email and OTP are required'
        ], 400);
    }
    
    $email = trim($input['email']);
    $otp = trim($input['otp']);
    
    // Get user with OTP (status = 1 means active)
    $query = "SELECT s.staff_id, s.staff_name, s.staff_email, s.staff_pic, 
                     s.role_id, r.role_name, s.otp, s.otp_expiry
              FROM staff s
              LEFT JOIN roles r ON s.role_id = r.role_id
              WHERE s.staff_email = :email
              AND s.status = 1
              LIMIT 1";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Email not found or account is inactive'
        ], 404);
    }
    
    // Check if OTP exists
    if (empty($user['otp']) || empty($user['otp_expiry'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'No OTP found. Please request a new one.'
        ], 400);
    }
    
    // Verify OTP
    if ((string)$user['otp'] !== (string)$otp) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid OTP. Please try again.'
        ], 401);
    }
    
    // Check OTP expiry
    $current_time = date('Y-m-d H:i:s');
    if ($current_time > $user['otp_expiry']) {
        // Clear expired OTP
        $clearQuery = "UPDATE staff SET otp = NULL, otp_expiry = NULL WHERE staff_email = :email";
        $clearStmt = $pdo->prepare($clearQuery);
        $clearStmt->execute([':email' => $email]);
        
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'OTP has expired. Please request a new one.'
        ], 401);
    }
    
    // OTP is valid - clear it from database
    $clearQuery = "UPDATE staff SET otp = NULL, otp_expiry = NULL WHERE staff_email = :email";
    $clearStmt = $pdo->prepare($clearQuery);
    $clearStmt->execute([':email' => $email]);
    
    // Remove sensitive data
    unset($user['otp']);
    unset($user['otp_expiry']);
    
    // Convert staff picture URL if available
    if (!empty($user['staff_pic'])) {
        // Build full URL for staff picture
        if (strpos($user['staff_pic'], 'http') === 0) {
            // Already a full URL
            $user['staff_pic'] = convertToProductionUrl($user['staff_pic']);
        } else {
            // Relative path - make it absolute
            $user['staff_pic'] = BASE_URL . '/' . ltrim($user['staff_pic'], '/');
        }
    }
    
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
    
} catch (PDOException $e) {
    error_log("Database Error in verify-otp: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error. Please try again later.'
    ], 500);
} catch (Exception $e) {
    error_log("Error in verify-otp: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error. Please try again later.'
    ], 500);
}

