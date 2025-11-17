<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token first
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get all expense types
    if ($action == 'getExpenseTypes') {
        $stmt = $pdo->prepare("SELECT * FROM expense_type ORDER BY expense_type ASC");
        $stmt->execute();
        $expenseTypes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $expenseTypes
        ]);
    }
    
    // Create expense type
    if ($action == 'createExpenseType') {
        $expense_type = isset($input['expense_type']) ? trim($input['expense_type']) : null;
        
        if (!$expense_type) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense type name is required'
            ]);
        }
        
        try {
            $sql = "INSERT INTO `expense_type`(`expense_type`) VALUES(:expense_type)";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':expense_type', $expense_type);
            $stmt->execute();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Expense type created successfully'
            ]);
        } catch (PDOException $e) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Update expense type
    if ($action == 'updateExpenseType') {
        $expense_type_id = isset($input['expense_type_id']) ? intval($input['expense_type_id']) : null;
        $expense_type = isset($input['expense_type']) ? trim($input['expense_type']) : null;
        
        if (!$expense_type_id || !$expense_type) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense type ID and name are required'
            ]);
        }
        
        try {
            $sql = "UPDATE `expense_type` SET expense_type = :expense_type WHERE expense_type_id = :expense_type_id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':expense_type', $expense_type);
            $stmt->bindParam(':expense_type_id', $expense_type_id);
            $stmt->execute();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Expense type updated successfully'
            ]);
        } catch (PDOException $e) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Delete expense type
    if ($action == 'deleteExpenseType') {
        $expense_type_id = isset($input['expense_type_id']) ? intval($input['expense_type_id']) : null;
        
        if (!$expense_type_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense type ID is required'
            ]);
        }
        
        try {
            $sql = "DELETE FROM expense_type WHERE expense_type_id = :expense_type_id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':expense_type_id', $expense_type_id);
            $stmt->execute();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Expense type deleted successfully'
            ]);
        } catch (PDOException $e) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Get expense type by ID
    if ($action == 'getExpenseType') {
        $expense_type_id = isset($input['expense_type_id']) ? intval($input['expense_type_id']) : null;
        
        if (!$expense_type_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense type ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM expense_type WHERE expense_type_id = :expense_type_id");
        $stmt->bindParam(':expense_type_id', $expense_type_id);
        $stmt->execute();
        $expenseType = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($expenseType) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $expenseType
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense type not found'
            ]);
        }
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

