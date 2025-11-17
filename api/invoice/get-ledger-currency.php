<?php
/**
 * Get Ledger Currency API
 * Endpoint: /api/invoice/get-ledger-currency.php
 * Returns currency information
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$currencyID = isset($_POST['ID']) ? (int)$_POST['ID'] : 0;

if ($currencyID == 0) {
    JWTHelper::sendResponse(400, false, 'Currency ID is required');
}

try {
    $sql = "SELECT currencyName FROM currency WHERE currencyID = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':id', $currencyID);
    $stmt->execute();
    $currency = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Currency info retrieved successfully', ['data' => $currency]);
} catch (Exception $e) {
    error_log('Get Ledger Currency API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving currency info: ' . $e->getMessage());
}



