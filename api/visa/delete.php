<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
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
    $checkStmt = $pdo->prepare("SELECT visa_id, visaCopy FROM visa WHERE visa_id = :visa_id");
    $checkStmt->execute([':visa_id' => $visaId]);
    $visa = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$visa) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Visa not found'
        ], 404);
    }
    
    // Delete file if exists
    if ($visa['visaCopy']) {
        $filePath = __DIR__ . '/../../' . $visa['visaCopy'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
    }
    
    // Delete visa
    $deleteStmt = $pdo->prepare("DELETE FROM visa WHERE visa_id = :visa_id");
    $deleteStmt->execute([':visa_id' => $visaId]);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Visa deleted successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in visa/delete.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in visa/delete.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













