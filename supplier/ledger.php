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

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    // Read JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST; // Fallback to $_POST for form data
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get supplier info
    if ($action == 'getSupplierInfo') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        
        if (empty($supplier_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID is required'
            ]);
        }
        
        $sql = "SELECT `supp_name`, `supp_email`, `supp_phone` FROM `supplier` WHERE supp_id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $supplier_id);
        $stmt->execute();
        $supplier = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$supplier) {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $supplier
        ]);
    }
    
    // Get currency name
    if ($action == 'getCurrencyName') {
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        
        if (empty($currency_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency ID is required'
            ]);
        }
        
        $sql = "SELECT currencyName FROM currency WHERE currencyID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $currency_id);
        $stmt->execute();
        $currency = $stmt->fetch(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $currency
        ]);
    }
    
    // Get supplier ledger transactions
    if ($action == 'getLedger') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        
        if (empty($supplier_id) || empty($currency_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID and Currency ID are required'
            ]);
        }
        
        $sql = "SELECT * FROM (
            SELECT 'Ticket' AS TRANSACTION_Type, ticket.passenger_name AS passenger_name, ticket.datetime AS datetime,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') as date, pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, net_price AS Debit, 0 AS Credit, '' AS remarks
            FROM ticket 
            INNER JOIN airports ON airports.airport_id = ticket.from_id
            INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
            WHERE ticket.supp_id = :id AND ticket.net_CurrencyID = :CurID
            
            UNION ALL
            SELECT 'Visa' AS TRANSACTION_Type, visa.passenger_name AS passenger_name, visa.datetime AS datetime,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                net_price AS Debit, 0 AS Credit, '' AS remarks
            FROM visa
            INNER JOIN country_name ON country_name.country_id = visa.country_id
            WHERE visa.supp_id = :id AND visa.netCurrencyID = :CurID
            
            UNION ALL
            SELECT CASE WHEN typeID = 1 THEN 'Visa Fine' WHEN typeID = 2 THEN 'Escape Report' WHEN typeID = 3 THEN 'Escape Removal' END AS TRANSACTION_Type,
                visa.passenger_name AS passenger_name, visaextracharges.datetime AS datetime,
                DATE_FORMAT(DATE(visaextracharges.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                visaextracharges.net_price AS Debit, 0 AS Credit, '' AS remarks
            FROM visaextracharges
            INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id
            INNER JOIN country_name ON country_name.country_id = visa.country_id
            WHERE visaextracharges.supplierID = :id AND visaextracharges.netCurrencyID = :CurID
            
            UNION ALL
            SELECT 'Offer Letter Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.offerLetterCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.offerLetterSupplier = :id AND residence.offerLetterCostCur = :CurID
            
            UNION ALL
            SELECT 'Insurance Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.insuranceCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.insuranceSupplier = :id AND residence.insuranceCur = :CurID
            
            UNION ALL
            SELECT 'Labour Card Fee' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.laborCardFee AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.laborCardSupplier = :id AND residence.laborCardCur = :CurID
            
            UNION ALL
            SELECT 'E-Visa Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.eVisaCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.eVisaSupplier = :id AND residence.eVisaCur = :CurID
            
            UNION ALL
            SELECT 'Change Status Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.changeStatusCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.changeStatusSupplier = :id AND residence.changeStatusCur = :CurID
            
            UNION ALL
            SELECT 'Medical Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.medicalTCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.medicalSupplier = :id AND residence.medicalTCur = :CurID
            
            UNION ALL
            SELECT 'Emirates ID Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.emiratesIDCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.emiratesIDSupplier = :id AND residence.emiratesIDCur = :CurID
            
            UNION ALL
            SELECT 'Visa Stamping Cost' AS TRANSACTION_Type, residence.passenger_name AS passenger_name, residence.datetime AS datetime,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') as date, country_names AS Identification, '' AS Orgin, '' AS Destination,
                residence.visaStampingCost AS Debit, 0 AS Credit, '' AS remarks
            FROM residence
            INNER JOIN country_name ON country_name.country_id = residence.VisaType
            WHERE residence.visaStampingSupplier = :id AND residence.visaStampingCur = :CurID
            
            UNION ALL
            SELECT serviceName AS TRANSACTION_Type, servicedetails.passenger_name AS passenger_name, service_date AS datetime,
                DATE_FORMAT(DATE(service_date),'%d-%b-%Y') as date, service_details AS Identification, '' AS Orgin, '' AS Destination,
                netPrice AS Debit, 0 AS Credit, '' AS remarks
            FROM servicedetails
            INNER JOIN service ON service.serviceID = servicedetails.serviceID
            WHERE servicedetails.Supplier_id = :id AND servicedetails.netCurrencyID = :CurID
            
            UNION ALL
            SELECT 'Payment' AS TRANSACTION_Type, '' AS passenger_name, payment.time_creation AS datetime,
                DATE_FORMAT(DATE(time_creation),'%d-%b-%Y') as date, '' AS Identification, '' AS Orgin, '' AS Destination,
                0 AS Debit, IFNULL(payment_amount,0) AS Credit, payment_detail AS remarks
            FROM payment
            WHERE payment.supp_id = :id AND payment.currencyID = :CurID
            
            UNION ALL
            SELECT 'Hotel Reservation' AS TRANSACTION_Type, passenger_name AS passenger_name, hotel.datetime AS datetime,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') as date, CONCAT('Hotel: ', hotel_name) AS Identification, '' AS Orgin,
                country_names AS Destination, net_price AS Debit, 0 AS Credit, '' AS remarks
            FROM hotel
            INNER JOIN country_name ON country_name.country_id = hotel.country_id
            WHERE hotel.supplier_id = :id AND hotel.netCurrencyID = :CurID
            
            UNION ALL
            SELECT 'Car Reservation' AS TRANSACTION_Type, passenger_name AS passenger_name, car_rental.datetime AS datetime,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') as date, CONCAT('Car Description: ', car_description) AS Identification, '' AS Orgin,
                '' AS Destination, net_price AS Debit, 0 AS Credit, '' AS remarks
            FROM car_rental
            WHERE supplier_id = :id AND car_rental.netCurrencyID = :CurID
            
            UNION ALL
            SELECT 'Date Extension' AS TRANSACTION_Type, ticket.passenger_name AS passenger_name, datechange.datetime AS datetime,
                DATE_FORMAT(extended_Date,'%d-%b-%Y') as date, pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, datechange.net_amount AS Debit, 0 AS Credit, '' AS remarks
            FROM datechange
            INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
            INNER JOIN airports ON airports.airport_id = ticket.from_id
            INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
            WHERE datechange.supplier = :id AND ticketStatus = 1 AND datechange.netCurrencyID = :CurID
            
            UNION ALL
            SELECT 'Refund' AS TRANSACTION_Type, ticket.passenger_name AS passenger_name, datechange.datetime AS datetime,
                DATE_FORMAT(extended_Date,'%d-%b-%Y') as date, pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, 0 AS Debit, net_amount AS Credit, '' AS remarks
            FROM datechange
            INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
            INNER JOIN airports ON airports.airport_id = ticket.from_id
            INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
            WHERE datechange.supplier = :id AND ticketStatus = 2 AND datechange.netCurrencyID = :CurID
        ) baseTable ORDER BY datetime ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $supplier_id);
        $stmt->bindParam(':CurID', $currency_id);
        $stmt->execute();
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $records
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Supplier Ledger API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}


