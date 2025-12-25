<?php
/**
 * Get Agent Profile
 * Endpoint: /api/agent/me.php
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

try {
    // Get agent details
    $sql = "SELECT a.*, c.customer_name, c.customer_phone, c.customer_email 
            FROM agents a
            LEFT JOIN customer c ON a.customer_id = c.customer_id
            WHERE a.id = :agent_id AND a.deleted = 0";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':agent_id', $agentData['agent_id']);
    $stmt->execute();
    
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(404, false, 'Agent not found');
    }
    
    // Remove password from response
    unset($agent['password']);
    
    JWTHelper::sendResponse(200, true, 'Success', $agent);
    
} catch (Exception $e) {
    error_log("Get agent profile error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error fetching agent profile');
}
?>



