<?php
// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/JWTHelper.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require __DIR__ . '/../../vendor/autoload.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

try {
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
    $query = "SELECT staff_id, staff_name FROM staff WHERE staff_email = :email AND status = 1";
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
    
    // Store OTP in database
    $updateQuery = "UPDATE staff SET otp = :otp, otp_expiry = :expiry WHERE staff_email = :email";
    $updateStmt = $pdo->prepare($updateQuery);
    $updateStmt->execute([
        ':otp' => $otp,
        ':expiry' => $expiry,
        ':email' => $email
    ]);
    
    // Send OTP via email
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'selabnadirydxb@gmail.com';
        $mail->Password = 'zdwefhpewgyqmdkl';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        
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
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'OTP sent successfully to your email',
            'email' => $email
        ], 200);
        
    } catch (Exception $e) {
        // Log error but don't expose details
        error_log("OTP Email Error: " . $mail->ErrorInfo);
        
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Failed to send OTP. Please try again later.'
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

