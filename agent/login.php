<?php
/**
 * Agent Login API
 * Endpoint: /api/agent/login.php
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Set response header
header('Content-Type: application/json');

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get POST data
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['email']) || !isset($input['password'])) {
    JWTHelper::sendResponse(400, false, 'Email and password are required');
}

$email = trim($input['email']);
$password = $input['password'];

try {
    // Query agent from database
    $sql = "SELECT * FROM agents WHERE email = :email AND deleted = 0";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(401, false, 'Invalid email or password');
    }
    
    // Check if agent is active
    if ($agent['status'] != 1) {
        JWTHelper::sendResponse(403, false, 'Your account is inactive. Please contact administrator.');
    }
    
    // Verify password
    $storedPassword = trim($agent['password']);
    
    // Check if password is hashed or plain text
    $isHashed = str_starts_with($storedPassword, '$2y$') || 
                str_starts_with($storedPassword, '$2a$') || 
                str_starts_with($storedPassword, '$2b$');
    
    $passwordValid = false;
    
    if ($isHashed) {
        // Password is hashed - verify using password_verify
        $passwordValid = password_verify($password, $storedPassword);
    } else {
        // Password is plain text - compare directly (for migration)
        $passwordValid = ($storedPassword === $password);
        
        // If valid but plain text, rehash it for security
        if ($passwordValid) {
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $updatePwdSql = "UPDATE agents SET password = :password WHERE id = :id";
            $updatePwdStmt = $pdo->prepare($updatePwdSql);
            $updatePwdStmt->bindParam(':password', $newHash);
            $updatePwdStmt->bindParam(':id', $agent['id']);
            $updatePwdStmt->execute();
        }
    }
    
    if (!$passwordValid) {
        JWTHelper::sendResponse(401, false, 'Invalid email or password');
    }
    
    // Get IP address and country (simplified)
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $country = 'UAE'; // You can integrate with IP geolocation service if needed
    
    // Log login history (only if table exists and has the right structure)
    try {
        $logSql = "INSERT INTO agents_login_history (agent_id, datetime, ip_address, country) 
                   VALUES (:agent_id, NOW(), :ip_address, :country)";
        $logStmt = $pdo->prepare($logSql);
        $logStmt->bindParam(':agent_id', $agent['id']);
        $logStmt->bindParam(':ip_address', $ip_address);
        $logStmt->bindParam(':country', $country);
        $logStmt->execute();
    } catch (PDOException $e) {
        // If table doesn't exist or has structure issues, just log the error but don't fail login
        error_log("Could not log to agents_login_history: " . $e->getMessage());
    }
    
    // Update last login info
    $updateSql = "UPDATE agents 
                  SET last_login_ip = :ip_address, 
                      last_login_datetime = NOW(),
                      datetime_updated = NOW()
                  WHERE id = :id";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->bindParam(':ip_address', $ip_address);
    $updateStmt->bindParam(':id', $agent['id']);
    $updateStmt->execute();
    
    // Generate JWT token for agent
    $tokenPayload = [
        'agent_id' => $agent['id'],
        'customer_id' => $agent['customer_id'],
        'email' => $agent['email'],
        'company' => $agent['company'],
        'type' => 'agent' // Distinguish from regular users
    ];
    
    $token = JWTHelper::generateToken($tokenPayload);
    
    // Return success response with token and agent info
    JWTHelper::sendResponse(200, true, 'Login successful', [
        'token' => $token,
        'agent' => [
            'id' => $agent['id'],
            'company' => $agent['company'],
            'customer_id' => $agent['customer_id'],
            'email' => $agent['email']
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Agent login error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'An error occurred during login. Please try again.');
}
?>

