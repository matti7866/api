<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get customers
    $customerSql = "SELECT customer_id, customer_name, customer_phone 
                    FROM customer 
                    WHERE status = 1 
                    ORDER BY customer_name";
    $customerStmt = $pdo->prepare($customerSql);
    $customerStmt->execute();
    $customers = $customerStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get suppliers
    $supplierSql = "SELECT supp_id, supp_name 
                    FROM supplier 
                    ORDER BY supp_name";
    $supplierStmt = $pdo->prepare($supplierSql);
    $supplierStmt->execute();
    $suppliers = $supplierStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get countries (visa types)
    $countrySql = "SELECT country_id, country_names 
                   FROM country_name 
                   ORDER BY country_names";
    $countryStmt = $pdo->prepare($countrySql);
    $countryStmt->execute();
    $countries = $countryStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get nationalities
    $nationalitySql = "SELECT nationalityID, nationality 
                       FROM nationalities 
                       ORDER BY nationality";
    $nationalityStmt = $pdo->prepare($nationalitySql);
    $nationalityStmt->execute();
    $nationalities = $nationalityStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get currencies
    $currencySql = "SELECT currencyID, currencyName 
                    FROM currency 
                    ORDER BY currencyName";
    $currencyStmt = $pdo->prepare($currencySql);
    $currencyStmt->execute();
    $currencies = $currencyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get accounts
    $accountSql = "SELECT account_ID as accountID, account_Name as accountName 
                   FROM accounts 
                   ORDER BY account_Name";
    $accountStmt = $pdo->prepare($accountSql);
    $accountStmt->execute();
    $accounts = $accountStmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Success',
        'data' => [
            'customers' => $customers,
            'suppliers' => $suppliers,
            'countries' => $countries,
            'nationalities' => $nationalities,
            'currencies' => $currencies,
            'accounts' => $accounts
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in visa/dropdowns.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in visa/dropdowns.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













