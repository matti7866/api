<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Add Residence Custom Charge
 * Endpoint: /api/residence/add-custom-charge.php
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

if (!isset($data['residenceID']) || !isset($data['chargeTitle']) || !isset($data['netCost']) || !isset($data['salePrice']) || !isset($data['accountID'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields: residenceID, chargeTitle, netCost, salePrice, and accountID');
}

$residenceID = (int)$data['residenceID'];
$chargeTitle = trim($data['chargeTitle']);
$netCost = (float)$data['netCost'];
$salePrice = (float)$data['salePrice'];
$accountID = (int)$data['accountID'];
$remarks = isset($data['remarks']) ? trim($data['remarks']) : '';

// Validate inputs
if (empty($chargeTitle)) {
    JWTHelper::sendResponse(400, false, 'Charge title is required');
}

if ($netCost < 0 || $salePrice < 0) {
    JWTHelper::sendResponse(400, false, 'Net cost and sale price must be non-negative');
}

// Get staff_id from JWT token
$staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
if (!$staff_id) {
    JWTHelper::sendResponse(400, false, 'Staff ID is required. User not authenticated properly.');
}

try {
    // Create table if it doesn't exist (outside transaction)
    $createTableSQL = "CREATE TABLE IF NOT EXISTS `residence_custom_charges` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `residence_id` INT NOT NULL,
        `charge_title` VARCHAR(255) NOT NULL,
        `net_cost` DECIMAL(10,2) NOT NULL DEFAULT 0,
        `sale_price` DECIMAL(10,2) NOT NULL DEFAULT 0,
        `profit` DECIMAL(10,2) NOT NULL DEFAULT 0,
        `account_id` INT NOT NULL,
        `currency_id` INT NOT NULL,
        `remarks` TEXT,
        `created_by` INT NOT NULL,
        `created_at` DATETIME NOT NULL,
        INDEX `idx_residence` (`residence_id`),
        INDEX `idx_created` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    try {
        $pdo->exec($createTableSQL);
    } catch (Exception $tableError) {
        // Table might already exist, continue
        error_log("Table creation note: " . $tableError->getMessage());
    }
    
    // Start transaction for data insertion
    $pdo->beginTransaction();
    
    // Verify residence exists and get currency
    $resQuery = $pdo->prepare("SELECT saleCurID, customer_id FROM residence WHERE residenceID = :residence_id");
    $resQuery->bindParam(':residence_id', $residenceID);
    $resQuery->execute();
    $residence = $resQuery->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        throw new Exception('Residence not found');
    }
    
    // Calculate profit
    $profit = $salePrice - $netCost;
    
    // Insert custom charge
    $insertSQL = "INSERT INTO `residence_custom_charges` 
                 (`residence_id`, `charge_title`, `net_cost`, `sale_price`, `profit`, `account_id`, `currency_id`, `remarks`, `created_by`, `created_at`) 
                 VALUES (:residence_id, :charge_title, :net_cost, :sale_price, :profit, :account_id, :currency_id, :remarks, :created_by, NOW())";
    $stmt = $pdo->prepare($insertSQL);
    $stmt->bindParam(':residence_id', $residenceID);
    $stmt->bindParam(':charge_title', $chargeTitle);
    $stmt->bindParam(':net_cost', $netCost);
    $stmt->bindParam(':sale_price', $salePrice);
    $stmt->bindParam(':profit', $profit);
    $stmt->bindParam(':account_id', $accountID);
    $stmt->bindParam(':currency_id', $residence['saleCurID']);
    $stmt->bindParam(':remarks', $remarks);
    $stmt->bindParam(':created_by', $staff_id);
    $stmt->execute();
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Custom charge "' . $chargeTitle . '" added successfully', [
        'residenceID' => $residenceID,
        'chargeTitle' => $chargeTitle,
        'netCost' => $netCost,
        'salePrice' => $salePrice,
        'profit' => $profit,
        'accountID' => $accountID,
        'currencyID' => $residence['saleCurID']
    ]);
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("AddCustomCharge Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error adding custom charge: ' . $e->getMessage());
}







