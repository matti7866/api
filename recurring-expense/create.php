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
    
    // Validate required fields
    $required = ['expense_name', 'category', 'amount', 'frequency', 'start_date'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim($input[$field]) === '') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => "Field '$field' is required"
            ], 400);
        }
    }
    
    // Validate category
    $validCategories = ['office_rent', 'shop_rent', 'sim_card', 'utilities', 'subscription', 'other'];
    if (!in_array($input['category'], $validCategories)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid category'
        ], 400);
    }
    
    // Validate frequency
    $validFrequencies = ['monthly', 'quarterly', 'yearly'];
    if (!in_array($input['frequency'], $validFrequencies)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Invalid frequency'
        ], 400);
    }
    
    // Insert recurring expense
    $sql = "INSERT INTO recurring_expenses (
                expense_name, category, amount, currency_id, 
                frequency, start_date, end_date, description, 
                is_active, branch_id, staff_id
            ) VALUES (
                :expense_name, :category, :amount, :currency_id,
                :frequency, :start_date, :end_date, :description,
                :is_active, :branch_id, :staff_id
            )";
    
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
        ':staff_id' => $user['staff_id']
    ]);
    
    $expenseId = $pdo->lastInsertId();
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Recurring expense created successfully',
        'data' => ['id' => $expenseId]
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in recurring-expense/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in recurring-expense/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}


