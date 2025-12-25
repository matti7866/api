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
    
    // Update recurring expense
    $sql = "UPDATE recurring_expenses SET
                expense_name = :expense_name,
                category = :category,
                amount = :amount,
                currency_id = :currency_id,
                frequency = :frequency,
                start_date = :start_date,
                end_date = :end_date,
                description = :description,
                is_active = :is_active,
                branch_id = :branch_id
            WHERE id = :id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':expense_name' => $input['expense_name'],
        ':category' => $input['category'],
        ':amount' => $input['amount'],
        ':currency_id' => $input['currency_id'] ?? 1,
        ':frequency' => $input['frequency'],
        ':start_date' => $input['start_date'],
        ':end_date' => $input['end_date'] ?? null,
        ':description' => $input['description'] ?? null,
        ':is_active' => $input['is_active'] ?? 1,
        ':branch_id' => $input['branch_id'] ?? null,
        ':id' => $input['id']
    ]);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Recurring expense updated successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in recurring-expense/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in recurring-expense/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}


