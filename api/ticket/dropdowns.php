<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

try {
    // Get all dropdown data in one request
    
    // 1. Customers
    $custStmt = $pdo->prepare("SELECT customer_id, customer_name, customer_phone, customer_whatsapp, customer_address 
                                FROM customer 
                                WHERE status = 1
                                ORDER BY customer_name ASC");
    $custStmt->execute();
    $customers = $custStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 2. Airports
    $airportStmt = $pdo->prepare("SELECT airport_id, airport_code, name 
                                   FROM airports 
                                   ORDER BY airport_code ASC");
    $airportStmt->execute();
    $airports = $airportStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. Suppliers
    $suppStmt = $pdo->prepare("SELECT supp_id, supp_name, supp_phone, supp_email 
                                FROM supplier 
                                ORDER BY supp_name ASC");
    $suppStmt->execute();
    $suppliers = $suppStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 4. Currencies
    $currStmt = $pdo->prepare("SELECT currencyID, currencyName 
                                FROM currency 
                                ORDER BY currencyName ASC");
    $currStmt->execute();
    $currencies = $currStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 5. Accounts (for payment)
    $accountStmt = $pdo->prepare("SELECT account_ID as accountID, account_Name as accountName, accountType 
                                   FROM accounts 
                                   ORDER BY account_Name ASC");
    $accountStmt->execute();
    $accounts = $accountStmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => [
            'customers' => $customers,
            'airports' => $airports,
            'suppliers' => $suppliers,
            'currencies' => $currencies,
            'accounts' => $accounts
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in ticket/dropdowns.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Failed to fetch dropdown data'
    ], 500);
} catch (Exception $e) {
    error_log("Error in ticket/dropdowns.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}

