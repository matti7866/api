<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Step Data for Residence
 * Endpoint: /api/residence/get-step-data.php
 * Supports: EditBasicData, GetSalaryAndCostAmounts, GetInsuranceCost, GetLabourCrdIDAndFee, etc.
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    $data = $_POST;
}

$residenceID = isset($data['residenceID']) ? (int)$data['residenceID'] : (isset($data['GRID']) ? (int)$data['GRID'] : (isset($data['ID']) ? (int)$data['ID'] : 0));

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    $action = isset($data['action']) ? $data['action'] : '';
    
    // EditBasicData - Get Step 1 (Basic Information) data
    if ($action === 'EditBasicData' || isset($data['EditBasicData'])) {
        $sql = "SELECT 
                    customer_id, passenger_name, Nationality, VisaType, sale_price, saleCurID, 
                    passportNumber, passportExpiryDate, InsideOutside, uid, salary_amount, 
                    positionID, gender, dob, res_type,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 1 LIMIT 1),0) AS ResidenceDocID,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 11 LIMIT 1),0) AS ResidenceDocIDPhoto,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 12 LIMIT 1),0) AS ResidenceDocIDIDFront,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 13 LIMIT 1),0) AS ResidenceDocIDIDBack
                FROM residence 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetSalaryAndCostAmounts - Get Step 2 (Offer Letter) data
    elseif ($action === 'GetSalaryAndCostAmounts' || isset($data['GetSalaryAndCostAmounts'])) {
        $sql = "SELECT 
                    IFNULL(salary_amount,0) AS salary_amount, 
                    mb_number, 
                    IFNULL(offerLetterCost,0) AS offerLetterCost,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 2 LIMIT 1),0) AS ResidenceDocID,
                    positionID,
                    company
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetInsuranceCost - Get Step 3 (Insurance) data
    elseif ($action === 'GetInsuranceCost' || isset($data['GetInsuranceCost'])) {
        $sql = "SELECT 
                    IFNULL(insuranceCost,0) AS insuranceCost,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 3 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetLabourCrdIDAndFee - Get Step 4 (Labor Card) data
    elseif ($action === 'GetLabourCrdIDAndFee' || isset($data['GetLabourCrdIDAndFee'])) {
        $sql = "SELECT 
                    IFNULL(laborCardID,'') AS laborCardID,
                    IFNULL(laborCardFee,0) AS laborCardFee,
                    mb_number,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 4 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetEVisaTyping - Get Step 5 (E-Visa) data
    elseif ($action === 'GetEVisaTyping' || isset($data['GetEVisaTyping'])) {
        $sql = "SELECT 
                    IFNULL(eVisaCost,0) AS eVisaCost,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 5 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetChangeStatus - Get Step 6 (Change Status) data
    elseif ($action === 'GetChangeStatus' || isset($data['GetChangeStatus'])) {
        $sql = "SELECT 
                    IFNULL(changeStatusCost,0) AS changeStatusCost,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 6 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetMedicalTyping - Get Step 7 (Medical) data
    elseif ($action === 'GetMedicalTyping' || isset($data['GetMedicalTyping'])) {
        $sql = "SELECT 
                    IFNULL(medicalTCost,0) AS medicalTCost,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 7 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetEmiratesIDTyping - Get Step 8 (Emirates ID) data
    elseif ($action === 'GetEmiratesIDTyping' || isset($data['GetEmiratesIDTyping'])) {
        $sql = "SELECT 
                    IFNULL(emiratesIDCost,0) AS emiratesIDCost,
                    IFNULL(EmiratesIDNumber,'') AS EmiratesIDNumber,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 8 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetVisaStamping - Get Step 9 (Visa Stamping) data
    elseif ($action === 'GetVisaStamping' || isset($data['GetVisaStamping'])) {
        $sql = "SELECT 
                    IFNULL(visaStampingCost,0) AS visaStampingCost,
                    IFNULL(LabourCardNumber,'') AS LabourCardNumber,
                    IFNULL(expiry_date,'') AS expiry_date,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 9 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    // GetContractSubmmision - Get Step 10 (Contract Submission) data
    elseif ($action === 'GetContractSubmmision' || isset($data['GetContractSubmmision'])) {
        $sql = "SELECT 
                    IFNULL(EmiratesIDNumber,'') AS EmiratesIDNumber,
                    IFNULL(eid_received,0) AS eid_received,
                    IFNULL(eid_receive_datetime,'') AS eid_receive_datetime,
                    IFNULL(eid_expiry,'') AS eid_expiry,
                    IFNULL(eid_front_image,'') AS eid_front_image,
                    IFNULL(eid_back_image,'') AS eid_back_image,
                    IFNULL(eid_delivered,0) AS eid_delivered,
                    IFNULL(eid_delivered_datetime,'') AS eid_delivered_datetime,
                    IFNULL((SELECT IFNULL(ResidenceDocID,0) FROM `residencedocuments` WHERE ResID = :residenceID AND fileType = 10 LIMIT 1),0) AS ResidenceDocID
                FROM `residence` 
                WHERE residenceID = :residenceID";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        JWTHelper::sendResponse(200, true, 'Success', [$result]);
    }
    
    else {
        JWTHelper::sendResponse(400, false, 'Invalid action. Supported actions: EditBasicData, GetSalaryAndCostAmounts, GetInsuranceCost, GetLabourCrdIDAndFee, GetEVisaTyping, GetChangeStatus, GetMedicalTyping, GetEmiratesIDTyping, GetVisaStamping, GetContractSubmmision');
    }
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

