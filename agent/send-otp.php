<?php
/**
 * Agent Send OTP API
 * Endpoint: /api/agent/send-otp.php
 */

// DEVELOPMENT MODE: Set to true to bypass OTP sending (just return success)
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

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Check if vendor exists
if (file_exists(__DIR__ . '/../../vendor/autoload.php')) {
    require __DIR__ . '/../../vendor/autoload.php';
} else {
    require __DIR__ . '/../vendor/autoload.php';
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
    
    // Check if agent exists and is active
    $query = "SELECT id, company, customer_id, email FROM agents 
              WHERE LOWER(email) = LOWER(:email) AND status = 1 AND deleted = 0";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(400, false, 'Email not found or account is inactive');
    }
    
    // DEVELOPMENT BYPASS MODE
    if (defined('DEV_BYPASS_OTP') && DEV_BYPASS_OTP === true) {
        // In dev mode, just return success without sending email
        $logEntry = date('Y-m-d H:i:s') . " - DEV MODE: OTP sending bypassed for $email\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        error_log("DEV MODE: OTP sending bypassed for agent email: $email");
        
        JWTHelper::sendResponse(200, true, 'DEV MODE: OTP bypassed - you can login directly', [
            'email' => $email,
            'company' => $agent['company'],
            'dev_mode' => true
        ]);
    }
    
    // Generate 6-digit OTP
    $otp = rand(100000, 999999);
    $expiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
    
    // Check if OTP columns exist first - use a safer method
    try {
        // Get all columns and check if otp exists
        $allColumns = $pdo->query("SHOW COLUMNS FROM agents")->fetchAll(PDO::FETCH_COLUMN);
        $otpColumnExists = in_array('otp', $allColumns);
        $otpExpiryExists = in_array('otp_expiry', $allColumns);
        
        if (!$otpColumnExists || !$otpExpiryExists) {
            $missing = [];
            if (!$otpColumnExists) $missing[] = 'otp';
            if (!$otpExpiryExists) $missing[] = 'otp_expiry';
            
            $logEntry = date('Y-m-d H:i:s') . " - ERROR: Missing OTP columns: " . implode(', ', $missing) . "\n";
            @file_put_contents($logFile, $logEntry, FILE_APPEND);
            
            JWTHelper::sendResponse(500, false, 'OTP columns not found in database. Missing: ' . implode(', ', $missing) . '. Please run setup: http://127.0.0.1/snt/AGENTS%20PORTAL/check_otp_columns.php');
        }
    } catch (Exception $e) {
        error_log("Could not check for OTP columns: " . $e->getMessage());
        // Don't fail completely, try to continue - the UPDATE will fail if columns don't exist
    }
    
    // Store OTP in database (ensure it's stored as string, not integer)
    $otpString = (string)$otp; // Ensure it's a string
    
    try {
        $updateQuery = "UPDATE agents SET otp = :otp, otp_expiry = :expiry WHERE id = :id";
        $updateStmt = $pdo->prepare($updateQuery);
        $updateStmt->bindParam(':otp', $otpString, PDO::PARAM_STR);
        $updateStmt->bindParam(':expiry', $expiry);
        $updateStmt->bindParam(':id', $agent['id'], PDO::PARAM_INT);
        $updateStmt->execute();
        
        // Verify OTP was saved correctly
        $verifyQuery = "SELECT otp, otp_expiry FROM agents WHERE id = :id LIMIT 1";
        $verifyStmt = $pdo->prepare($verifyQuery);
        $verifyStmt->bindParam(':id', $agent['id'], PDO::PARAM_INT);
        $verifyStmt->execute();
        $saved = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$saved || (string)$saved['otp'] !== $otpString) {
            $logEntry = date('Y-m-d H:i:s') . " - ERROR: OTP was not saved correctly! Expected: '$otpString', Got: " . ($saved['otp'] ?? 'NULL') . "\n";
            @file_put_contents($logFile, $logEntry, FILE_APPEND);
            error_log("CRITICAL: OTP was not saved correctly for agent {$agent['id']}");
            throw new Exception("Failed to save OTP to database");
        } else {
            $logEntry = date('Y-m-d H:i:s') . " - OTP saved successfully. Stored: '{$saved['otp']}', Expiry: {$saved['otp_expiry']}\n";
            @file_put_contents($logFile, $logEntry, FILE_APPEND);
        }
    } catch (PDOException $e) {
        $errorMsg = $e->getMessage();
        $logEntry = date('Y-m-d H:i:s') . " - ERROR saving OTP: $errorMsg\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        // Check if it's a column missing error
        if (strpos($errorMsg, "Unknown column 'otp'") !== false || 
            strpos($errorMsg, "Unknown column 'otp_expiry'") !== false ||
            strpos($errorMsg, "1054") !== false) {
            JWTHelper::sendResponse(500, false, 'OTP columns not found in database. Please run setup: http://127.0.0.1/snt/AGENTS%20PORTAL/check_otp_columns.php');
        }
        throw $e; // Re-throw to be caught by outer catch
    }
    
    // Log OTP generation
    $logFile = __DIR__ . '/../../logs/otp_log.txt';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " - Agent OTP generated for $email: $otp (expires: $expiry)\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
    
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
        
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = true;
        
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
        $mail->Subject = 'Your OTP for Agent Portal Login';
        
        $mail->Body = "
        <html>
        <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
            <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #667eea; margin: 0;'>Agent Portal</h1>
                    <p style='color: #666; margin-top: 10px;'>Selab Nadiry Travel & Tourism</p>
                </div>
                
                <h2 style='color: #333; margin-bottom: 20px;'>Your Login OTP</h2>
                
                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;'>
                    <p style='color: white; margin: 0 0 10px 0; font-size: 14px;'>Your OTP Code is:</p>
                    <h1 style='color: white; margin: 0; font-size: 42px; letter-spacing: 8px; font-weight: bold;'>$otp</h1>
                </div>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    This OTP is valid for <strong style='color: #667eea;'>10 minutes</strong>. 
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
        
        $mail->AltBody = "Your OTP for Agent Portal Login is: $otp\n\nThis code is valid for 10 minutes.\n\nIf you didn't request this OTP, please ignore this email.";
        
        $mail->send();
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - Email sent successfully to $email\n", FILE_APPEND);
        
        JWTHelper::sendResponse(200, true, 'OTP sent successfully to your email', [
            'email' => $email,
            'company' => $agent['company']
        ]);
        
    } catch (Exception $e) {
        $errorDetails = "Agent OTP Email Error for $email: " . $mail->ErrorInfo . "\nException: " . $e->getMessage() . "\n";
        error_log($errorDetails);
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - ERROR: " . $errorDetails, FILE_APPEND);
        
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
    $errorMsg = $e->getMessage();
    $errorCode = $e->getCode();
    error_log("Database Error in agent send-otp: " . $errorMsg . " (Code: $errorCode)");
    
    // Check if error is about missing columns
    if (strpos($errorMsg, "Unknown column 'otp'") !== false || 
        strpos($errorMsg, "Unknown column 'otp_expiry'") !== false ||
        strpos($errorMsg, "1054") !== false) {
        $logEntry = date('Y-m-d H:i:s') . " - Database Error: OTP columns missing. Error: $errorMsg\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        JWTHelper::sendResponse(500, false, 'OTP columns not found in database. Please run setup: http://127.0.0.1/snt/AGENTS%20PORTAL/check_otp_columns.php');
    } else {
        $logEntry = date('Y-m-d H:i:s') . " - Database Error: $errorMsg (Code: $errorCode)\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        JWTHelper::sendResponse(500, false, 'Database error. Please check server logs or contact administrator.');
    }
} catch (Exception $e) {
    $errorMsg = $e->getMessage();
    error_log("Error in agent send-otp: " . $errorMsg);
    $logEntry = date('Y-m-d H:i:s') . " - Exception: $errorMsg\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
    JWTHelper::sendResponse(500, false, 'Server error: ' . $errorMsg);
}
?>

