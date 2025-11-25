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
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        echo json_encode(['error' => 'Permission denied', 'permission' => $permission, 'role_id' => $userData['role_id']]);
        exit;
    }
    
    // Simple query without complex JOINs
    $sql = "SELECT 
                a.*,
                COALESCE(at.type_name, 'Unknown') as asset_type_name,
                COALESCE(at.type_icon, 'fa-cube') as type_icon,
                COALESCE(c1.currencyName, 'AED') as purchase_currency,
                COALESCE(c1.currencyName, 'AED') as purchase_currency_symbol
            FROM assets a
            LEFT JOIN asset_types at ON a.asset_type_id = at.type_id
            LEFT JOIN currency c1 ON a.purchase_currency_id = c1.currencyID
            ORDER BY a.created_at DESC
            LIMIT 50";
    
    $stmt = $pdo->query($sql);
    $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Count total
    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM assets");
    $totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    echo json_encode([
        'success' => true,
        'message' => 'Assets retrieved successfully',
        'data' => [
            'assets' => $assets,
            'pagination' => [
                'total' => (int)$totalRecords,
                'page' => 1,
                'limit' => 50,
                'totalPages' => ceil($totalRecords / 50)
            ]
        ],
        'debug' => [
            'assets_count' => count($assets),
            'total_records' => $totalRecords,
            'permission' => $permission,
            'role_id' => $userData['role_id']
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}

