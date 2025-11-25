<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

/**
 * Get Assets List
 * Endpoint: /api/assets/list.php
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Restrict access to staff_id = 1 only
if (!isset($userData['staff_id']) || $userData['staff_id'] != 1) {
    JWTHelper::sendResponse(403, false, 'Access denied. This module is restricted to administrators only.');
}

// Check permission
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Assets'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        error_log("Permission check failed for Assets - User role_id: " . $userData['role_id']);
        error_log("Permission result: " . json_encode($permission));
        JWTHelper::sendResponse(403, false, 'Permission denied - No view access to Assets module');
    }
    
    error_log("Permission check passed for Assets - User role_id: " . $userData['role_id']);
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get query parameters
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$status = isset($_GET['status']) ? $_GET['status'] : '';
$assetType = isset($_GET['asset_type_id']) ? (int)$_GET['asset_type_id'] : 0;

$offset = ($page - 1) * $limit;

try {
    // Build WHERE clause
    $whereConditions = [];
    $params = [];
    
    if ($search) {
        $whereConditions[] = "(a.asset_name LIKE :search OR a.serial_number LIKE :search OR a.registration_number LIKE :search OR a.brand LIKE :search OR a.model LIKE :search)";
        $params[':search'] = "%$search%";
    }
    
    if ($status) {
        $whereConditions[] = "a.status = :status";
        $params[':status'] = $status;
    }
    
    if ($assetType > 0) {
        $whereConditions[] = "a.asset_type_id = :asset_type_id";
        $params[':asset_type_id'] = $assetType;
    }
    
    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
    
    // Get total count - simple query without JOINs
    $countSql = "SELECT COUNT(*) as total FROM assets a $whereClause";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Debug logging
    error_log("Assets count query: $countSql");
    error_log("Total records found: $totalRecords");
    error_log("WHERE clause: $whereClause");
    error_log("Params: " . json_encode($params));
    
    // Get assets list - simplified query
    $sql = "SELECT 
                a.asset_id,
                a.asset_name,
                a.asset_type_id,
                COALESCE(at.type_name, 'Unknown') as asset_type_name,
                COALESCE(at.type_icon, 'fa-cube') as type_icon,
                a.purchase_date,
                a.purchase_price,
                a.purchase_currency_id,
                COALESCE(c1.currencyName, 'AED') as purchase_currency,
                COALESCE(c1.currencyName, 'AED') as purchase_currency_symbol,
                a.current_value,
                a.depreciation_rate,
                a.description,
                a.location,
                a.serial_number,
                a.registration_number,
                a.brand,
                a.model,
                a.year,
                a.condition,
                a.status,
                a.sold_date,
                a.sold_price,
                a.sold_to,
                a.notes,
                a.created_by,
                COALESCE(s.staff_name, '') as created_by_name,
                a.created_at,
                a.updated_at,
                0 as document_count,
                0 as maintenance_count
            FROM assets a
            LEFT JOIN asset_types at ON a.asset_type_id = at.type_id
            LEFT JOIN currency c1 ON a.purchase_currency_id = c1.currencyID
            LEFT JOIN staff s ON a.created_by = s.staff_id";
    
    // Add WHERE clause if needed
    if (!empty($whereClause)) {
        $sql .= " " . $whereClause;
    }
    
    $sql .= " ORDER BY a.created_at DESC LIMIT :limit OFFSET :offset";
    
    try {
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Debug logging
        error_log("Assets query executed successfully");
        error_log("Assets found: " . count($assets));
        error_log("SQL: " . $sql);
        
        // If no assets but we know they exist, try simpler query
        if (count($assets) == 0 && $totalRecords > 0) {
            error_log("WARNING: Query returned 0 assets but count says $totalRecords exist. Trying simpler query...");
            $simpleSql = "SELECT * FROM assets $whereClause ORDER BY created_at DESC LIMIT :limit OFFSET :offset";
            $simpleStmt = $pdo->prepare($simpleSql);
            foreach ($params as $key => $value) {
                $simpleStmt->bindValue($key, $value);
            }
            $simpleStmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $simpleStmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $simpleStmt->execute();
            $assets = $simpleStmt->fetchAll(PDO::FETCH_ASSOC);
            error_log("Simple query returned: " . count($assets) . " assets");
        }
        
    } catch (Exception $queryError) {
        error_log("Query error: " . $queryError->getMessage());
        error_log("SQL: " . $sql);
        throw $queryError;
    }
    
    // Calculate pagination
    $totalPages = ceil($totalRecords / $limit);
    
    JWTHelper::sendResponse(200, true, 'Assets retrieved successfully', [
        'assets' => $assets,
        'pagination' => [
            'total' => (int)$totalRecords,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => $totalPages
        ]
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error retrieving assets: ' . $e->getMessage());
}

