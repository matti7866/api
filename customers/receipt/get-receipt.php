<?php
/**
 * Get Receipt Information API
 * Endpoint: /api/customers/receipt/get-receipt.php
 * Methods: POST
 * Actions: getReceiptInfo, getReceiptDetails, getOutstandingBalance
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
    
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Customer Payment'";
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

// Get POST data
$requestBody = file_get_contents('php://input');
$data = json_decode($requestBody, true);

$action = $data['action'] ?? '';

if (empty($action)) {
    JWTHelper::sendResponse(400, false, 'Action is required');
}

// Get Receipt Info
if ($action === 'getReceiptInfo') {
    $receiptID = isset($data['receiptID']) ? (int)$data['receiptID'] : 0;
    
    if ($receiptID === 0) {
        JWTHelper::sendResponse(400, false, 'Receipt ID is required');
    }
    
    try {
        $sql = "SELECT invoiceNumber, invoiceCurrency, invoice.customerID, customer_name,
                DATE_FORMAT(DATE(invoiceDate),'%d-%b-%Y') AS invoiceDate, currencyName  
                FROM `invoice` 
                INNER JOIN customer ON customer.customer_id = invoice.customerID 
                INNER JOIN currency ON currency.currencyID = invoice.invoiceCurrency 
                WHERE invoiceID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $receiptID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            JWTHelper::sendResponse(200, true, 'Receipt info retrieved', $result);
        } else {
            JWTHelper::sendResponse(404, false, 'Receipt not found');
        }
    } catch (Exception $e) {
        JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
    }
}

// Get Receipt Details (Transactions)
if ($action === 'getReceiptDetails') {
    $receiptID = isset($data['receiptID']) ? (int)$data['receiptID'] : 0;
    
    if ($receiptID === 0) {
        JWTHelper::sendResponse(400, false, 'Receipt ID is required');
    }
    
    try {
        $sql = "SELECT * FROM (
            SELECT invoicedetails.transactionType AS transactionType, 
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS serviceInfo,
                ticket.passenger_name AS PassengerName,
                DATE_FORMAT(DATE(ticket.datetime),'%d-%b-%Y') AS formatedDate,
                ticket.datetime AS datetime, 
                ticket.sale AS salePrice 
            FROM invoicedetails 
            INNER JOIN ticket ON ticket.ticket = invoicedetails.transactionID 
            INNER JOIN airports ON airports.airport_id=ticket.from_id 
            INNER JOIN airports AS to_airports ON to_airports.airport_id=ticket.to_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Ticket'
            
            UNION ALL
            
            SELECT invoicedetails.transactionType AS transactionType,
                country_names AS serviceInfo,
                passenger_name AS PassengerName,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, 
                visa.datetime AS datetime,
                visa.sale AS salePrice 
            FROM visa 
            INNER JOIN country_name ON country_name.country_id=visa.country_id 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = visa.visa_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Visa'
            
            UNION ALL
            
            SELECT CASE 
                    WHEN visaextracharges.typeID = 1 THEN 'Visa Fine' 
                    WHEN visaextracharges.typeID = 2 THEN 'Escape Report' 
                    WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' 
                END AS transactionType,
                country_names AS serviceInfo,
                visa.passenger_name AS PassengerName,
                DATE_FORMAT(DATE(visaextracharges.datetime),'%d-%b-%Y') AS formatedDate,
                visaextracharges.datetime AS datetime,
                visaextracharges.salePrice AS salePrice 
            FROM visaextracharges
            INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id 
            INNER JOIN country_name ON country_name.country_id=visa.country_id 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = visaextracharges.visaExtraChargesID
            WHERE invoicedetails.invoiceID = :id 
            AND invoicedetails.transactionType IN('Visa Fine','Escape Report','Escape Removal')
            
            UNION ALL
            
            SELECT 'Residence' AS transactionType,
                country_names AS serviceInfo, 
                passenger_name AS PassengerName,
                DATE_FORMAT(DATE(residence.datetime),'%d-%b-%Y') AS formatedDate, 
                residence.datetime AS datetime, 
                sale_price AS salePrice 
            FROM residence 
            INNER JOIN country_name ON country_name.country_id= residence.VisaType 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = residence.residenceID 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Residence'
            
            UNION ALL
            
            SELECT 'Residence Fine' AS transactionType,
                country_names AS serviceInfo,
                passenger_name AS PassengerName,
                DATE_FORMAT(DATE(residencefine.datetime),'%d-%b-%Y') AS formatedDate, 
                residencefine.datetime AS datetime,
                residencefine.fineAmount AS salePrice 
            FROM residencefine 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            INNER JOIN country_name ON country_name.country_id = residence.VisaType 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = residencefine.residenceFineID 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Residence Fine'
            
            UNION ALL
            
            SELECT serviceName AS transactionType, 
                service_details AS serviceInfo,
                passenger_name AS PassengerName,
                DATE_FORMAT(DATE(service_date),'%d-%b-%Y') AS formatedDate, 
                service_date AS datetime, 
                salePrice AS salePrice 
            FROM servicedetails 
            INNER JOIN service ON service.serviceID= servicedetails.serviceID 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = servicedetails.serviceDetailsID 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = service.serviceName
            
            UNION ALL
            
            SELECT 'Payment' AS transactionType, 
                CASE 
                    WHEN customer_payments.PaymentFor IS NOT NULL THEN 'For Residence' 
                    WHEN customer_payments.residenceFinePayment IS NOT NULL THEN 'For Residence Fine' 
                    ELSE customer_payments.remarks 
                END AS serviceInfo, 
                CASE 
                    WHEN customer_payments.PaymentFor IS NOT NULL THEN 
                        (SELECT DISTINCT passenger_name FROM residence WHERE residence.residenceID = customer_payments.PaymentFor) 
                    WHEN customer_payments.residenceFinePayment IS NOT NULL THEN 
                        (SELECT DISTINCT passenger_name FROM residence 
                         INNER JOIN residencefine ON residence.residenceID = residencefine.residenceID 
                         WHERE residencefine.residenceFineID = customer_payments.residenceFinePayment)
                    ELSE '' 
                END AS PassengerName, 
                DATE_FORMAT(DATE(customer_payments.datetime),'%d-%b-%Y') AS formatedDate, 
                customer_payments.datetime AS datetime, 
                customer_payments.payment_amount AS salePrice 
            FROM customer_payments 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = customer_payments.pay_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Payment'
            
            UNION ALL
            
            SELECT 'Hotel Reservation' AS transactionType,
                country_names AS serviceInfo,
                hotel.passenger_name AS PassengerName,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate,
                hotel.datetime AS datetime,
                sale_price AS salePrice 
            FROM hotel 
            INNER JOIN country_name ON country_name.country_id = hotel.country_id 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = hotel.hotel_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Hotel Reservation'
            
            UNION ALL
            
            SELECT 'Car Reservation' AS transactionType,
                CONCAT('Car Description: ',car_description) AS serviceInfo, 
                car_rental.passenger_name AS PassengerName, 
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, 
                car_rental.datetime as datetime,
                sale_price AS salePrice 
            FROM car_rental 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = car_rental.car_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Car Reservation'
            
            UNION ALL
            
            SELECT 'Date Extension' AS transactionType,
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS serviceInfo,
                passenger_name AS PassengerName,
                DATE_FORMAT(extended_Date,'%d-%b-%Y') AS formatedDate,
                datechange.datetime as datetime, 
                datechange.sale_amount AS salePrice 
            From datechange 
            INNER JOIN ticket ON ticket.ticket = datechange.ticket_id 
            INNER JOIN airports ON airports.airport_id=ticket.from_id 
            INNER JOIN airports AS to_airports ON to_airports.airport_id=ticket.to_id 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = datechange.change_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Date Extension' AND ticket.status = 1
            
            UNION ALL
            
            SELECT 'Loan' AS transactionType,
                remarks AS serviceInfo,
                '' AS PassengerName,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, 
                loan.datetime AS datetime,
                amount AS salePrice 
            From loan 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = loan.loan_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Loan'
            
            UNION ALL
            
            SELECT 'Refund' AS transactionType,
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS serviceInfo,
                passenger_name AS PassengerName,
                DATE_FORMAT(extended_Date,'%d-%b-%Y') AS formatedDate,
                datechange.datetime as datetime, 
                datechange.sale_amount AS salePrice 
            From datechange 
            INNER JOIN ticket ON ticket.ticket = datechange.ticket_id 
            INNER JOIN airports ON airports.airport_id=ticket.from_id 
            INNER JOIN airports AS to_airports ON to_airports.airport_id=ticket.to_id 
            INNER JOIN invoicedetails ON invoicedetails.transactionID = datechange.change_id 
            WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Refund' AND ticket.status = 2
        ) AS baseTable 
        ORDER BY datetime ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $receiptID);
        $stmt->execute();
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse(200, true, 'Receipt details retrieved', $result);
    } catch (Exception $e) {
        JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
    }
}

// Get Outstanding Balance
if ($action === 'getOutstandingBalance') {
    $customerID = isset($data['customerID']) ? (int)$data['customerID'] : 0;
    $currencyID = isset($data['currencyID']) ? (int)$data['currencyID'] : 0;
    
    if ($customerID === 0 || $currencyID === 0) {
        JWTHelper::sendResponse(400, false, 'Customer ID and Currency ID are required');
    }
    
    try {
        // Get total debit (all sales)
        $debitSql = "SELECT COALESCE(SUM(amount), 0) as total FROM (
            SELECT sale AS amount FROM ticket WHERE customer_id = :cid AND currencyID = :curid
            UNION ALL
            SELECT sale AS amount FROM visa WHERE customer_id = :cid AND saleCurrencyID = :curid
            UNION ALL
            SELECT salePrice AS amount FROM visaextracharges 
            INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id 
            WHERE visa.customer_id = :cid AND visaextracharges.saleCurrencyID = :curid
            UNION ALL
            SELECT sale_price AS amount FROM residence WHERE customer_id = :cid AND saleCurID = :curid
            UNION ALL
            SELECT fineAmount AS amount FROM residencefine 
            INNER JOIN residence ON residence.residenceID = residencefine.residenceID 
            WHERE residence.customer_id = :cid AND fineCurrencyID = :curid
            UNION ALL
            SELECT salePrice AS amount FROM servicedetails WHERE customer_id = :cid AND saleCurrencyID = :curid
            UNION ALL
            SELECT sale_price AS amount FROM hotel WHERE customer_id = :cid AND saleCurrencyID = :curid
            UNION ALL
            SELECT sale_price AS amount FROM car_rental WHERE customer_id = :cid AND saleCurrencyID = :curid
            UNION ALL
            SELECT sale_amount AS amount FROM datechange 
            INNER JOIN ticket ON ticket.ticket = datechange.ticket_id 
            WHERE ticket.customer_id = :cid AND ticketStatus = 1 AND datechange.saleCurrencyID = :curid
            UNION ALL
            SELECT amount AS amount FROM loan WHERE customer_id = :cid AND currencyID = :curid
        ) AS debits";
        
        $debitStmt = $pdo->prepare($debitSql);
        $debitStmt->bindParam(':cid', $customerID);
        $debitStmt->bindParam(':curid', $currencyID);
        $debitStmt->execute();
        $debitResult = $debitStmt->fetch(PDO::FETCH_ASSOC);
        $totalDebit = floatval($debitResult['total'] ?? 0);
        
        // Get total credit (all payments)
        $creditSql = "SELECT COALESCE(SUM(payment_amount), 0) as total 
                      FROM customer_payments 
                      WHERE customer_id = :cid AND currencyID = :curid";
        $creditStmt = $pdo->prepare($creditSql);
        $creditStmt->bindParam(':cid', $customerID);
        $creditStmt->bindParam(':curid', $currencyID);
        $creditStmt->execute();
        $creditResult = $creditStmt->fetch(PDO::FETCH_ASSOC);
        $totalCredit = floatval($creditResult['total'] ?? 0);
        
        // Calculate outstanding balance
        $outstandingBalance = $totalDebit - $totalCredit;
        
        JWTHelper::sendResponse(200, true, 'Outstanding balance calculated', $outstandingBalance);
    } catch (Exception $e) {
        JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
    }
}

JWTHelper::sendResponse(400, false, 'Invalid action');
