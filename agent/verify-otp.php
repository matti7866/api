<?php
/**
 * Agent Verify OTP API
 * Endpoint: /api/agent/verify-otp.php
 */

// DEVELOPMENT MODE: Set to true to bypass OTP verification
define('DEV_BYPASS_OTP', true); // CHANGE TO false IN PRODUCTION!

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
    
    if (!$input || !isset($input['email']) || !isset($input['otp'])) {
        JWTHelper::sendResponse(400, false, 'Email and OTP are required');
    }
    
    $email = trim($input['email']);
    $otp = trim($input['otp']);
    
    // Log verification attempt
    $logFile = __DIR__ . '/../../logs/otp_log.txt';
    @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Agent verification attempt for $email with OTP: $otp\n", FILE_APPEND);
    
    // First check if OTP columns exist
    try {
        $checkColumns = "SHOW COLUMNS FROM agents LIKE 'otp'";
        $otpColumnExists = $pdo->query($checkColumns)->fetch();
        
        if (!$otpColumnExists) {
            @file_put_contents($logFile, date('Y-m-d H:i:s') . " - ERROR: OTP columns do not exist in agents table!\n", FILE_APPEND);
            JWTHelper::sendResponse(500, false, 'OTP columns not found in database. Please run the setup script: http://127.0.0.1/snt/AGENTS%20PORTAL/check_otp_columns.php');
        }
    } catch (Exception $e) {
        // If we can't check, try to proceed anyway
        error_log("Could not check for OTP columns: " . $e->getMessage());
    }
    
    // Get agent with OTP - use COALESCE to handle missing columns gracefully
    $query = "SELECT id, company, customer_id, email, 
              COALESCE(otp, '') as otp, 
              COALESCE(otp_expiry, NULL) as otp_expiry
              FROM agents 
              WHERE LOWER(email) = LOWER(:email) 
              AND status = 1 
              AND deleted = 0
              LIMIT 1";
    
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Log what was found
    if ($agent) {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Agent found. Stored OTP: " . ($agent['otp'] ?? 'NULL') . ", Expiry: " . ($agent['otp_expiry'] ?? 'NULL') . "\n", FILE_APPEND);
    } else {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Agent NOT found for email: $email\n", FILE_APPEND);
    }
    
    if (!$agent) {
        JWTHelper::sendResponse(404, false, 'Email not found or account is inactive');
    }
    
    // DEVELOPMENT BYPASS MODE
    if (defined('DEV_BYPASS_OTP') && DEV_BYPASS_OTP === true) {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - DEV MODE: OTP verification bypassed for $email\n", FILE_APPEND);
        error_log("DEV MODE: OTP verification bypassed for agent email: $email");
        // Skip OTP verification and proceed directly to login
    } else {
        // PRODUCTION MODE: Full OTP verification
        // Check if OTP exists
        if (empty($agent['otp']) || empty($agent['otp_expiry'])) {
            error_log("Agent OTP Verification Failed - No OTP found for email: $email");
            
            JWTHelper::sendResponse(400, false, 'No OTP found. Please request a new one.');
        }
        
        // Verify OTP
        $storedOtp = trim((string)$agent['otp']);
        $providedOtp = trim((string)$otp);
        
        // Log for debugging
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Comparing OTPs. Stored: '$storedOtp' (length: " . strlen($storedOtp) . "), Provided: '$providedOtp' (length: " . strlen($providedOtp) . ")\n", FILE_APPEND);
        
        if ($storedOtp !== $providedOtp) {
            @file_put_contents($logFile, date('Y-m-d H:i:s') . " - OTP MISMATCH! Stored: '$storedOtp', Provided: '$providedOtp'\n", FILE_APPEND);
            JWTHelper::sendResponse(401, false, 'Invalid OTP. Please check the code and try again.');
        }
        
        // Check OTP expiry
        $current_time = date('Y-m-d H:i:s');
        if ($current_time > $agent['otp_expiry']) {
            // Clear expired OTP
            $clearQuery = "UPDATE agents SET otp = NULL, otp_expiry = NULL WHERE email = :email";
            $clearStmt = $pdo->prepare($clearQuery);
            $clearStmt->execute([':email' => $email]);
            
            JWTHelper::sendResponse(401, false, 'OTP has expired. Please request a new one.');
        }
        
        // OTP is valid - clear it from database
        $clearQuery = "UPDATE agents SET otp = NULL, otp_expiry = NULL WHERE email = :email";
        $clearStmt = $pdo->prepare($clearQuery);
        $clearStmt->execute([':email' => $email]);
    }
    
    // Get IP address and country
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $country = 'UAE';
    
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
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Warning: Could not log login history: " . $e->getMessage() . "\n", FILE_APPEND);
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
        'type' => 'agent'
    ];
    
    $token = JWTHelper::generateToken($tokenPayload);
    
    // Remove sensitive data
    unset($agent['otp']);
    unset($agent['otp_expiry']);
    
    // Return success response
    JWTHelper::sendResponse(200, true, 'Login successful', [
        'token' => $token,
        'agent' => [
            'id' => $agent['id'],
            'company' => $agent['company'],
            'customer_id' => $agent['customer_id'],
            'email' => $agent['email']
        ]
    ]);
    
} catch (PDOException $e) {
    $errorMsg = $e->getMessage();
    error_log("Database Error in agent verify-otp: " . $errorMsg);
    
    // Check if error is about missing columns
    if (strpos($errorMsg, "Unknown column 'otp'") !== false || 
        strpos($errorMsg, "Unknown column 'otp_expiry'") !== false) {
        JWTHelper::sendResponse(500, false, 'OTP columns not found. Please run setup: http://127.0.0.1/snt/AGENTS%20PORTAL/check_otp_columns.php');
    } else {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Database Error: $errorMsg\n", FILE_APPEND);
        JWTHelper::sendResponse(500, false, 'Database error: ' . $errorMsg);
    }
} catch (Exception $e) {
    $errorMsg = $e->getMessage();
    error_log("Error in agent verify-otp: " . $errorMsg);
    @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Exception: $errorMsg\n", FILE_APPEND);
    JWTHelper::sendResponse(500, false, 'Server error: ' . $errorMsg);
}
?>

