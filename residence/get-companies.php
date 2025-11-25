<?php
/**
 * Get Companies API
 * Endpoint: /api/residence/get-companies.php
 * Returns list of companies with employee counts
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

try {
    $companyType = $_GET['type'] ?? 'Mainland';
    
    $stmt = $pdo->prepare("
        SELECT 
            company.*, 
            IFNULL(COUNT(residence.residenceID), 0) as totalEmployees
        FROM company  
        LEFT JOIN residence ON residence.company = company.company_id  
        WHERE company.company_type = :companyType
        GROUP BY company.company_id  
        ORDER BY company.company_id DESC
    ");
    $stmt->bindParam(':companyType', $companyType);
    $stmt->execute();
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Wrap in 'data' key to avoid array_merge issues in JWTHelper
    JWTHelper::sendResponse(200, true, 'Companies loaded successfully', ['companies' => $companies]);
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error loading companies: ' . $e->getMessage());
}

