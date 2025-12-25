<?php
/**
 * Forgot Password - Send OTP
 * Endpoint: POST /api/agent/forgot-password-send-otp.php
 * 
 * This endpoint sends an OTP to the agent's email address for password reset
 */

// Send CORS headers IMMEDIATELY - before any other code runs
// This ensures OPTIONS requests work even if there are errors later
$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight OPTIONS request immediately
    if ($origin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
    header('Access-Control-Max-Age: 86400');
    http_response_code(200);
    exit;
}

// Set CORS headers for actual requests
if ($origin) {
    if (strpos($origin, 'sntrips.com') !== false || strpos($origin, 'localhost') !== false) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
}

// Set error handler to ensure CORS headers are sent even on errors
register_shutdown_function(function() use ($origin) {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR)) {
        // Send CORS headers even on fatal errors
        if ($origin && (strpos($origin, 'sntrips.com') !== false || strpos($origin, 'localhost') !== false)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        }
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Server error occurred. Please check server logs.',
            'error' => 'Fatal error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
        ]);
    }
});

// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

header('Content-Type: application/json; charset=UTF-8');


use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Check if vendor exists in parent directory (local) or api directory (production)
if (file_exists(__DIR__ . '/../../vendor/autoload.php')) {
    require __DIR__ . '/../../vendor/autoload.php';
} else {
    require __DIR__ . '/../vendor/autoload.php';
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
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['email'])) {
        JWTHelper::sendResponse(400, false, 'Email is required');
    }
    
    $email = trim($input['email']);
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        JWTHelper::sendResponse(400, false, 'Invalid email format');
    }
    
    // Find agent by email
    $sql = "SELECT id, email, company, customer_id FROM agents WHERE LOWER(email) = LOWER(:email) AND deleted = 0 AND status = 1";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':email', $email);
    $stmt->execute();
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        // Don't reveal if email exists for security
        JWTHelper::sendResponse(200, true, 'If the email exists, an OTP has been sent');
        exit();
    }
    
    // Generate 6-digit OTP
    $otp = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    
    // Set expiry to 10 minutes from now
    $otpExpiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
    
    // Save OTP to database
    $updateSql = "UPDATE agents SET otp = :otp, otp_expiry = :otp_expiry WHERE id = :id";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->bindParam(':otp', $otp);
    $updateStmt->bindParam(':otp_expiry', $otpExpiry);
    $updateStmt->bindParam(':id', $agent['id']);
    $updateStmt->execute();
    
    // Log OTP generation
    $logFile = file_exists(__DIR__ . '/../../logs') 
        ? __DIR__ . '/../../logs/otp_log.txt'
        : __DIR__ . '/../logs/otp_log.txt';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " - Password Reset OTP generated for $email: $otp (expires: $otpExpiry)\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    // Send OTP via email using PHPMailer
    $mail = new PHPMailer(true);
    try {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Attempting to send password reset email to $email\n", FILE_APPEND);
        
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'selabnadirydxb@gmail.com';
        $mail->Password = 'zdwefhpewgyqmdkl';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        
        // Add timeout settings to prevent hanging
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = true;
        
        // Disable SSL verification if server has certificate issues
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );
        
        $mail->setFrom('selabnadirydxb@gmail.com', 'Selab Nadiry Travels - Agent Portal');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'Your Password Reset OTP - Agent Portal';
        
        $mail->Body = "
        <html>
        <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
            <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #667eea; margin: 0;'>Agent Portal</h1>
                    <p style='color: #666; margin-top: 10px;'>Selab Nadiry Travel & Tourism</p>
                </div>
                
                <h2 style='color: #333; margin-bottom: 20px;'>Password Reset OTP</h2>
                
                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;'>
                    <p style='color: white; margin: 0 0 10px 0; font-size: 14px;'>Your Password Reset OTP Code is:</p>
                    <h1 style='color: white; margin: 0; font-size: 42px; letter-spacing: 8px; font-weight: bold;'>$otp</h1>
                </div>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    This OTP is valid for <strong style='color: #667eea;'>10 minutes</strong>. 
                    Please do not share this code with anyone.
                </p>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                    If you didn't request a password reset, please ignore this email.
                </p>
                
                <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
                
                <p style='color: #999; font-size: 12px; text-align: center;'>
                    © 2024 Selab Nadiry Travel & Tourism. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        ";
        
        $mail->AltBody = "Your Password Reset OTP for Agent Portal is: $otp\n\nThis code is valid for 10 minutes.\n\nIf you didn't request a password reset, please ignore this email.";
        
        $mail->send();
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Password reset email sent successfully to $email\n", FILE_APPEND);
        
        JWTHelper::sendResponse(200, true, 'OTP has been sent to your email address');
        exit();
        
    } catch (Exception $e) {
        // Log detailed error for debugging
        $errorDetails = "Password Reset OTP Email Error for $email: " . $mail->ErrorInfo . "\nException: " . $e->getMessage() . "\n";
        error_log($errorDetails);
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - ERROR: " . $errorDetails, FILE_APPEND);
        
        // Provide more specific error messages
        $errorMsg = $mail->ErrorInfo;
        $userMessage = 'Failed to send OTP. Please try again later.';
        
        if (strpos($errorMsg, 'Could not connect') !== false || strpos($errorMsg, 'Connection refused') !== false) {
            $userMessage = 'Cannot connect to email server. Please contact administrator.';
        } elseif (strpos($errorMsg, 'timed out') !== false || strpos($errorMsg, 'timeout') !== false) {
            $userMessage = 'Email server timeout. Please try again in a few minutes.';
        } elseif (strpos($errorMsg, 'Authentication failed') !== false || strpos($errorMsg, '535') !== false) {
            $userMessage = 'Email authentication failed. Please contact administrator.';
        } elseif (strpos($errorMsg, 'SMTP connect() failed') !== false) {
            $userMessage = 'SMTP connection failed. Please try again later.';
        }
        
        JWTHelper::sendResponse(500, false, $userMessage);
    }
    
} catch (PDOException $e) {
    error_log("Database Error in forgot-password-send-otp: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log("Error in forgot-password-send-otp: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
}

