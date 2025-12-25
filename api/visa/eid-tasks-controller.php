<?php
/**
 * Emirates ID Tasks Controller API
 * Handles actions for EID tasks: getResidence, setMarkReceived, setMarkDelivered, getPositions, getCompanies
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

$action = isset($_POST['action']) ? $_POST['action'] : '';

$validActions = ['getResidence', 'setMarkReceived', 'setMarkDelivered', 'getPositions', 'getCompanies'];
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
                    $fileStmt = $pdo->prepare("UPDATE residence SET emiratesIDBackFile = :file WHERE residenceID = :id");
                } else {
                    $fileStmt = $pdo->prepare("UPDATE freezone SET emiratesIDBackFile = :file WHERE id = :id");
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
                    $fileStmt = $pdo->prepare("UPDATE residence SET emiratesIDFrontFile = :file WHERE residenceID = :id");
                } else {
                    $fileStmt = $pdo->prepare("UPDATE freezone SET emiratesIDFrontFile = :file WHERE id = :id");
                }
                $fileStmt->bindParam(':file', $fileName);
                $fileStmt->bindParam(':id', $id);
                $fileStmt->execute();
            }

            $pdo->commit();
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

        if ($type === 'ML') {
            $stmt = $pdo->prepare("UPDATE residence SET eid_delivered = 1 WHERE residenceID = :id");
        } else {
            $stmt = $pdo->prepare("UPDATE freezone SET eid_delivered = 1 WHERE id = :id");
        }

        $stmt->bindParam(':id', $id);
        $stmt->execute();

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

} catch (Exception $e) {
    error_log("EID Tasks Controller Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Operation failed: ' . $e->getMessage());
}

