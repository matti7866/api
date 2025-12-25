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

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

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
    
    // Get all roles
    if ($action == 'getRoles') {
        $sql = "SELECT * FROM roles ORDER BY role_name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $roles
        ]);
    }
    
    // Add role
    if ($action == 'addRole') {
        $role_name = $input['role_name'] ?? null;
        
        if (empty($role_name)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Role name is required'
            ]);
        }
        
        $sql = "INSERT INTO roles (role_name) VALUES (:role_name)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':role_name', $role_name);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Role added successfully'
        ]);
    }
    
    // Delete role
    if ($action == 'deleteRole') {
        $role_id = $input['role_id'] ?? null;
        
        if (empty($role_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Role ID is required'
            ]);
        }
        
        $sql = "DELETE FROM roles WHERE role_id = :role_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':role_id', $role_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Role deleted successfully'
        ]);
    }
    
    // Default response for unknown action
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action: ' . $action
    ]);
    
} catch (PDOException $e) {
    error_log("Role API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Role API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>



