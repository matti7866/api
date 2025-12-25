<?php
/**
 * Get Insurance Operation History API
 * Endpoint: /api/residence/get-insurance-history.php
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
    
    // Get insurance operation history with staff details
    $stmt = $pdo->prepare("
        SELECT 
            ic.*,
            s.staff_name as performed_by_name,
            a.account_Name as account_name
        FROM iloe_charges ic
        LEFT JOIN staff s ON ic.created_by = s.staff_id
        LEFT JOIN accounts a ON ic.account_id = a.account_ID
        WHERE ic.residence_id = :residence_id 
        AND ic.charge_type = 'insurance'
        AND ic.status = 'paid'
        ORDER BY ic.charge_date DESC
        LIMIT 1
    ");
    $stmt->bindParam(':residence_id', $residenceID);
    $stmt->execute();
    $operation = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Extract attachment from description if exists
    if ($operation) {
        $operation['has_attachment'] = false;
        $operation['attachment_path'] = null;
        
        if ($operation['description']) {
            // Look for "Attachment: filename" pattern in description
            if (preg_match('/Attachment: ([^,\)]+)/', $operation['description'], $matches)) {
                $operation['has_attachment'] = true;
                $operation['attachment_path'] = trim($matches[1]);
            }
        }
    }
    
    if ($operation) {
        JWTHelper::sendResponse(200, true, 'Insurance operation found', ['operation' => $operation]);
    } else {
        JWTHelper::sendResponse(200, true, 'No insurance operation found', ['operation' => null]);
    }
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error loading insurance history: ' . $e->getMessage());
}

