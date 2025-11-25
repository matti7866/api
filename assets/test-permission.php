<?php
require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    echo json_encode(['error' => 'Unauthorized', 'userData' => null]);
    exit;
}

try {
    // Check permission
    $sql = "SELECT * FROM `permission` WHERE page_name = 'Assets'";
    $stmt = $pdo->query($sql);
    $permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Check user's specific permission
    $userSql = "SELECT permission.* FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
    $userStmt = $pdo->prepare($userSql);
    $userStmt->bindParam(':role_id', $userData['role_id']);
    $userStmt->execute();
    $userPermission = $userStmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'user_data' => $userData,
        'all_assets_permissions' => $permissions,
        'user_permission' => $userPermission,
        'permission_exists' => !empty($userPermission),
        'has_select_permission' => $userPermission ? ($userPermission['select'] == 1) : false
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}

