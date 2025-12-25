<?php
/**
 * Emirates ID Tasks Controller API
 * Handles actions for EID tasks: getResidence, setMarkReceived, setMarkDelivered, getPositions, getCompanies
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Check if vendor exists in parent directory (local) or api directory (production)
if (file_exists(__DIR__ . '/../../vendor/autoload.php')) {
    require __DIR__ . '/../../vendor/autoload.php';
} else {
    require __DIR__ . '/../vendor/autoload.php';
}

/**
 * Send email notification for Emirates ID events
 * @param string $eventType - 'received' or 'delivered'
 * @param array $data - Task data (passengerName, eidNumber, etc.)
 * @return bool - Success status
 */
function sendEIDNotificationEmail($eventType, $data) {
    $mail = new PHPMailer(true);
    
    try {
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'selabnadirydxb@gmail.com';
        $mail->Password = 'zdwefhpewgyqmdkl';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        
        // Add timeout settings
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
        $mail->addAddress('selabnadirydxb@gmail.com');
        $mail->isHTML(true);
        
        if ($eventType === 'received') {
            $mail->Subject = 'Emirates ID Received - ' . $data['passengerName'];
            
            $mail->Body = "
            <html>
            <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <h1 style='color: #10b981; margin: 0;'>✅ Emirates ID Received</h1>
                    </div>
                    
                    <h2 style='color: #333; margin-bottom: 20px;'>Emirates ID has been received</h2>
                    
                    <div style='background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;'>
                        <p style='margin: 8px 0;'><strong>Passenger Name:</strong> {$data['passengerName']}</p>
                        <p style='margin: 8px 0;'><strong>EID Number:</strong> {$data['eidNumber']}</p>
                        <p style='margin: 8px 0;'><strong>EID Expiry Date:</strong> {$data['eidExpiry']}</p>
                        <p style='margin: 8px 0;'><strong>Type:</strong> " . ($data['type'] === 'ML' ? 'Mainland' : 'Freezone') . "</p>
                        <p style='margin: 8px 0;'><strong>Date & Time:</strong> " . date('d M Y, h:i A') . "</p>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                        The Emirates ID for <strong>{$data['passengerName']}</strong> has been marked as received in the system.
                    </p>
                    
                    <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
                    
                    <p style='color: #999; font-size: 12px; text-align: center;'>
                        © 2024 Selab Nadiry Travel & Tourism. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
            ";
            
        } else { // delivered
            $mail->Subject = 'Emirates ID Delivered - ' . $data['passengerName'];
            
            $mail->Body = "
            <html>
            <body style='font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;'>
                <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
                    <div style='text-align: center; margin-bottom: 30px;'>
                        <h1 style='color: #3b82f6; margin: 0;'>📦 Emirates ID Delivered</h1>
                    </div>
                    
                    <h2 style='color: #333; margin-bottom: 20px;'>Emirates ID has been delivered</h2>
                    
                    <div style='background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;'>
                        <p style='margin: 8px 0;'><strong>Passenger Name:</strong> {$data['passengerName']}</p>
                        <p style='margin: 8px 0;'><strong>EID Number:</strong> {$data['eidNumber']}</p>
                        <p style='margin: 8px 0;'><strong>Type:</strong> " . ($data['type'] === 'ML' ? 'Mainland' : 'Freezone') . "</p>
                        <p style='margin: 8px 0;'><strong>Date & Time:</strong> " . date('d M Y, h:i A') . "</p>
                    </div>
                    
                    <p style='color: #666; font-size: 14px; line-height: 1.6;'>
                        The Emirates ID for <strong>{$data['passengerName']}</strong> has been marked as delivered to the customer.
                    </p>
                    
                    <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
                    
                    <p style='color: #999; font-size: 12px; text-align: center;'>
                        © 2024 Selab Nadiry Travel & Tourism. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
            ";
        }
        
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("EID Notification Email Error: " . $mail->ErrorInfo);
        return false;
    }
}

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

$action = isset($_POST['action']) ? $_POST['action'] : '';

$validActions = ['getResidence', 'setMarkReceived', 'setMarkDelivered', 'getPositions', 'getCompanies', 'addPosition', 'addCompany'];
if (!in_array($action, $validActions)) {
    JWTHelper::sendResponse(400, false, 'Invalid action');
}

try {
    if ($action == 'getResidence') {
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $type = isset($_POST['type']) ? $_POST['type'] : '';

        if (empty($id) || empty($type)) {
            JWTHelper::sendResponse(400, false, 'Missing ID or type');
        }

        if ($type === 'ML') {
            $stmt = $pdo->prepare("
                SELECT r.*, p.posiiton_name as positionName, p.position_id as positionID, c.company_name, c.company_id as company
                FROM residence r
                LEFT JOIN position p ON r.positionID = p.position_id
                LEFT JOIN company c ON r.company = c.company_id
                WHERE r.residenceID = :id
            ");
        } else { // FZ
            $stmt = $pdo->prepare("
                SELECT f.*, p.posiiton_name as positionName, p.position_id as positionID, c.company_name, c.company_id as company
                FROM freezone f
                LEFT JOIN position p ON f.positionID = p.position_id
                LEFT JOIN company c ON f.company = c.company_id
                WHERE f.id = :id
            ");
        }

        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $residence = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($residence) {
            JWTHelper::sendResponse(200, true, 'Success', ['residence' => $residence]);
        } else {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
    }

    if ($action == 'setMarkReceived') {
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $type = isset($_POST['type']) ? $_POST['type'] : '';
        $eidNumber = isset($_POST['eidNumber']) ? trim($_POST['eidNumber']) : '';
        $eidExpiryDate = isset($_POST['eidExpiryDate']) ? $_POST['eidExpiryDate'] : '';
        $passengerName = isset($_POST['passenger_name']) ? trim($_POST['passenger_name']) : '';
        $gender = isset($_POST['gender']) ? $_POST['gender'] : '';
        $dob = isset($_POST['dob']) ? $_POST['dob'] : '';
        $occupation = isset($_POST['occupation']) ? (int)$_POST['occupation'] : null;
        $establishmentName = isset($_POST['establishmentName']) ? (int)$_POST['establishmentName'] : null;

        if (empty($id) || empty($type) || empty($eidNumber) || empty($eidExpiryDate)) {
            JWTHelper::sendResponse(400, false, 'Missing required fields');
        }

        $pdo->beginTransaction();

        try {
            if ($type === 'ML') {
                $updateSql = "
                    UPDATE residence 
                    SET eid_received = 1,
                        EmiratesIDNumber = :eidNumber,
                        eid_expiry = :eidExpiryDate";
                
                if (!empty($passengerName)) {
                    $updateSql .= ", passenger_name = :passengerName";
                }
                if (!empty($gender)) {
                    $updateSql .= ", gender = :gender";
                }
                if (!empty($dob)) {
                    $updateSql .= ", dob = :dob";
                }
                if ($occupation) {
                    $updateSql .= ", positionID = :occupation";
                }
                if ($establishmentName) {
                    $updateSql .= ", company = :establishmentName";
                }
                
                $updateSql .= " WHERE residenceID = :id";
                
                $stmt = $pdo->prepare($updateSql);
                $stmt->bindParam(':id', $id);
                $stmt->bindParam(':eidNumber', $eidNumber);
                $stmt->bindParam(':eidExpiryDate', $eidExpiryDate);
                if (!empty($passengerName)) {
                    $stmt->bindParam(':passengerName', $passengerName);
                }
                if (!empty($gender)) {
                    $stmt->bindParam(':gender', $gender);
                }
                if (!empty($dob)) {
                    $stmt->bindParam(':dob', $dob);
                }
                if ($occupation) {
                    $stmt->bindParam(':occupation', $occupation);
                }
                if ($establishmentName) {
                    $stmt->bindParam(':establishmentName', $establishmentName);
                }
            } else { // FZ
                $updateSql = "
                    UPDATE freezone 
                    SET eid_received = 1,
                        eidNumber = :eidNumber,
                        eid_expiry = :eidExpiryDate";
                
                if (!empty($passengerName)) {
                    $updateSql .= ", passangerName = :passengerName";
                }
                if (!empty($gender)) {
                    $updateSql .= ", gender = :gender";
                }
                if (!empty($dob)) {
                    $updateSql .= ", dob = :dob";
                }
                if ($occupation) {
                    $updateSql .= ", positionID = :occupation";
                }
                if ($establishmentName) {
                    $updateSql .= ", company = :establishmentName";
                }
                
                $updateSql .= " WHERE id = :id";
                
                $stmt = $pdo->prepare($updateSql);
                $stmt->bindParam(':id', $id);
                $stmt->bindParam(':eidNumber', $eidNumber);
                $stmt->bindParam(':eidExpiryDate', $eidExpiryDate);
                if (!empty($passengerName)) {
                    $stmt->bindParam(':passengerName', $passengerName);
                }
                if (!empty($gender)) {
                    $stmt->bindParam(':gender', $gender);
                }
                if (!empty($dob)) {
                    $stmt->bindParam(':dob', $dob);
                }
                if ($occupation) {
                    $stmt->bindParam(':occupation', $occupation);
                }
                if ($establishmentName) {
                    $stmt->bindParam(':establishmentName', $establishmentName);
                }
            }

            $stmt->execute();

            // Handle file uploads if provided
            if (isset($_FILES['emiratesIDBack']) && $_FILES['emiratesIDBack']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../../uploads/emirates-id/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $fileName = $type . '_' . $id . '_back_' . time() . '_' . basename($_FILES['emiratesIDBack']['name']);
                $targetFile = $uploadDir . $fileName;
                move_uploaded_file($_FILES['emiratesIDBack']['tmp_name'], $targetFile);
                
                if ($type === 'ML') {
                    $fileStmt = $pdo->prepare("UPDATE residence SET eid_back_image = :file WHERE residenceID = :id");
                } else {
                    $fileStmt = $pdo->prepare("UPDATE freezone SET eid_back_image = :file WHERE id = :id");
                }
                $fileStmt->bindParam(':file', $fileName);
                $fileStmt->bindParam(':id', $id);
                $fileStmt->execute();
            }

            if (isset($_FILES['emiratesIDFront']) && $_FILES['emiratesIDFront']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../../uploads/emirates-id/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $fileName = $type . '_' . $id . '_front_' . time() . '_' . basename($_FILES['emiratesIDFront']['name']);
                $targetFile = $uploadDir . $fileName;
                move_uploaded_file($_FILES['emiratesIDFront']['tmp_name'], $targetFile);
                
                if ($type === 'ML') {
                    $fileStmt = $pdo->prepare("UPDATE residence SET eid_front_image = :file WHERE residenceID = :id");
                } else {
                    $fileStmt = $pdo->prepare("UPDATE freezone SET eid_front_image = :file WHERE id = :id");
                }
                $fileStmt->bindParam(':file', $fileName);
                $fileStmt->bindParam(':id', $id);
                $fileStmt->execute();
            }

            $pdo->commit();
            
            // Send email notification
            sendEIDNotificationEmail('received', [
                'passengerName' => $passengerName,
                'eidNumber' => $eidNumber,
                'eidExpiry' => $eidExpiryDate,
                'type' => $type
            ]);
            
            JWTHelper::sendResponse(200, true, 'Emirates ID marked as received successfully');

        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    if ($action == 'setMarkDelivered') {
        $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
        $type = isset($_POST['type']) ? $_POST['type'] : '';

        if (empty($id) || empty($type)) {
            JWTHelper::sendResponse(400, false, 'Missing ID or type');
        }

        // Get passenger details before updating
        if ($type === 'ML') {
            $getStmt = $pdo->prepare("SELECT passenger_name, EmiratesIDNumber FROM residence WHERE residenceID = :id");
        } else {
            $getStmt = $pdo->prepare("SELECT passangerName as passenger_name, eidNumber as EmiratesIDNumber FROM freezone WHERE id = :id");
        }
        $getStmt->bindParam(':id', $id);
        $getStmt->execute();
        $taskData = $getStmt->fetch(PDO::FETCH_ASSOC);

        if ($type === 'ML') {
            $stmt = $pdo->prepare("UPDATE residence SET eid_delivered = 1 WHERE residenceID = :id");
        } else {
            $stmt = $pdo->prepare("UPDATE freezone SET eid_delivered = 1 WHERE id = :id");
        }

        $stmt->bindParam(':id', $id);
        $stmt->execute();

        // Send email notification
        if ($taskData) {
            sendEIDNotificationEmail('delivered', [
                'passengerName' => $taskData['passenger_name'],
                'eidNumber' => $taskData['EmiratesIDNumber'] ?? 'N/A',
                'type' => $type
            ]);
        }

        JWTHelper::sendResponse(200, true, 'Emirates ID marked as delivered successfully');
    }

    if ($action == 'getPositions') {
        $stmt = $pdo->prepare("SELECT position_id, posiiton_name as position_name FROM position ORDER BY posiiton_name");
        $stmt->execute();
        $positions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        JWTHelper::sendResponse(200, true, 'Success', ['positions' => $positions]);
    }

    if ($action == 'getCompanies') {
        $stmt = $pdo->prepare("SELECT company_id, company_name FROM company ORDER BY company_name");
        $stmt->execute();
        $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        JWTHelper::sendResponse(200, true, 'Success', ['companies' => $companies]);
    }

    if ($action == 'addPosition') {
        $position_name = isset($_POST['position_name']) ? trim($_POST['position_name']) : '';
        
        if (empty($position_name)) {
            JWTHelper::sendResponse(400, false, 'Position name is required');
        }
        
        // Check if position already exists
        $checkStmt = $pdo->prepare("SELECT position_id FROM position WHERE LOWER(posiiton_name) = LOWER(:name)");
        $checkStmt->bindParam(':name', $position_name);
        $checkStmt->execute();
        
        if ($checkStmt->fetch()) {
            JWTHelper::sendResponse(400, false, 'Position already exists');
        }
        
        // Insert new position
        $stmt = $pdo->prepare("INSERT INTO position (posiiton_name) VALUES (:name)");
        $stmt->bindParam(':name', $position_name);
        $stmt->execute();
        $newId = $pdo->lastInsertId();
        
        JWTHelper::sendResponse(200, true, 'Position added successfully', [
            'position_id' => $newId,
            'position_name' => $position_name
        ]);
    }

    if ($action == 'addCompany') {
        $company_name = isset($_POST['company_name']) ? trim($_POST['company_name']) : '';
        
        if (empty($company_name)) {
            JWTHelper::sendResponse(400, false, 'Company name is required');
        }
        
        // Check if company already exists
        $checkStmt = $pdo->prepare("SELECT company_id FROM company WHERE LOWER(company_name) = LOWER(:name)");
        $checkStmt->bindParam(':name', $company_name);
        $checkStmt->execute();
        
        if ($checkStmt->fetch()) {
            JWTHelper::sendResponse(400, false, 'Company already exists');
        }
        
        // Insert new company
        $stmt = $pdo->prepare("INSERT INTO company (company_name) VALUES (:name)");
        $stmt->bindParam(':name', $company_name);
        $stmt->execute();
        $newId = $pdo->lastInsertId();
        
        JWTHelper::sendResponse(200, true, 'Company added successfully', [
            'company_id' => $newId,
            'company_name' => $company_name
        ]);
    }

} catch (Exception $e) {
    error_log("EID Tasks Controller Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Operation failed: ' . $e->getMessage());
}

