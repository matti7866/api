<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Establishments API
 * Endpoint: /api/establishments/get-establishments.php
 * Returns paginated list of establishments with filters
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

// Check permission - try different possible page names or skip if not configured
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND (page_name = 'Establishments' OR page_name = 'Establishment' OR page_name = 'Company')";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Only enforce permission if it exists and is set to 0
    // If permission doesn't exist, allow access (page not in permission system yet)
    if ($permission && $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
    // If permission doesn't exist at all, allow access (for now - can be configured later)
} catch (Exception $e) {
    // Log error but allow access if permission check fails (for development)
    error_log('Permission check error: ' . $e->getMessage());
    // Don't block access if permission check fails
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

// Get filter parameters
$companyName = isset($_POST['companyName']) ? trim($_POST['companyName']) : '';
$companyType = isset($_POST['companyType']) ? trim($_POST['companyType']) : '';
$localName = isset($_POST['localName']) ? trim($_POST['localName']) : '';

// Pagination parameters
$page = isset($_POST['page']) ? max(1, (int)$_POST['page']) : 1;
$limit = isset($_POST['limit']) ? max(1, min(100, (int)$_POST['limit'])) : 10;
$offset = ($page - 1) * $limit;

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Build WHERE clause
    $where = 'WHERE 1=1';
    $params = [];
    
    if ($companyName != '') {
        $where .= ' AND company.company_name LIKE :companyName';
        $params[':companyName'] = '%' . $companyName . '%';
    }
    
    if ($companyType != '') {
        $where .= ' AND company.company_type = :companyType';
        $params[':companyType'] = $companyType;
    }
    
    if ($localName != '') {
        // Match local name directly (frontend sends the actual local_name value)
        $where .= ' AND company.local_name = :localName';
        $params[':localName'] = $localName;
    }
    
    // Get total count for pagination
    $countSql = "SELECT COUNT(DISTINCT company.company_id) FROM company $where";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalRecords = $countStmt->fetchColumn();
    $totalPages = ceil($totalRecords / $limit);
    
    // Fetch paginated establishments with employee count
    $sql = "
        SELECT 
            company.*,
            IFNULL(COUNT(residence.residenceID), 0) as totalEmployees
        FROM company
        LEFT JOIN residence ON residence.company = company.company_id
        $where
        GROUP BY company.company_id
        ORDER BY company.company_id DESC
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $establishments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get statistics (total establishments, total quota) - using same filters
    $statsSql = "
        SELECT 
            COUNT(*) as totalEstablishments,
            SUM(starting_quota) as totalQuota
        FROM company
        $where
    ";
    $statsStmt = $pdo->prepare($statsSql);
    foreach ($params as $key => $value) {
        $statsStmt->bindValue($key, $value);
    }
    $statsStmt->execute();
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);
    
    // Calculate total employees from filtered establishments
    $totalEmployees = 0;
    foreach ($establishments as $est) {
        $totalEmployees += (int)$est['totalEmployees'];
    }
    
    // Get unique local names for dropdown
    $localNamesSql = "SELECT DISTINCT local_name FROM company WHERE local_name IS NOT NULL AND local_name != '' ORDER BY local_name";
    $localNamesStmt = $pdo->prepare($localNamesSql);
    $localNamesStmt->execute();
    $localNames = $localNamesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Establishments retrieved successfully', [
        'data' => $establishments,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => (int)$totalRecords,
            'recordsPerPage' => $limit
        ],
        'statistics' => [
            'totalEstablishments' => (int)$stats['totalEstablishments'],
            'totalEmployees' => $totalEmployees,
            'totalQuota' => (int)($stats['totalQuota'] ?? 0),
            'availableQuota' => (int)($stats['totalQuota'] ?? 0) - $totalEmployees
        ],
        'localNames' => $localNames
    ]);
} catch (Exception $e) {
    error_log('Get Establishments API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving establishments: ' . $e->getMessage());
}

