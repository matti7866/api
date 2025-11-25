<?php
/**
 * Get All Lookup Data for Residence Module
 * Endpoint: /api/residence/lookups.php
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
    $lookups = [];
    
    // Nationalities (from airports table, matching old residenceReport.php)
    $stmt = $pdo->query("
        SELECT 
            countryName AS mainCountryName, 
            MIN(airport_id) AS airport_id 
        FROM airports 
        GROUP BY countryName
        ORDER BY countryName ASC
    ");
    $nationalities = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Map to match expected format: airport_id as nationality_id, mainCountryName as nationality_name
    $lookups['nationalities'] = array_map(function($item) {
        return [
            'nationality_id' => $item['airport_id'],
            'nationality_name' => $item['mainCountryName']
        ];
    }, $nationalities);
    
    // Visa Types (from service table)
    $stmt = $pdo->query("SELECT serviceID as visa_id, serviceName as visa_name FROM service ORDER BY serviceName");
    $lookups['visaTypes'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Currencies
    $stmt = $pdo->query("SELECT currencyID, currencyName FROM currency ORDER BY currencyName");
    $lookups['currencies'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Companies
    $stmt = $pdo->query("SELECT company_id, company_name, company_number FROM company ORDER BY company_name");
    $lookups['companies'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Positions
    $stmt = $pdo->query("SELECT position_id, posiiton_name as position_name FROM position ORDER BY posiiton_name");
    $lookups['positions'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Suppliers
    $stmt = $pdo->query("SELECT supp_id, supp_name FROM supplier ORDER BY supp_name");
    $lookups['suppliers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Accounts
    $stmt = $pdo->query("SELECT account_ID, account_Name FROM accounts ORDER BY account_Name");
    $lookups['accounts'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Customers (all active customers, ordered alphabetically)
    $stmt = $pdo->query("SELECT customer_id, customer_name, customer_phone, customer_email FROM customer WHERE status = 1 ORDER BY customer_name ASC");
    $lookups['customers'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Success', $lookups);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

