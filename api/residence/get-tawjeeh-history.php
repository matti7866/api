<?php
/**
 * Get Tawjeeh Operation History API
 * Endpoint: /api/residence/get-tawjeeh-history.php
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

header('Content-Type: application/json');

try {
    $residenceID = $_GET['residenceID'] ?? null;
    
    if (!$residenceID) {
        JWTHelper::sendResponse(400, false, 'Missing residenceID parameter');
    }
    
    // Get tawjeeh operation history with staff details
    $stmt = $pdo->prepare("
        SELECT 
            tc.*,
            s.staff_name as performed_by_name,
            a.account_Name as account_name
        FROM tawjeeh_charges tc
        LEFT JOIN staff s ON tc.created_by = s.staff_id
        LEFT JOIN accounts a ON tc.account_id = a.account_ID
        WHERE tc.residence_id = :residence_id 
        AND tc.status = 'paid'
        ORDER BY tc.charge_date DESC
        LIMIT 1
    ");
    $stmt->bindParam(':residence_id', $residenceID);
    $stmt->execute();
    $operation = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($operation) {
        JWTHelper::sendResponse(200, true, 'Tawjeeh operation found', ['operation' => $operation]);
    } else {
        JWTHelper::sendResponse(200, true, 'No tawjeeh operation found', ['operation' => null]);
    }
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error loading tawjeeh history: ' . $e->getMessage());
}

