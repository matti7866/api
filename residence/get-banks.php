<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Banks List for Salary Certificate
 * Endpoint: /api/residence/get-banks.php
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
    exit;
}

try {

        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Check if banks table exists
    $checkTable = $pdo->prepare("SHOW TABLES LIKE 'banks'");
    $checkTable->execute();
    
    if ($checkTable->rowCount() === 0) {
        // Return empty array if table doesn't exist
        JWTHelper::sendResponse(200, true, 'Banks retrieved successfully', ['data' => []]);
        exit;
    }

    // Get banks from database
    $sql = "SELECT id, bank_name FROM banks ORDER BY bank_name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $banks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    JWTHelper::sendResponse(200, true, 'Banks retrieved successfully', ['data' => $banks]);
} catch (PDOException $e) {
    error_log("Error fetching banks: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Failed to fetch banks', null, $e->getMessage());
} catch (Exception $e) {
    error_log("Error in get-banks.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'An error occurred');
}

