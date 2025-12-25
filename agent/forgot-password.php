<?php
/**
 * Agent Forgot Password API
 * Endpoint: /api/agent/forgot-password.php
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
    $query = "SELECT id, company, email FROM agents 
              WHERE LOWER(email) = LOWER(:email) AND status = 1 AND deleted = 0";
    $stmt = $pdo->prepare($query);
    $stmt->execute([':email' => $email]);
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        // Don't reveal if email exists or not (security best practice)
        JWTHelper::sendResponse(200, true, 'If the email exists, a password reset link has been sent.');
    }
    
    // Generate reset token
    $resetToken = bin2hex(random_bytes(32)); // 64 character token
    $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour')); // Valid for 1 hour
    
    // Store reset token in database
    // First check if reset_token column exists, if not we'll add it
    try {
        $updateQuery = "UPDATE agents SET reset_token = :token, reset_token_expiry = :expiry WHERE id = :id";
        $updateStmt = $pdo->prepare($updateQuery);
        $updateStmt->bindParam(':token', $resetToken);
        $updateStmt->bindParam(':expiry', $tokenExpiry);
        $updateStmt->bindParam(':id', $agent['id']);
        $updateStmt->execute();
    } catch (PDOException $e) {
        // If columns don't exist, create them
        if (strpos($e->getMessage(), "Unknown column 'reset_token'") !== false) {
            try {
                $pdo->exec("ALTER TABLE `agents` ADD COLUMN `reset_token` VARCHAR(64) NULL DEFAULT NULL AFTER `password`");
                $pdo->exec("ALTER TABLE `agents` ADD COLUMN `reset_token_expiry` DATETIME NULL DEFAULT NULL AFTER `reset_token`");
                // Retry the update
                $updateStmt = $pdo->prepare($updateQuery);
                $updateStmt->bindParam(':token', $resetToken);
                $updateStmt->bindParam(':expiry', $tokenExpiry);
                $updateStmt->bindParam(':id', $agent['id']);
                $updateStmt->execute();
            } catch (Exception $e2) {
                error_log("Failed to create reset_token columns: " . $e2->getMessage());
                JWTHelper::sendResponse(500, false, 'Server configuration error. Please contact administrator.');
            }
        } else {
            throw $e;
        }
    }
    
    // Create reset link
    $resetLink = "http://localhost:5175/reset-password?token=" . $resetToken . "&email=" . urlencode($email);
    
    // Send reset email
    $mail = new PHPMailer(true);
    try {
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
        $mail->Subject = 'Password Reset Request - Agent Portal';
        
        $mail->Body = "
        <html>
        <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
            <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #667eea; margin: 0;'>Agent Portal</h1>
                    <p style='color: #666; margin-top: 10px;'>Selab Nadiry Travel & Tourism</p>
                </div>
                
                <h2 style='color: #333; margin-bottom: 20px;'>Password Reset Request</h2>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    Hello {$agent['company']},
                </p>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    We received a request to reset your password. Click the button below to reset it:
                </p>
                
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='$resetLink' style='display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;'>
                        Reset Password
                    </a>
                </div>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                    Or copy and paste this link into your browser:
                </p>
                <p style='color: #667eea; font-size: 12px; word-break: break-all; background: #f7fafc; padding: 10px; border-radius: 4px;'>
                    $resetLink
                </p>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                    This link will expire in <strong style='color: #667eea;'>1 hour</strong>.
                </p>
                
                <p style='color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;'>
                    If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                </p>
                
                <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
                
                <p style='color: #999; font-size: 12px; text-align: center;'>
                    © 2024 Selab Nadiry Travel & Tourism. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        ";
        
        $mail->AltBody = "Password Reset Request\n\nClick this link to reset your password:\n$resetLink\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.";
        
        $mail->send();
        
        JWTHelper::sendResponse(200, true, 'If the email exists, a password reset link has been sent.');
        
    } catch (Exception $e) {
        error_log("Password reset email error: " . $e->getMessage());
        // Don't reveal if email exists - still return success
        JWTHelper::sendResponse(200, true, 'If the email exists, a password reset link has been sent.');
    }
    
} catch (PDOException $e) {
    error_log("Database Error in forgot-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log("Error in forgot-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
}
?>



