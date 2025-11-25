<?php
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

header('Content-Type: application/json; charset=UTF-8');

// Check if connection.php exists in parent directory (local) or api directory (production)
if (file_exists(__DIR__ . '/../../connection.php')) {
    require_once __DIR__ . '/../../connection.php';
} else {
    require_once __DIR__ . '/../connection.php';
}

require_once __DIR__ . '/JWTHelper.php';

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
    
    if (!$input || !isset($input['email'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Email is required'
        ], 400);
    }
    
    $email = trim($input['email']);
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid email format'
        ], 400);
    }
    
    // Check if user exists (status = 1 means active)
    // Use LOWER() for case-insensitive email matching
    $query = "SELECT staff_id, staff_name, staff_pic, staff_email FROM staff WHERE LOWER(staff_email) = LOWER(:email) AND status = 1";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Email not found or account is inactive'
        ], 400);
    }
    
    // Generate 6-digit OTP
    $otp = rand(100000, 999999);
    $expiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
    
    // Store OTP in database - use the actual email from database for consistency
    $actualEmail = $user['staff_email']; // Use email exactly as stored in database
    $updateQuery = "UPDATE staff SET otp = :otp, otp_expiry = :expiry WHERE staff_id = :staff_id";
    $updateStmt = $pdo->prepare($updateQuery);
    $updateStmt->execute([
        ':otp' => $otp,
        ':expiry' => $expiry,
        ':staff_id' => $user['staff_id']
    ]);
    
    // Verify OTP was saved
    $verifyQuery = "SELECT otp, otp_expiry FROM staff WHERE staff_id = :staff_id LIMIT 1";
    $verifyStmt = $pdo->prepare($verifyQuery);
    $verifyStmt->execute([':staff_id' => $user['staff_id']]);
    $saved = $verifyStmt->fetch(PDO::FETCH_ASSOC);
    
    // Log OTP generation
    // Check if logs directory exists in parent (local) or api directory (production)
    $logFile = file_exists(__DIR__ . '/../../logs') 
        ? __DIR__ . '/../../logs/otp_log.txt'
        : __DIR__ . '/../logs/otp_log.txt';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " - OTP generated for $email: $otp (expires: $expiry)\n";
    $logEntry .= "  Saved OTP: " . ($saved['otp'] ?? 'NOT SAVED') . ", Expiry: " . ($saved['otp_expiry'] ?? 'NOT SAVED') . "\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    if (!$saved || $saved['otp'] != $otp) {
        error_log("CRITICAL: OTP was not saved correctly for $email. Expected: $otp, Got: " . ($saved['otp'] ?? 'NULL'));
    }
    
    // Send OTP via email
    $mail = new PHPMailer(true);
    try {
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Attempting to send email to $email\n", FILE_APPEND);
        
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
        
        $mail->setFrom('selabnadirydxb@gmail.com', 'Selab Nadiry Travels');
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'Your OTP for Selab Nadiry Portal';
        
        $mail->Body = "
        <html>
        <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
            <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #dc2626; margin: 0;'>Selab Nadiry</h1>
                    <p style='color: #666; margin-top: 10px;'>Travel & Tourism Portal</p>
                </div>
                
                <h2 style='color: #333; margin-bottom: 20px;'>Your Login OTP</h2>
                
                <div style='background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;'>
                    <p style='color: white; margin: 0 0 10px 0; font-size: 14px;'>Your OTP Code is:</p>
                    <h1 style='color: white; margin: 0; font-size: 42px; letter-spacing: 8px; font-weight: bold;'>$otp</h1>
                </div>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    This OTP is valid for <strong style='color: #dc2626;'>10 minutes</strong>. 
                    Please do not share this code with anyone.
                </p>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                    If you didn't request this OTP, please ignore this email.
                </p>
                
                <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
                
                <p style='color: #999; font-size: 12px; text-align: center;'>
                    © 2024 Selab Nadiry Travel & Tourism. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        ";
        
        $mail->AltBody = "Your OTP for Selab Nadiry Portal is: $otp\n\nThis code is valid for 10 minutes.\n\nIf you didn't request this OTP, please ignore this email.";
        
        $mail->send();
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Email sent successfully to $email\n", FILE_APPEND);
        
        // Convert staff picture URL if available
        $staffPicture = null;
        if (!empty($user['staff_pic'])) {
            // Build full URL for staff picture
            if (strpos($user['staff_pic'], 'http') === 0) {
                // Already a full URL - use as is
                $staffPicture = $user['staff_pic'];
            } else {
                // Relative path - make it absolute
                // Determine base URL from current request
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'app.sntrips.com';
                $baseUrl = $protocol . '://' . $host;
                $staffPicture = $baseUrl . '/' . ltrim($user['staff_pic'], '/');
            }
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'OTP sent successfully to your email',
            'email' => $email,
            'staff' => [
                'name' => $user['staff_name'],
                'picture' => $staffPicture
            ]
        ], 200);
        
    } catch (Exception $e) {
        // Log detailed error for debugging
        $errorDetails = "OTP Email Error for $email: " . $mail->ErrorInfo . "\nException: " . $e->getMessage() . "\n";
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
        
        JWTHelper::sendResponse([
            'success' => false,
            'message' => $userMessage
        ], 500);
    }
    
} catch (PDOException $e) {
    error_log("Database Error in send-otp: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error. Please try again later.'
    ], 500);
} catch (Exception $e) {
    error_log("Error in send-otp: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error. Please try again later.'
    ], 500);
}

