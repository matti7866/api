<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse(['success' => false, 'message' => 'Unauthorized'], 401);
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['ticket_id'])) {
        JWTHelper::sendResponse(['success' => false, 'message' => 'Ticket ID required'], 400);
    }
    
    $stmt = $pdo->prepare("DELETE FROM ticket WHERE ticket = :ticket_id");
    $stmt->execute([':ticket_id' => $input['ticket_id']]);
    
    JWTHelper::sendResponse(['success' => true, 'message' => 'Ticket deleted successfully']);
    
} catch (Exception $e) {
    error_log("Error in ticket/delete.php: " . $e->getMessage());
    JWTHelper::sendResponse(['success' => false, 'message' => 'Server error'], 500);
}

