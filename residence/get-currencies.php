<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Currency Types with Selected Values for Residence Steps
 * Endpoint: /api/residence/get-currencies.php
 * Matches old residenceController.php CurrencyTypes functionality
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
    $data = $_GET;
}

$type = isset($data['type']) ? $data['type'] : (isset($data['Type']) ? $data['Type'] : '');
$residenceID = isset($data['residenceID']) ? (int)$data['residenceID'] : (isset($data['SelectedCurrency']) ? (int)$data['SelectedCurrency'] : 0);

try {
    // Map type to database fields
    $typeFields = [
        'salaryCur' => 'salaryCurID',
        'offerLCostCur' => 'offerLetterCostCur',
        'laborCardFeeCur' => 'laborCardCur',
        'EvisaTying' => 'eVisaCur',
        'changeStatus' => 'changeStatusCur',
        'medicalTyping' => 'medicalTCur',
        'emiratesIDTyping' => 'emiratesIDCur',
        'visaStamping' => 'visaStampingCur',
        'insuranceCur' => 'insuranceCur'
    ];
    
    if ($type && isset($typeFields[$type]) && $residenceID) {
        // Get currency with selected value for this residence
        $field = $typeFields[$type];
        $sql = "SELECT currencyID, currencyName, 
                (SELECT IFNULL($field, 0) FROM residence WHERE residenceID = :residenceID) AS selectedCurrencyID 
                FROM currency 
                ORDER BY currencyName ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':residenceID', $residenceID);
        $stmt->execute();
        $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } else {
        // Get all currencies without selected value
        $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    JWTHelper::sendResponse(200, true, 'Success', $currencies);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

