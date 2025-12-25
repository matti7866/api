<?php
/**
 * Agent Change Password API (for logged-in agents)
 * Endpoint: /api/agent/change-password.php
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

header('Content-Type: application/json; charset=UTF-8');

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

try {
    // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['currentPassword']) || !isset($input['newPassword'])) {
        JWTHelper::sendResponse(400, false, 'Current password and new password are required');
    }
    
    $currentPassword = $input['currentPassword'];
    $newPassword = $input['newPassword'];
    
    // Validate new password strength
    if (strlen($newPassword) < 6) {
        JWTHelper::sendResponse(400, false, 'New password must be at least 6 characters long');
    }
    
    // Get agent's current password
    $query = "SELECT id, password FROM agents WHERE id = :id AND deleted = 0 LIMIT 1";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':id', $agentData['agent_id'], PDO::PARAM_INT);
    $stmt->execute();
    $agent = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$agent) {
        JWTHelper::sendResponse(404, false, 'Agent not found');
    }
    
    // Verify current password
    $storedPassword = trim($agent['password']);
    $isHashed = str_starts_with($storedPassword, '$2y$') || 
                str_starts_with($storedPassword, '$2a$') || 
                str_starts_with($storedPassword, '$2b$');
    
    $passwordValid = false;
    if ($isHashed) {
        $passwordValid = password_verify($currentPassword, $storedPassword);
    } else {
        // Plain text comparison (for migration)
        $passwordValid = ($storedPassword === $currentPassword);
    }
    
    if (!$passwordValid) {
        JWTHelper::sendResponse(401, false, 'Current password is incorrect');
    }
    
    // Hash new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
    
    // Update password
    $updateQuery = "UPDATE agents 
                    SET password = :password, 
                        datetime_updated = NOW()
                    WHERE id = :id";
    $updateStmt = $pdo->prepare($updateQuery);
    $updateStmt->bindParam(':password', $hashedPassword);
    $updateStmt->bindParam(':id', $agentData['agent_id'], PDO::PARAM_INT);
    $updateStmt->execute();
    
    JWTHelper::sendResponse(200, true, 'Password changed successfully');
    
} catch (PDOException $e) {
    error_log("Database Error in change-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
} catch (Exception $e) {
    error_log("Error in change-password: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error. Please try again later.');
}
?>



