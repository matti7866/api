<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['visa_id'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Visa ID is required'
        ], 400);
    }
    
    $visaId = $input['visa_id'];
    
    // Check if visa exists
    $checkStmt = $pdo->prepare("SELECT visa_id FROM visa WHERE visa_id = :visa_id");
    $checkStmt->execute([':visa_id' => $visaId]);
    
    if (!$checkStmt->fetch()) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Visa not found'
        ], 404);
    }
    
    // Build UPDATE query dynamically
    $allowedFields = ['customer_id', 'passenger_name', 'supp_id', 'country_id',
                      'net_price', 'netCurrencyID', 'sale', 'saleCurrencyID',
                      'gaurantee', 'address', 'PassportNum', 'nationalityID', 'pendingvisa'];
    
    $updateFields = [];
    $params = [':visa_id' => $visaId];
    
    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updateFields[] = "$field = :$field";
            $params[":$field"] = $input[$field];
        }
    }
    
    if (empty($updateFields)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'No fields to update'
        ], 400);
    }
    
    $sql = "UPDATE visa SET " . implode(', ', $updateFields) . " WHERE visa_id = :visa_id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Visa updated successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in visa/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in visa/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













