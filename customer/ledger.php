<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once '../../api/auth/JWTHelper.php';
require_once '../../connection.php';

try {
    $user = JWTHelper::verifyRequest();
    
    if (!$user) {
        http_response_code(401);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Unauthorized'
        ]);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? trim($input['action']) : '';
    
    // Get Customer Info
    if ($action == 'getCustomerInfo') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        
        if (!$customer_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID is required'
            ]);
        }
        
        $sql = "SELECT customer_name, customer_phone, customer_email FROM customer WHERE customer_id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $customer_id);
        $stmt->execute();
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$customer) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customer
        ]);
    }
    
    // Get Currency Name
    if ($action == 'getCurrencyName') {
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        
        if (!$currency_id) {
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
        
        if (!$currency) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $currency
        ]);
    }
    
    // Get Ledger Transactions
    if ($action == 'getLedger') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        
        if (!$customer_id || !$currency_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID and Currency ID are required'
            ]);
        }
        
        // Check if there's a statement record
        $checkCustomerRecordSQL = "SELECT customer_id, referenceDate, referenceID, statementFor FROM statement 
                                   WHERE customer_id = :id AND referenceCurrencyID = :CurID 
                                   ORDER BY DATE(Entrydate), statementID DESC LIMIT 1";
        $checkCustomerRecorStmt = $pdo->prepare($checkCustomerRecordSQL);
        $checkCustomerRecorStmt->bindParam(':id', $customer_id);
        $checkCustomerRecorStmt->bindParam(':CurID', $currency_id);
        $checkCustomerRecorStmt->execute();
        $checkCustomerRecord = $checkCustomerRecorStmt->fetch(PDO::FETCH_ASSOC);
        
        $recordsToDisplayArr = [];
        $startingBalance = 0;
        $controllingLoopForAddingPreviousBalance = 1;
        $total = 0;
        
        if (empty($checkCustomerRecord)) {
            // No statement record - get all transactions
            $sql = "SELECT * FROM (
                SELECT ticket.ticket AS refID, 'Ticket' AS TRANSACTION_Type, passenger_name AS Passenger_Name,
                ticket.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, pnr AS Identification,
                airports.airport_code AS Orgin, to_airports.airport_code AS Destination,
                sale AS Debit, 0 AS Credit
                FROM ticket
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticket.currencyID = :CurID
                UNION ALL
                SELECT visa.visa_id AS refID, 'Visa' AS TRANSACTION_Type, passenger_name AS Passenger_Name,
                visa.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, country_names AS Identification,
                '' AS Orgin, '' AS Destination, sale AS Debit, 0 AS Credit
                FROM visa
                INNER JOIN country_name ON country_name.country_id = visa.country_id
                WHERE visa.customer_id = :id AND visa.saleCurrencyID = :CurID
                UNION ALL
                SELECT visaextracharges.visaExtraChargesID AS refID,
                CASE WHEN visaextracharges.typeID = 1 THEN 'Visa Fine'
                     WHEN visaextracharges.typeID = 2 THEN 'Escape Report'
                     WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' END AS TRANSACTION_Type,
                visa.passenger_name AS Passenger_Name, visaextracharges.datetime AS datetime,
                DATE(visaextracharges.datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(visaextracharges.datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                visaextracharges.salePrice AS Debit, 0 AS Credit
                FROM visaextracharges
                INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id
                INNER JOIN country_name ON country_name.country_id = visa.country_id
                WHERE visa.customer_id = :id AND visaextracharges.saleCurrencyID = :CurID
                UNION ALL
                SELECT residence.residenceID AS refID, 'Residence' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, residence.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                sale_price AS Debit, 0 AS Credit
                FROM residence
                INNER JOIN country_name ON country_name.country_id = residence.VisaType
                WHERE residence.customer_id = :id AND residence.saleCurID = :CurID
                UNION ALL
                SELECT residencefine.residenceFineID AS refID, 'Residence Fine' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, residencefine.datetime AS datetime,
                DATE(residencefine.datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(residencefine.datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                residencefine.fineAmount AS Debit, 0 AS Credit
                FROM residencefine
                INNER JOIN residence ON residence.residenceID = residencefine.residenceID
                INNER JOIN country_name ON country_name.country_id = residence.VisaType
                WHERE residence.customer_id = :id AND residencefine.fineCurrencyID = :CurID
                UNION ALL
                SELECT servicedetails.serviceDetailsID AS refID, serviceName AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, service_date AS datetime,
                DATE(service_date) AS nonFormatedDate, DATE_FORMAT(DATE(service_date), '%d-%b-%Y') AS date,
                service_details AS Identification, '' AS Orgin, '' AS Destination,
                salePrice AS Debit, 0 AS Credit
                FROM servicedetails
                INNER JOIN service ON service.serviceID = servicedetails.serviceID
                WHERE servicedetails.customer_id = :id AND servicedetails.saleCurrencyID = :CurID
                UNION ALL
                SELECT customer_payments.pay_id AS refID, 'Payment' AS TRANSACTION_Type,
                CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN
                    CONCAT('Payment For ', (SELECT DISTINCT passenger_name FROM residence WHERE residence.residenceID = customer_payments.PaymentFor), ' Residency')
                WHEN customer_payments.residenceFinePayment IS NOT NULL THEN
                    CONCAT('Residence Fine Payment For ', (SELECT DISTINCT passenger_name FROM residence INNER JOIN residencefine ON residence.residenceID = residencefine.residenceID WHERE residencefine.residenceFineID = customer_payments.residenceFinePayment), ' Residency')
                ELSE remarks END AS Passenger_Name,
                customer_payments.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN
                    (SELECT country_names FROM country_name WHERE country_id = (SELECT DISTINCT residence.VisaType FROM residence WHERE residence.residenceID = customer_payments.PaymentFor))
                WHEN customer_payments.residenceFinePayment IS NOT NULL THEN
                    (SELECT country_names FROM country_name WHERE country_id = (SELECT DISTINCT residence.VisaType FROM residence INNER JOIN residencefine ON residence.residenceID = residencefine.residenceID WHERE customer_payments.residenceFinePayment = residencefine.residenceFineID))
                ELSE '' END AS Identification,
                '' AS Orgin, '' AS Destination, 0 AS Debit, IFNULL(payment_amount, 0) AS Credit
                FROM customer_payments
                WHERE customer_payments.customer_id = :id AND customer_payments.currencyID = :CurID
                UNION ALL
                SELECT hotel.hotel_id AS refID, 'Hotel Reservation' AS TRANSACTION_Type,
                hotel.passenger_name AS Passenger_Name, hotel.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CONCAT('Hotel: ', hotel_name) AS Identification, '' AS Orgin,
                country_names AS Destination, sale_price AS Debit, 0 AS Credit
                FROM hotel
                INNER JOIN country_name ON country_name.country_id = hotel.country_id
                WHERE hotel.customer_id = :id AND hotel.saleCurrencyID = :CurID
                UNION ALL
                SELECT car_rental.car_id AS refID, 'Car Reservation' AS TRANSACTION_Type,
                car_rental.passenger_name AS Passenger_Name, car_rental.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CONCAT('Car Description: ', car_description) AS Identification,
                '' AS Orgin, '' AS Destination, sale_price AS Debit, 0 AS Credit
                FROM car_rental
                WHERE car_rental.customer_id = :id AND car_rental.saleCurrencyID = :CurID
                UNION ALL
                SELECT datechange.change_id AS refID, 'Date Extension' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, datechange.datetime AS datetime,
                DATE(extended_Date) AS nonFormatedDate, DATE_FORMAT(extended_Date, '%d-%b-%Y') AS date,
                pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, datechange.sale_amount AS Debit, 0 AS Credit
                FROM datechange
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticketStatus = 1 AND datechange.saleCurrencyID = :CurID
                UNION ALL
                SELECT loan.loan_id AS refID, 'Loan' AS TRANSACTION_Type, '' AS Passenger_Name,
                loan.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, remarks AS Identification,
                '' AS Orgin, '' AS Destination, amount AS Debit, 0 AS Credit
                FROM loan
                WHERE loan.customer_id = :id AND loan.currencyID = :CurID
                UNION ALL
                SELECT datechange.change_id AS refID, 'Refund' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, datechange.datetime AS datetime,
                DATE(extended_Date) AS nonFormatedDate, DATE_FORMAT(extended_Date, '%d-%b-%Y') AS date,
                pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, 0 AS Debit, datechange.sale_amount AS Credit
                FROM datechange
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticketStatus = 2 AND datechange.saleCurrencyID = :CurID
            ) baseTable ORDER BY datetime ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $customer_id);
            $stmt->bindParam(':CurID', $currency_id);
            $stmt->execute();
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($records as $record) {
                if (date('Y', strtotime($record['nonFormatedDate'])) < date('Y')) {
                    $startingBalance = $startingBalance + intval($record['Debit']) - intval($record['Credit']);
                } else {
                    if ($controllingLoopForAddingPreviousBalance == 1) {
                        if ($startingBalance != 0) {
                            if ($startingBalance < 0) {
                                array_push($recordsToDisplayArr, [
                                    'TRANSACTION_Type' => 'Starting Balance',
                                    'Passenger_Name' => '',
                                    'date' => '',
                                    'Identification' => '',
                                    'Orgin' => '',
                                    'Destination' => '',
                                    'Debit' => 0,
                                    'Credit' => abs($startingBalance)
                                ]);
                            } else if ($startingBalance > 0) {
                                array_push($recordsToDisplayArr, [
                                    'TRANSACTION_Type' => 'Starting Balance',
                                    'Passenger_Name' => '',
                                    'date' => '',
                                    'Identification' => '',
                                    'Orgin' => '',
                                    'Destination' => '',
                                    'Debit' => $startingBalance,
                                    'Credit' => 0
                                ]);
                            }
                        }
                        $controllingLoopForAddingPreviousBalance = 0;
                    }
                    array_push($recordsToDisplayArr, [
                        'TRANSACTION_Type' => $record['TRANSACTION_Type'],
                        'Passenger_Name' => $record['Passenger_Name'],
                        'date' => $record['date'],
                        'Identification' => $record['Identification'],
                        'Orgin' => $record['Orgin'],
                        'Destination' => $record['Destination'],
                        'Debit' => $record['Debit'],
                        'Credit' => $record['Credit']
                    ]);
                }
            }
        } else {
            // There's a statement record - get transactions from that date onwards
            $sql = "SELECT * FROM (
                SELECT ticket.ticket AS refID, 'Ticket' AS TRANSACTION_Type, passenger_name AS Passenger_Name,
                ticket.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, pnr AS Identification,
                airports.airport_code AS Orgin, to_airports.airport_code AS Destination,
                sale AS Debit, 0 AS Credit
                FROM ticket
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticket.currencyID = :CurID
                AND DATE(ticket.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT visa.visa_id AS refID, 'Visa' AS TRANSACTION_Type, passenger_name AS Passenger_Name,
                visa.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, country_names AS Identification,
                '' AS Orgin, '' AS Destination, sale AS Debit, 0 AS Credit
                FROM visa
                INNER JOIN country_name ON country_name.country_id = visa.country_id
                WHERE visa.customer_id = :id AND visa.saleCurrencyID = :CurID
                AND DATE(visa.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT visaextracharges.visaExtraChargesID AS refID,
                CASE WHEN visaextracharges.typeID = 1 THEN 'Visa Fine'
                     WHEN visaextracharges.typeID = 2 THEN 'Escape Report'
                     WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' END AS TRANSACTION_Type,
                visa.passenger_name AS Passenger_Name, visaextracharges.datetime AS datetime,
                DATE(visaextracharges.datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(visaextracharges.datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                visaextracharges.salePrice AS Debit, 0 AS Credit
                FROM visaextracharges
                INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id
                INNER JOIN country_name ON country_name.country_id = visa.country_id
                WHERE visa.customer_id = :id AND visaextracharges.saleCurrencyID = :CurID
                AND DATE(visaextracharges.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT residence.residenceID AS refID, 'Residence' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, residence.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                sale_price AS Debit, 0 AS Credit
                FROM residence
                INNER JOIN country_name ON country_name.country_id = residence.VisaType
                WHERE residence.customer_id = :id AND residence.saleCurID = :CurID
                AND DATE(residence.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT residencefine.residenceFineID AS refID, 'Residence Fine' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, residencefine.datetime AS datetime,
                DATE(residencefine.datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(residencefine.datetime), '%d-%b-%Y') AS date,
                country_names AS Identification, '' AS Orgin, '' AS Destination,
                residencefine.fineAmount AS Debit, 0 AS Credit
                FROM residencefine
                INNER JOIN residence ON residence.residenceID = residencefine.residenceID
                INNER JOIN country_name ON country_name.country_id = residence.VisaType
                WHERE residence.customer_id = :id AND residencefine.fineCurrencyID = :CurID
                AND DATE(residencefine.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT servicedetails.serviceDetailsID AS refID, serviceName AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, service_date AS datetime,
                DATE(service_date) AS nonFormatedDate, DATE_FORMAT(DATE(service_date), '%d-%b-%Y') AS date,
                service_details AS Identification, '' AS Orgin, '' AS Destination,
                salePrice AS Debit, 0 AS Credit
                FROM servicedetails
                INNER JOIN service ON service.serviceID = servicedetails.serviceID
                WHERE servicedetails.customer_id = :id AND servicedetails.saleCurrencyID = :CurID
                AND DATE(servicedetails.service_date) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT customer_payments.pay_id AS refID, 'Payment' AS TRANSACTION_Type,
                CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN
                    CONCAT('Payment For ', (SELECT DISTINCT passenger_name FROM residence WHERE residence.residenceID = customer_payments.PaymentFor), ' Residency')
                WHEN customer_payments.residenceFinePayment IS NOT NULL THEN
                    CONCAT('Residence Fine Payment For ', (SELECT DISTINCT passenger_name FROM residence INNER JOIN residencefine ON residence.residenceID = residencefine.residenceID WHERE residencefine.residenceFineID = customer_payments.residenceFinePayment), ' Residency')
                ELSE remarks END AS Passenger_Name,
                customer_payments.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN
                    (SELECT country_names FROM country_name WHERE country_id = (SELECT DISTINCT residence.VisaType FROM residence WHERE residence.residenceID = customer_payments.PaymentFor))
                WHEN customer_payments.residenceFinePayment IS NOT NULL THEN
                    (SELECT country_names FROM country_name WHERE country_id = (SELECT DISTINCT residence.VisaType FROM residence INNER JOIN residencefine ON residence.residenceID = residencefine.residenceID WHERE customer_payments.residenceFinePayment = residencefine.residenceFineID))
                ELSE '' END AS Identification,
                '' AS Orgin, '' AS Destination, 0 AS Debit, IFNULL(payment_amount, 0) AS Credit
                FROM customer_payments
                WHERE customer_payments.customer_id = :id AND customer_payments.currencyID = :CurID
                AND DATE(customer_payments.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT hotel.hotel_id AS refID, 'Hotel Reservation' AS TRANSACTION_Type,
                hotel.passenger_name AS Passenger_Name, hotel.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CONCAT('Hotel: ', hotel_name) AS Identification, '' AS Orgin,
                country_names AS Destination, sale_price AS Debit, 0 AS Credit
                FROM hotel
                INNER JOIN country_name ON country_name.country_id = hotel.country_id
                WHERE hotel.customer_id = :id AND hotel.saleCurrencyID = :CurID
                AND DATE(hotel.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT car_rental.car_id AS refID, 'Car Reservation' AS TRANSACTION_Type,
                car_rental.passenger_name AS Passenger_Name, car_rental.datetime AS datetime,
                DATE(datetime) AS nonFormatedDate, DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date,
                CONCAT('Car Description: ', car_description) AS Identification,
                '' AS Orgin, '' AS Destination, sale_price AS Debit, 0 AS Credit
                FROM car_rental
                WHERE car_rental.customer_id = :id AND car_rental.saleCurrencyID = :CurID
                AND DATE(car_rental.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT datechange.change_id AS refID, 'Date Extension' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, datechange.datetime AS datetime,
                DATE(extended_Date) AS nonFormatedDate, DATE_FORMAT(extended_Date, '%d-%b-%Y') AS date,
                pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, datechange.sale_amount AS Debit, 0 AS Credit
                FROM datechange
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticketStatus = 1 AND datechange.saleCurrencyID = :CurID
                AND DATE(datechange.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT loan.loan_id AS refID, 'Loan' AS TRANSACTION_Type, '' AS Passenger_Name,
                loan.datetime AS datetime, DATE(datetime) AS nonFormatedDate,
                DATE_FORMAT(DATE(datetime), '%d-%b-%Y') AS date, remarks AS Identification,
                '' AS Orgin, '' AS Destination, amount AS Debit, 0 AS Credit
                FROM loan
                WHERE loan.customer_id = :id AND loan.currencyID = :CurID
                AND DATE(loan.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT datechange.change_id AS refID, 'Refund' AS TRANSACTION_Type,
                passenger_name AS Passenger_Name, datechange.datetime AS datetime,
                DATE(extended_Date) AS nonFormatedDate, DATE_FORMAT(extended_Date, '%d-%b-%Y') AS date,
                pnr AS Identification, airports.airport_code AS Orgin,
                to_airports.airport_code AS Destination, 0 AS Debit, datechange.sale_amount AS Credit
                FROM datechange
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id
                INNER JOIN airports ON airports.airport_id = ticket.from_id
                INNER JOIN airports AS to_airports ON to_airports.airport_id = ticket.to_id
                WHERE ticket.customer_id = :id AND ticketStatus = 2 AND datechange.saleCurrencyID = :CurID
                AND DATE(datechange.datetime) BETWEEN :from_date AND CURDATE()
            ) baseTable ORDER BY datetime ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $customer_id);
            $stmt->bindParam(':CurID', $currency_id);
            $stmt->bindParam(':from_date', $checkCustomerRecord['referenceDate']);
            $stmt->execute();
            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $flagDecision = 0;
            foreach ($records as $record) {
                if (intval($record['refID']) != intval($checkCustomerRecord['referenceID'])) {
                    if ($flagDecision == 1) {
                        if (date('Y', strtotime($record['nonFormatedDate'])) < date('Y')) {
                            $startingBalance = $startingBalance + intval($record['Debit']) - intval($record['Credit']);
                        } else {
                            if ($controllingLoopForAddingPreviousBalance == 1) {
                                if ($startingBalance != 0) {
                                    if ($startingBalance < 0) {
                                        array_push($recordsToDisplayArr, [
                                            'TRANSACTION_Type' => 'Starting Balance',
                                            'Passenger_Name' => '',
                                            'date' => '',
                                            'Identification' => '',
                                            'Orgin' => '',
                                            'Destination' => '',
                                            'Debit' => 0,
                                            'Credit' => abs($startingBalance)
                                        ]);
                                    } else if ($startingBalance > 0) {
                                        array_push($recordsToDisplayArr, [
                                            'TRANSACTION_Type' => 'Starting Balance',
                                            'Passenger_Name' => '',
                                            'date' => '',
                                            'Identification' => '',
                                            'Orgin' => '',
                                            'Destination' => '',
                                            'Debit' => $startingBalance,
                                            'Credit' => 0
                                        ]);
                                    }
                                }
                                $controllingLoopForAddingPreviousBalance = 0;
                            }
                            array_push($recordsToDisplayArr, [
                                'TRANSACTION_Type' => $record['TRANSACTION_Type'],
                                'Passenger_Name' => $record['Passenger_Name'],
                                'date' => $record['date'],
                                'Identification' => $record['Identification'],
                                'Orgin' => $record['Orgin'],
                                'Destination' => $record['Destination'],
                                'Debit' => $record['Debit'],
                                'Credit' => $record['Credit']
                            ]);
                        }
                    }
                } else {
                    if ($record['TRANSACTION_Type'] == $checkCustomerRecord['statementFor']) {
                        $flagDecision = 1;
                    } else {
                        $flagDecision = 0;
                    }
                }
            }
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $recordsToDisplayArr
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

