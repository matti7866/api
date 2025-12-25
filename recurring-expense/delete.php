<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
    
    // Validate ID
    if (!isset($input['id'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Expense ID is required'
        ], 400);
    }
    
    // Check if expense exists
    $checkStmt = $pdo->prepare("SELECT id FROM recurring_expenses WHERE id = :id");
    $checkStmt->execute([':id' => $input['id']]);
    if (!$checkStmt->fetch()) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Recurring expense not found'
        ], 404);
    }
    
    // Delete recurring expense
    $stmt = $pdo->prepare("DELETE FROM recurring_expenses WHERE id = :id");
    $stmt->execute([':id' => $input['id']]);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Recurring expense deleted successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in recurring-expense/delete.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in recurring-expense/delete.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}


