<?php
/**
 * Generate Receipt API
 * Endpoint: /api/customers/receipt/generate.php
 * Method: POST
 * Action: generatePaymentReceipt
 */

// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';

require_once __DIR__ . '/../../auth/JWTHelper.php';
require_once __DIR__ . '/../../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    $sql = "SELECT permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Customer Payment'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['insert'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get POST data
$requestBody = file_get_contents('php://input');
$data = json_decode($requestBody, true);

$action = $data['action'] ?? '';

if ($action !== 'generatePaymentReceipt') {
    JWTHelper::sendResponse(400, false, 'Invalid action');
}

$paymentID = isset($data['paymentID']) ? (int)$data['paymentID'] : 0;
$customerID = isset($data['customerID']) ? (int)$data['customerID'] : 0;
$currencyID = isset($data['currencyID']) ? (int)$data['currencyID'] : 0;

if ($paymentID === 0 || $customerID === 0 || $currencyID === 0) {
    JWTHelper::sendResponse(400, false, 'Payment ID, Customer ID, and Currency ID are required');
}

try {
    $pdo->beginTransaction();
    
    // Check if receipt already exists for this payment
    $checkSql = "SELECT invoiceID FROM invoicedetails WHERE transactionID = :paymentID AND transactionType = 'Payment'";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute(['paymentID' => $paymentID]);
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) {
        // Receipt already exists, just return it
        $pdo->commit();
        JWTHelper::sendResponse(200, true, 'Receipt already exists', [
            'invoiceID' => (int)$existing['invoiceID']
        ]);
        exit; // Important: exit after sending response
    }
    
    // Generate invoice number (format: INV-YYYY-XXXXXX)
    $invoiceNumberSql = "SELECT MAX(CAST(SUBSTRING_INDEX(invoiceNumber, '-', -1) AS UNSIGNED)) as max_num 
                         FROM invoice 
                         WHERE invoiceNumber LIKE CONCAT('INV-', YEAR(CURDATE()), '-%')";
    $invoiceNumberStmt = $pdo->query($invoiceNumberSql);
    $invoiceNumberResult = $invoiceNumberStmt->fetch(PDO::FETCH_ASSOC);
    $nextNumber = ($invoiceNumberResult['max_num'] ?? 0) + 1;
    $invoiceNumber = 'INV-' . date('Y') . '-' . str_pad($nextNumber, 6, '0', STR_PAD_LEFT);
    
    // Insert into invoice table
    $insertInvoiceSql = "INSERT INTO invoice (customerID, invoiceNumber, invoiceCurrency, invoiceDate) 
                         VALUES (:customerID, :invoiceNumber, :invoiceCurrency, NOW())";
    $insertInvoiceStmt = $pdo->prepare($insertInvoiceSql);
    $insertInvoiceStmt->execute([
        'customerID' => $customerID,
        'invoiceNumber' => $invoiceNumber,
        'invoiceCurrency' => $currencyID
    ]);
    
    $invoiceID = $pdo->lastInsertId();
    
    if (!$invoiceID) {
        throw new Exception('Failed to create invoice');
    }
    
    // Insert into invoicedetails table
    $insertDetailsSql = "INSERT INTO invoicedetails (invoiceID, transactionID, transactionType) 
                         VALUES (:invoiceID, :transactionID, 'Payment')";
    $insertDetailsStmt = $pdo->prepare($insertDetailsSql);
    $insertDetailsStmt->execute([
        'invoiceID' => $invoiceID,
        'transactionID' => $paymentID
    ]);
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Receipt generated successfully', [
        'invoiceID' => (int)$invoiceID,
        'invoiceNumber' => $invoiceNumber
    ]);
    exit;
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    error_log('Generate receipt error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    JWTHelper::sendResponse(500, false, 'Error generating receipt: ' . $e->getMessage());
    exit;
}
