<?php
require_once '../config/db.php';
require_once '../config/cors.php';
require_once '../middleware/auth.php';

// Set headers for JSON response
header('Content-Type: application/json');

try {
    // Get the request data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['residenceID'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Residence ID is required']);
        exit;
    }
    
    $residenceID = intval($input['residenceID']);
    
    // Get current residence data including MOHRE status
    $stmt = $pdo->prepare("
        SELECT 
            r.residenceID,
            r.passenger_name,
            r.mb_number,
            r.mohreStatus,
            r.previousMohreStatus,
            r.passportNumber,
            c.name as company_name
        FROM residence r
        LEFT JOIN companies c ON r.company = c.companyID
        WHERE r.residenceID = ?
    ");
    $stmt->execute([$residenceID]);
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Residence not found']);
        exit;
    }
    
    $currentStatus = $residence['mohreStatus'];
    $previousStatus = $residence['previousMohreStatus'];
    
    // Check if status has actually changed
    if ($currentStatus && $currentStatus !== $previousStatus) {
        // Send email notification
        $to = 'selabnadirydxb@gmail.com';
        $subject = 'MOHRE Status Update - Residence #' . $residenceID;
        
        $message = "
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #2563eb; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                .status-change { background-color: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #2563eb; }
                .label { font-weight: bold; color: #374151; }
                .value { color: #1f2937; margin-bottom: 10px; }
                .footer { background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h2 style='margin: 0;'>MOHRE Status Change Notification</h2>
                </div>
                <div class='content'>
                    <p>A MOHRE status change has been detected for the following residence:</p>
                    
                    <div class='status-change'>
                        <div class='value'><span class='label'>Residence ID:</span> " . htmlspecialchars($residence['residenceID']) . "</div>
                        <div class='value'><span class='label'>Passenger Name:</span> " . htmlspecialchars($residence['passenger_name']) . "</div>
                        <div class='value'><span class='label'>Company:</span> " . htmlspecialchars($residence['company_name'] ?? 'N/A') . "</div>
                        <div class='value'><span class='label'>MB Number:</span> " . htmlspecialchars($residence['mb_number'] ?? 'N/A') . "</div>
                        <div class='value'><span class='label'>Passport Number:</span> " . htmlspecialchars($residence['passportNumber']) . "</div>
                        
                        <hr style='margin: 15px 0; border: none; border-top: 1px solid #e5e7eb;'>
                        
                        <div class='value'><span class='label'>Previous Status:</span> <span style='color: #dc2626;'>" . htmlspecialchars($previousStatus ?? 'None') . "</span></div>
                        <div class='value'><span class='label'>New Status:</span> <span style='color: #16a34a; font-weight: bold;'>" . htmlspecialchars($currentStatus) . "</span></div>
                    </div>
                    
                    <p style='margin-top: 20px; color: #6b7280;'>This is an automated notification. Please check the system for more details.</p>
                </div>
                <div class='footer'>
                    <p>Selab Nadiry Travel & Tourism - Residence Management System</p>
                    <p>" . date('Y-m-d H:i:s') . "</p>
                </div>
            </div>
        </body>
        </html>
        ";
        
        // Email headers
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: SNT Residence System <noreply@selabnadiry.com>" . "\r\n";
        
        // Send email
        $emailSent = mail($to, $subject, $message, $headers);
        
        if ($emailSent) {
            // Update the previousMohreStatus to current status so we don't send duplicate emails
            $updateStmt = $pdo->prepare("
                UPDATE residence 
                SET previousMohreStatus = ? 
                WHERE residenceID = ?
            ");
            $updateStmt->execute([$currentStatus, $residenceID]);
            
            echo json_encode([
                'status' => 'success',
                'message' => 'Email notification sent successfully',
                'data' => [
                    'residenceID' => $residenceID,
                    'previousStatus' => $previousStatus,
                    'newStatus' => $currentStatus,
                    'emailSent' => true
                ]
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to send email notification',
                'data' => [
                    'residenceID' => $residenceID,
                    'emailSent' => false
                ]
            ]);
        }
    } else {
        // Status hasn't changed or is same as previous
        echo json_encode([
            'status' => 'success',
            'message' => 'No status change detected, email not sent',
            'data' => [
                'residenceID' => $residenceID,
                'currentStatus' => $currentStatus,
                'previousStatus' => $previousStatus,
                'emailSent' => false
            ]
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

