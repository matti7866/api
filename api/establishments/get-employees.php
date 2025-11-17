<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Establishment Employees API
 * Endpoint: /api/establishments/get-employees.php
 * Returns employees for a specific establishment
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

// Check permission - same as establishments
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND (page_name = 'Establishments' OR page_name = 'Establishment' OR page_name = 'Company')";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($permission && $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    error_log('Permission check error: ' . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$companyID = isset($_POST['companyID']) ? (int)$_POST['companyID'] : 0;

if ($companyID == 0) {
    JWTHelper::sendResponse(400, false, 'Company ID is required');
}

try {
    // Get company details
    $stmt = $pdo->prepare("SELECT * FROM company WHERE company_id = :companyID");
    $stmt->execute(['companyID' => $companyID]);
    $company = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$company) {
        JWTHelper::sendResponse(404, false, 'Company not found');
    }
    
    // Get employees (residences) for this company
    $stmt = $pdo->prepare("
        SELECT 
            residence.*,
            airports.countryName,
            airports.countryCode
        FROM residence 
        LEFT JOIN airports ON airports.airport_id = residence.Nationality
        WHERE company = :companyID AND residence.deleted = 0
        GROUP BY residence.residenceID
        ORDER BY residence.residenceID DESC
    ");
    $stmt->execute(['companyID' => $companyID]);
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Employees retrieved successfully', [
        'company' => $company,
        'employees' => $employees
    ]);
} catch (Exception $e) {
    error_log('Get Employees API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving employees: ' . $e->getMessage());
}




