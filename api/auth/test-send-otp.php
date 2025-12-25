<?php
/**
 * Test OTP Sending Endpoint
 * This helps debug OTP sending issues
 * Access: POST /api/auth/test-send-otp.php
 */

// Include CORS headers
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
    $testOTP = '123456'; // Test OTP
    
    // Log file
    $logFile = __DIR__ . '/../../logs/otp_log.txt';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    @file_put_contents($logFile, date('Y-m-d H:i:s') . " - TEST: Attempting to send test email to $email\n", FILE_APPEND);
    
    // Send test email
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
        
        // Disable SSL verification
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
        $mail->Subject = 'TEST: OTP Email';
        $mail->Body = "Test OTP: <b>$testOTP</b>";
        $mail->AltBody = "Test OTP: $testOTP";
        
        $mail->send();
        
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - TEST: Email sent successfully to $email\n", FILE_APPEND);
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Test email sent successfully! Check your inbox.',
            'test_otp' => $testOTP
        ], 200);
        
    } catch (Exception $e) {
        $errorDetails = "TEST Email Error: " . $mail->ErrorInfo . "\nException: " . $e->getMessage() . "\n";
        error_log($errorDetails);
        @file_put_contents($logFile, date('Y-m-d H:i:s') . " - TEST ERROR: " . $errorDetails, FILE_APPEND);
        
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Failed to send test email',
            'error' => $mail->ErrorInfo,
            'exception' => $e->getMessage()
        ], 500);
    }
    
} catch (Exception $e) {
    error_log("Test send-otp error: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ], 500);
}
?>

