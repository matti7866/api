<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Abstract View API
 * Endpoint: /api/residence/abstract-view.php
 * Returns financial summary for a customer/passenger/currency combination
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
$passengerName = isset($_POST['passengerName']) ? trim($_POST['passengerName']) : 'null';
$currencyID = isset($_POST['currencyID']) ? (int)$_POST['currencyID'] : 0;

if ($customerID == 0 || $currencyID == 0) {
    JWTHelper::sendResponse(400, false, 'Customer ID and Currency ID are required');
}

try {
    $passengerNameLower = str_replace(' ', '', strtolower($passengerName));
    
    if ($passengerName && $passengerName !== 'null') {
        $sql = "SELECT currency.currencyName,
                IFNULL(SUM(residence.sale_price), 0) AS total_residenceCost,
                (SELECT IFNULL(SUM(residencefine.fineAmount), 0) 
                 FROM residencefine 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
                 WHERE residence.customer_id = :customerID 
                 AND REPLACE(LOWER(passenger_name), ' ', '') = :passengerName 
                 AND residencefine.fineCurrencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS residenceFine,
                (SELECT IFNULL(SUM(customer_payments.payment_amount), 0) 
                 FROM customer_payments 
                 INNER JOIN residence ON residence.residenceID = customer_payments.PaymentFor 
                 WHERE residence.customer_id = :customerID 
                 AND REPLACE(LOWER(passenger_name), ' ', '') = :passengerName 
                 AND customer_payments.currencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS total_residency_payment,
                (SELECT IFNULL(SUM(customer_payments.payment_amount), 0) 
                 FROM customer_payments
                 INNER JOIN residencefine ON residencefine.residenceFineID = customer_payments.residenceFinePayment 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
                 WHERE residence.customer_id = :customerID 
                 AND REPLACE(LOWER(passenger_name), ' ', '') = :passengerName 
                 AND customer_payments.currencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS total_fine_payment 
                FROM residence 
                INNER JOIN currency ON currency.currencyID = residence.saleCurID 
                WHERE residence.customer_id = :customerID 
                AND REPLACE(LOWER(passenger_name), ' ', '') = :passengerName 
                AND residence.saleCurID = :currencyID 
                AND residence.islocked = 0 
                AND residence.deleted = 0";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':passengerName', $passengerNameLower);
        $stmt->bindParam(':currencyID', $currencyID);
    } else {
        $sql = "SELECT currency.currencyName,
                IFNULL(SUM(residence.sale_price), 0) AS total_residenceCost,
                (SELECT IFNULL(SUM(residencefine.fineAmount), 0) 
                 FROM residencefine 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
                 WHERE residence.customer_id = :customerID 
                 AND residencefine.fineCurrencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS residenceFine,
                (SELECT IFNULL(SUM(customer_payments.payment_amount), 0) 
                 FROM customer_payments 
                 INNER JOIN residence ON residence.residenceID = customer_payments.PaymentFor 
                 WHERE residence.customer_id = :customerID 
                 AND customer_payments.currencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS total_residency_payment,
                (SELECT IFNULL(SUM(customer_payments.payment_amount), 0) 
                 FROM customer_payments
                 INNER JOIN residencefine ON residencefine.residenceFineID = customer_payments.residenceFinePayment 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
                 WHERE residence.customer_id = :customerID 
                 AND customer_payments.currencyID = :currencyID 
                 AND residence.islocked = 0 
                 AND residence.deleted = 0) AS total_fine_payment 
                FROM residence 
                INNER JOIN currency ON currency.currencyID = residence.saleCurID 
                WHERE residence.customer_id = :customerID 
                AND residence.saleCurID = :currencyID 
                AND residence.islocked = 0 
                AND residence.deleted = 0";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customerID', $customerID);
        $stmt->bindParam(':currencyID', $currencyID);
    }
    
    $stmt->execute();
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$data) {
        $data = [
            'currencyName' => '',
            'total_residenceCost' => 0,
            'residenceFine' => 0,
            'total_residency_payment' => 0,
            'total_fine_payment' => 0
        ];
    }
    
    JWTHelper::sendResponse(200, true, 'Abstract view retrieved successfully', ['data' => $data]);
} catch (Exception $e) {
    error_log('Abstract View API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error retrieving abstract view: ' . $e->getMessage());
}




