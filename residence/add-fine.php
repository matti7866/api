<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Add Residence Fine
 * Endpoint: /api/residence/add-fine.php
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

// Check permission
try {
    $sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['update'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['residenceID']) || !isset($data['fineAmount']) || !isset($data['accountID'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID, fineAmount, and accountID');
}

$residenceID = (int)$data['residenceID'];
$fineAmount = (float)$data['fineAmount'];
$accountID = (int)$data['accountID'];
$currencyID = isset($data['currencyID']) ? (int)$data['currencyID'] : null;

// Get staff_id from JWT token
$staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
if (!$staff_id) {
    JWTHelper::sendResponse(400, false, 'Staff ID is required. User not authenticated properly.');
}

try {
    // Verify residence exists
    $sql = "SELECT residenceID FROM residence WHERE residenceID = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Get account details to check if it's cash or not
    $getAccCur = $pdo->prepare("SELECT account_Name, curID FROM accounts WHERE account_ID = :accountID");
    $getAccCur->bindParam(':accountID', $accountID);
    $getAccCur->execute();
    $accCur = $getAccCur->fetch(PDO::FETCH_ASSOC);
    
    if (!$accCur) {
        JWTHelper::sendResponse(400, false, 'Invalid account selected');
    }
    
    // Determine the currency to use
    $finalCurrencyID = $currencyID;
    if ($accCur['account_Name'] != "Cash") {
        // If account is not Cash, use the account's currency
        $finalCurrencyID = (int)$accCur['curID'];
    } else if (!$finalCurrencyID) {
        // If Cash and no currency provided, default to AED (1)
        $finalCurrencyID = 1;
    }
    
    // Insert fine record - using imposedBy instead of staff_id
    $sql = "INSERT INTO residencefine (residenceID, fineAmount, fineCurrencyID, accountID, imposedBy) 
            VALUES (:residenceID, :fineAmount, :fineCurrencyID, :accountID, :imposedBy)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->bindParam(':fineAmount', $fineAmount);
    $stmt->bindParam(':fineCurrencyID', $finalCurrencyID);
    $stmt->bindParam(':accountID', $accountID);
    $stmt->bindParam(':imposedBy', $staff_id);
    $stmt->execute();
    
    JWTHelper::sendResponse(200, true, 'E-Visa fine added successfully', [
        'residenceID' => $residenceID,
        'fineAmount' => $fineAmount,
        'accountID' => $accountID,
        'currencyID' => $finalCurrencyID
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error adding fine: ' . $e->getMessage());
}

