<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Residence Ledger API
 * Endpoint: /api/residence/residence-ledger.php
 * Returns transaction ledger for a customer/passenger and currency
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

// Check permission
try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}

$customerID = isset($_POST['customerID']) ? (int)$_POST['customerID'] : 0;
$passengerName = isset($_POST['passengerName']) ? trim($_POST['passengerName']) : '';
$currencyID = isset($_POST['currencyID']) ? (int)$_POST['currencyID'] : 0;

if ($customerID == 0 || $currencyID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID and Currency ID are required');
}

try {
    $passengerNameLower = str_replace(' ', '', strtolower($passengerName));
    
    if ($passengerName && $passengerName !== 'null') {
        // Filter by specific passenger
        $sql = "
            SELECT 'Residence application' AS transactionType, 
                passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(residence.datetime), '%d-%b-%Y') AS dt,
                DATE(residence.datetime) AS OrderDate, 
                country_name.country_names AS visaType, 
                residence.sale_price AS debit, 
                0 AS credit 
            FROM residence 
            INNER JOIN country_name ON residence.VisaType = country_name.country_id 
            WHERE residence.customer_id = :customerID  
            AND REPLACE(LOWER(residence.passenger_name), ' ', '') = :passengerName 
            AND residence.saleCurID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Fine' AS transactionType, 
                residence.passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(residencefine.datetime), '%d-%b-%Y') AS dt,
                DATE(residencefine.datetime) AS orderDate,
                country_name.country_names AS visaType, 
                residencefine.fineAmount AS debit, 
                0 AS credit 
            FROM residencefine 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE residence.customer_id = :customerID 
            AND REPLACE(LOWER(residence.passenger_name), ' ', '') = :passengerName 
            AND residencefine.fineCurrencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Payment' AS transactionType, 
                passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(customer_payments.datetime), '%d-%b-%Y') AS dt,
                DATE(customer_payments.datetime) AS orderDate,
                country_name.country_names AS VisaType,
                0 AS debit,
                customer_payments.payment_amount AS credit 
            FROM customer_payments 
            INNER JOIN residence ON residence.residenceID = customer_payments.PaymentFor 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE customer_payments.customer_id = :customerID 
            AND REPLACE(LOWER(residence.passenger_name), ' ', '') = :passengerName 
            AND customer_payments.currencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Fine Payment' AS transactionType, 
                passenger_name AS passenger_name,
                DATE_FORMAT(DATE(customer_payments.datetime), '%d-%b-%Y') AS dt,
                DATE(customer_payments.datetime) AS orderDate,
                country_name.country_names AS VisaType, 
                0 AS debit, 
                customer_payments.payment_amount AS credit 
            FROM customer_payments
            INNER JOIN residencefine ON residencefine.residenceFineID = customer_payments.residenceFinePayment 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE customer_payments.customer_id = :customerID 
            AND REPLACE(LOWER(residence.passenger_name), ' ', '') = :passengerName 
            AND customer_payments.currencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            ORDER BY OrderDate, passenger_name, transactionType
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':passengerName', $passengerNameLower);
        $stmt->bindParam(':currencyID', $currencyID);
    } else {
        // All passengers for customer
        $sql = "
            SELECT 'Residence application' AS transactionType, 
                passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(residence.datetime), '%d-%b-%Y') AS dt,
                DATE(residence.datetime) AS OrderDate, 
                country_name.country_names AS visaType, 
                residence.sale_price AS debit, 
                0 AS credit 
            FROM residence 
            INNER JOIN country_name ON residence.VisaType = country_name.country_id 
            WHERE residence.customer_id = :customerID 
            AND residence.saleCurID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Fine' AS transactionType,
                residence.passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(residencefine.datetime), '%d-%b-%Y') AS dt,
                DATE(residencefine.datetime) AS orderDate,
                country_name.country_names AS visaType, 
                residencefine.fineAmount AS debit,
                0 AS credit 
            FROM residencefine 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE residence.customer_id = :customerID 
            AND residencefine.fineCurrencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Payment' AS transactionType, 
                passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(customer_payments.datetime), '%d-%b-%Y') AS dt,
                DATE(customer_payments.datetime) AS orderDate, 
                country_name.country_names AS VisaType,
                0 AS debit,
                customer_payments.payment_amount AS credit 
            FROM customer_payments 
            INNER JOIN residence ON residence.residenceID = customer_payments.PaymentFor 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE customer_payments.customer_id = :customerID 
            AND customer_payments.currencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            UNION ALL 
            
            SELECT 'Residence Fine Payment' AS transactionType, 
                passenger_name AS passenger_name, 
                DATE_FORMAT(DATE(customer_payments.datetime), '%d-%b-%Y') AS dt,
                DATE(customer_payments.datetime) AS orderDate,
                country_name.country_names AS VisaType, 
                0 AS debit, 
                customer_payments.payment_amount AS credit 
            FROM customer_payments
            INNER JOIN residencefine ON residencefine.residenceFineID = customer_payments.residenceFinePayment 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            WHERE customer_payments.customer_id = :customerID 
            AND customer_payments.currencyID = :currencyID 
            AND residence.islocked = 0 
            AND residence.current_status = 'Active' 
            
            ORDER BY OrderDate, passenger_name, transactionType
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':currencyID', $currencyID);
    }
    
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Ledger retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Residence Ledger API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving ledger: ' . $e->getMessage());
}




