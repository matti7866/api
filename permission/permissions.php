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
    
    // Get permissions for a role
    if ($action == 'getPermissions') {
        $role_id = $input['role_id'] ?? null;
        
        if (empty($role_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Role ID is required'
            ]);
        }
        
        $sql = "SELECT `select`, `insert`, `update`, `delete`, page_name 
                FROM permission 
                WHERE role_id = :role_id 
                ORDER BY permission_id ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':role_id', $role_id);
        $stmt->execute();
        $permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $permissions
        ]);
    }
    
    // Save permissions
    if ($action == 'savePermissions') {
        $role_id = $input['role_id'] ?? null;
        $permissions = $input['permissions'] ?? null;
        
        if (empty($role_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Role ID is required'
            ]);
        }
        
        if (!is_array($permissions)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Permissions array is required'
            ]);
        }
        
        $pdo->beginTransaction();
        
        // Check if permissions exist for this role
        $checkSql = "SELECT DISTINCT role_id FROM permission WHERE role_id = :roleID LIMIT 1";
        $checkStmt = $pdo->prepare($checkSql);
        $checkStmt->bindParam(':roleID', $role_id);
        $checkStmt->execute();
        $existingRole = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete existing permissions if any
        if ($existingRole) {
            $deleteSql = "DELETE FROM permission WHERE role_id = :roleID";
            $deleteStmt = $pdo->prepare($deleteSql);
            $deleteStmt->bindParam(':roleID', $role_id);
            $deleteStmt->execute();
        }
        
        // Insert new permissions
        $insertSql = "INSERT INTO permission (`role_id`, `page_name`, `select`, `insert`, `update`, `delete`)
                      VALUES (:role_id, :page_name, :select, :insert, :update, :delete)";
        $insertStmt = $pdo->prepare($insertSql);
        
        foreach ($permissions as $permission) {
            $insertStmt->bindParam(':role_id', $role_id);
            $insertStmt->bindParam(':page_name', $permission['page_name']);
            $insertStmt->bindParam(':select', $permission['select']);
            $insertStmt->bindParam(':insert', $permission['insert']);
            $insertStmt->bindParam(':update', $permission['update']);
            $insertStmt->bindParam(':delete', $permission['delete']);
            $insertStmt->execute();
        }
        
        $pdo->commit();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Permissions saved successfully'
        ]);
    }
    
    // Default response for unknown action
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action: ' . $action
    ]);
    
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Permission API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log("Permission API Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>


