<?php
/**
 * Public Receipt API - No Authentication Required
 * Endpoint: /api/customers/receipt/receipt-public.php
 * Method: GET
 * Params: id (receipt ID), hash (security hash)
 */

// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';
require_once __DIR__ . '/../../../connection.php';

// Get parameters
$receiptID = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$hash = isset($_GET['hash']) ? trim($_GET['hash']) : '';

// Validate receipt ID
if ($receiptID === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Receipt ID is required']);
    exit;
}

// Validate hash (simple MD5 validation: md5($id . '::::::' . $id))
$expectedHash = md5($receiptID . '::::::' . $receiptID);
if ($hash !== $expectedHash) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid security hash']);
    exit;
}

try {
    // Get receipt info
    $infoSql = "SELECT invoiceNumber, invoiceCurrency, invoice.customerID, customer_name,
                DATE_FORMAT(DATE(invoiceDate),'%d-%b-%Y') AS invoiceDate, currencyName  
                FROM `invoice` 
                INNER JOIN customer ON customer.customer_id = invoice.customerID 
                INNER JOIN currency ON currency.currencyID = invoice.invoiceCurrency 
                WHERE invoiceID = :id";
    $infoStmt = $pdo->prepare($infoSql);
    $infoStmt->execute(['id' => $receiptID]);
    $receiptInfo = $infoStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$receiptInfo) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Receipt not found']);
        exit;
    }
    
    // Get receipt transactions
    $transSql = "SELECT * FROM (
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
    ) AS baseTable 
    ORDER BY datetime ASC";
    
    $transStmt = $pdo->prepare($transSql);
    $transStmt->execute(['id' => $receiptID]);
    $transactions = $transStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Return data
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'receiptInfo' => $receiptInfo,
        'transactions' => $transactions
    ]);
    
} catch (Exception $e) {
    error_log('Public receipt error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
