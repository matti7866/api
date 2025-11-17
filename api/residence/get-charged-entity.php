<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Charged Entity (Accounts/Suppliers) for Residence Steps
 * Endpoint: /api/residence/get-charged-entity.php
 * Matches old residenceController.php GetChargedEnitity functionality
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

$residenceID = isset($data['residenceID']) ? (int)$data['residenceID'] : (isset($data['ID']) ? (int)$data['ID'] : 0);
$type = isset($data['type']) ? $data['type'] : (isset($data['Type']) ? $data['Type'] : '');
$handler = isset($data['handler']) ? $data['handler'] : (isset($data['Handler']) ? $data['Handler'] : 'load');
$chargedON = isset($data['chargedON']) ? (int)$data['chargedON'] : (isset($data['ChargedON']) ? (int)$data['ChargedON'] : null);

if (!$residenceID || !$type) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID and type');
}

try {
    // Map type to database fields
    $typeFields = [
        'offerLetter' => ['supplier' => 'offerLetterSupplier', 'account' => 'offerLetterAccount'],
        'LaborCard' => ['supplier' => 'laborCardSupplier', 'account' => 'laborCardAccount'],
        'EVisaTyping' => ['supplier' => 'eVisaSupplier', 'account' => 'eVisaAccount'],
        'changeStatus' => ['supplier' => 'changeStatusSupplier', 'account' => 'changeStatusAccount'],
        'medicalTyping' => ['supplier' => 'medicalSupplier', 'account' => 'medicalAccount'],
        'emiratesIDTyping' => ['supplier' => 'emiratesIDSupplier', 'account' => 'emiratesIDAccount'],
        'visaStamping' => ['supplier' => 'visaStampingSupplier', 'account' => 'visaStampingAccount'],
        'insurance' => ['supplier' => 'insuranceSupplier', 'account' => 'insuranceAccount']
    ];
    
    if (!isset($typeFields[$type])) {
        JWTHelper::sendResponse(400, false, 'Invalid type. Supported types: offerLetter, LaborCard, EVisaTyping, changeStatus, medicalTyping, emiratesIDTyping, visaStamping, insurance');
    }
    
    $supplierField = $typeFields[$type]['supplier'];
    $accountField = $typeFields[$type]['account'];
    
    // Determine if we should load accounts or suppliers
    if ($handler === 'load') {
        // Check what's currently set in the database
        $checkStmt = $pdo->prepare("SELECT IFNULL($supplierField, 0) AS supplier, IFNULL($accountField, 0) AS account FROM residence WHERE residenceID = :residenceID");
        $checkStmt->bindParam(':residenceID', $residenceID);
        $checkStmt->execute();
        $result = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result && $result['supplier'] != 0) {
            // Load suppliers
            $chargedON = 2;
        } else {
            // Load accounts
            $chargedON = 1;
        }
    }
    
    // Load accounts or suppliers based on chargedON
    if ($chargedON == 2) {
        // Load suppliers
        $sql = "SELECT supp_id, supp_name, 
                (SELECT IFNULL($supplierField, 0) FROM residence WHERE residenceID = :residenceID) AS selectedSupplier, 
                2 AS chargedON 
                FROM supplier 
                ORDER BY supp_name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $entities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Load accounts
        $sql = "SELECT account_ID, account_Name, 
                (SELECT IFNULL($accountField, 0) FROM residence WHERE residenceID = :residenceID) AS selectedAccount, 
                1 AS chargedON 
                FROM accounts 
                ORDER BY account_Name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $entities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    JWTHelper::sendResponse(200, true, 'Success', $entities);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

