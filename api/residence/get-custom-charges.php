<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Residence Custom Charges
 * Endpoint: /api/residence/get-custom-charges.php
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

// Get residenceID from query parameter
$residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : null;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Missing required parameter: residenceID');
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Check if table exists first
    try {
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'residence_custom_charges'");
        if ($tableCheck->rowCount() == 0) {
            JWTHelper::sendResponse(200, true, 'No custom charges found', [
                'charges' => []
            ]);
        }
    } catch (Exception $tableError) {
        error_log("GetCustomCharges: Table check failed: " . $tableError->getMessage());
        JWTHelper::sendResponse(200, true, 'No custom charges found', [
            'charges' => []
        ]);
    }
    
    // Get all custom charges for this residence
    $query = "SELECT 
                rcc.id,
                rcc.residence_id,
                rcc.charge_title,
                rcc.net_cost,
                rcc.sale_price,
                rcc.profit,
                rcc.account_id,
                rcc.currency_id,
                rcc.remarks,
                DATE_FORMAT(rcc.created_at, '%Y-%m-%d %H:%i') as created_at,
                rcc.created_by,
                COALESCE(s.staff_name, 'System') as staff_name
              FROM residence_custom_charges rcc
              LEFT JOIN staff s ON rcc.created_by = s.staff_id
              WHERE rcc.residence_id = :residence_id
              ORDER BY rcc.created_at DESC";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':residence_id', $residenceID);
    $stmt->execute();
    $charges = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Custom charges retrieved successfully', [
        'charges' => $charges
    ]);
    
} catch (Exception $e) {
    error_log("GetCustomCharges Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving custom charges: ' . $e->getMessage());
}







