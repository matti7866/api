<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

try {
    // Get database connection
    // Database connection already available as $pdo from connection.php
    
    // Get suppliers with pending amounts
    $sql = "SELECT main_supp AS supp_id, supp_name FROM (
        SELECT supp_id AS main_supp, supp_name,
        (SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = main_supp) 
        + (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = main_supp) 
        + (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = main_supp) 
        + (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = main_supp) 
        + (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = main_supp) 
        + (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = main_supp) 
        + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.ticketStatus = 1) 
        + (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = main_supp) 
        + (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = main_supp) 
        - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.ticketStatus = 2) 
        - (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = main_supp) AS total 
        FROM supplier
    ) AS baseTable WHERE total != 0 ORDER BY supp_name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get all currencies
    $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get accounts
    $sql = "SELECT account_ID, account_Name FROM accounts ORDER BY account_Name ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => [
            'suppliers' => $suppliers,
            'currencies' => $currencies,
            'accounts' => $accounts
        ]
    ]);
    
} catch (Exception $e) {
    error_log('Supplier Dropdowns API Error: ' . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

