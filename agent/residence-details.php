<?php
/**
 * Get Residence Details for Agent
 * Endpoint: /api/agent/residence-details.php
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$agentData = JWTHelper::verifyRequest();

if (!$agentData || !isset($agentData['type']) || $agentData['type'] !== 'agent') {
    JWTHelper::sendResponse(401, false, 'Unauthorized - Agent access only');
}

// Get residence ID
$residence_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

if (!$residence_id) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    // Get agent's customer_id
    $customer_id = $agentData['customer_id'];
    
    // Get residence details - ensure it belongs to agent's customer
    $sql = "SELECT 
                r.*,
                c.customer_name,
                a.countryName as nationality_name,
                a.countryCode,
                s.serviceName as visa_type_name,
                curr.currencyName as sale_currency_name,
                comp.company_name,
                comp.company_number,
                pos.posiiton_name as position_name,
                COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE PaymentFor = r.residenceID), 0) AS total_paid,
                COALESCE((SELECT SUM(fineAmount) FROM residencefine WHERE residencefine.residenceID = r.residenceID), 0) AS total_fine
            FROM residence r
            LEFT JOIN customer c ON r.customer_id = c.customer_id
            LEFT JOIN airports a ON r.Nationality = a.airport_id
            LEFT JOIN service s ON r.VisaType = s.serviceID
            LEFT JOIN currency curr ON r.saleCurID = curr.currencyID
            LEFT JOIN company comp ON r.company = comp.company_id
            LEFT JOIN position pos ON r.positionID = pos.position_id
            WHERE r.residenceID = :residence_id 
            AND r.customer_id = :customer_id
            AND (r.deleted = 0 OR r.deleted IS NULL)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residence_id', $residence_id, PDO::PARAM_INT);
    $stmt->bindParam(':customer_id', $customer_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        JWTHelper::sendResponse(404, false, 'Residence not found or you do not have permission to view it');
    }
    
    JWTHelper::sendResponse(200, true, 'Success', $residence);
    
} catch (Exception $e) {
    error_log("Agent residence details error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error fetching residence details');
}
?>



