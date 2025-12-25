<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once '../../api/auth/JWTHelper.php';
require_once '../../connection.php';

/**
 * Get SMS API access token
 */
function getSMSToken() {
    $loginUrl = 'https://nexus.eandenterprise.com/api/v1/accounts/users/login';
    $ch = curl_init($loginUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'email' => 'selabnadirydxb@gmail.com',
        'password' => 'Uae@2020'
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        return $data['access_token'] ?? false;
    }
    return false;
}

/**
 * Send payment confirmation SMS
 */
function sendPaymentSMS($phone, $amount, $currency, $customerName) {
    if (empty($phone) || strlen($phone) < 10) {
        return ['sent' => false, 'message' => 'Invalid phone number'];
    }
    
    $token = getSMSToken();
    if (!$token) {
        return ['sent' => false, 'message' => 'Failed to get SMS token'];
    }
    
    $message = "Dear $customerName,\n\nYour payment of $currency $amount has been received and credited to your account.\n\nThank you for your payment.\n\nSelab Nadiry Travels";
    
    $ch = curl_init('https://nexus.eandenterprise.com/api/v1/sms/send');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'msg' => $message,
        'recipient' => $phone,
        'sender' => 'SNTRAVEL',
        'category' => 'TXN'
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);
    
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 || $httpCode === 201 || $httpCode === 202) {
        return ['sent' => true, 'message' => 'SMS sent'];
    }
    return ['sent' => false, 'message' => 'SMS failed: HTTP ' . $httpCode];
}

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
    
    // Get user_id from JWT token
    $user_id = null;
    if (isset($user['staff_id'])) {
        $user_id = intval($user['staff_id']);
    } elseif (isset($user['user_id'])) {
        $user_id = intval($user['user_id']);
    } elseif (isset($user['id'])) {
        $user_id = intval($user['id']);
    }
    
    // Get Customers with Pending Balances
    if ($action == 'getCustomers') {
        $sql = "SELECT main_customer AS customer_id, customer_name FROM (
            SELECT customer_id as main_customer,
            CONCAT(customer_name,'--',customer_phone) AS customer_name,
            (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges 
             INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine 
             INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = main_customer) +
            (SELECT IFNULL(SUM(rcc.sale_price),0) FROM residence_custom_charges rcc
             INNER JOIN residence ON residence.residenceID = rcc.residence_id WHERE residence.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = main_customer) +
            (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
             INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 1) + 
            (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = main_customer) + 
            (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = main_customer) - 
            (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
             INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 2) - 
            (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
             WHERE customer_payments.customer_id = main_customer) AS total 
            FROM customer
        ) AS baseTable WHERE total != 0 ORDER BY customer_name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customers
        ]);
    }
    
    // Get Pending Customers (with currency filter)
    if ($action == 'getPendingCustomers') {
        $customer_id = isset($input['customer_id']) ? trim($input['customer_id']) : '';
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        
        if (!$currency_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency ID is required'
            ]);
        }
        
        if (empty($customer_id)) {
            // Get all customers with pending balances for this currency
            // For AED (currencyID = 1), exclude residence-related transactions
            $isAED = ($currency_id == 1);
            
            $sql = "SELECT * FROM (
                SELECT customer_id as main_customer, customer_name,
                IFNULL(customer_email,'') AS customer_email, customer_whatsapp, customer_phone,
                (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = main_customer AND ticket.currencyID = :currencyID) + 
                (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = main_customer AND visa.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges 
                 INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = main_customer AND visaextracharges.saleCurrencyID = :currencyID) + " .
                ($isAED ? "0" : "(SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = main_customer AND residence.saleCurID = :currencyID)") . " + " .
                ($isAED ? "0" : "(SELECT IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = main_customer AND residencefine.fineCurrencyID = :currencyID)") . " + " .
                ($isAED ? "0" : "(SELECT IFNULL(SUM(rcc.sale_price),0) FROM residence_custom_charges rcc
                 INNER JOIN residence ON residence.residenceID = rcc.residence_id WHERE residence.customer_id = main_customer AND rcc.currency_id = :currencyID)") . " + 
                (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = main_customer AND servicedetails.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = main_customer AND hotel.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = main_customer AND car_rental.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = main_customer AND loan.currencyID = :currencyID) - 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = :currencyID) - " .
                ($isAED ? "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                 WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID 
                 AND customer_payments.PaymentFor IS NULL AND customer_payments.residenceFinePayment IS NULL)" 
                : "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                 WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID)") . " AS total 
                FROM customer
            ) AS baseTable WHERE ABS(total) > 0.01 ORDER BY customer_name ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Get specific customer
            // For AED (currencyID = 1), exclude residence-related transactions
            $isAED = ($currency_id == 1);
            
            $sql = "SELECT * FROM (
                SELECT customer_id as main_customer, customer_name,
                IFNULL(customer_email,'') AS customer_email, customer_whatsapp, customer_phone,
                (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = main_customer AND ticket.currencyID = :currencyID) + 
                (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = main_customer AND visa.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges 
                 INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = main_customer AND visaextracharges.saleCurrencyID = :currencyID) + " .
                ($isAED ? "0" : "(SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = main_customer AND residence.saleCurID = :currencyID)") . " + " .
                ($isAED ? "0" : "(SELECT IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine 
                 INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = main_customer AND residencefine.fineCurrencyID = :currencyID)") . " + 
                (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = main_customer AND servicedetails.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = main_customer AND hotel.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = main_customer AND car_rental.saleCurrencyID = :currencyID) + 
                (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = main_customer AND loan.currencyID = :currencyID) - 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = :currencyID) - " .
                ($isAED ? "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                 WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID 
                 AND customer_payments.PaymentFor IS NULL AND customer_payments.residenceFinePayment IS NULL)" 
                : "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                 WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID)") . " AS total 
                FROM customer
            ) AS baseTable WHERE ABS(total) > 0.01 ORDER BY customer_name ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->bindParam(':customer_id', $customer_id);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $customers = $result ? [$result] : [];
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customers
        ]);
    }
    
    // Get Currencies
    if ($action == 'getCurrencies') {
        $customer_id = isset($input['customer_id']) ? trim($input['customer_id']) : '';
        $type = isset($input['type']) ? trim($input['type']) : 'all';
        
        if ($type == 'all' || empty($customer_id)) {
            $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
            $stmt = $pdo->prepare($sql);
        } else {
            $sql = "SELECT curID AS currencyID, curName AS currencyName FROM (
                SELECT curID, 
                (SELECT currencyName FROM currency WHERE currency.currencyID = curID) AS curName,
                (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = :customer_id AND ticket.currencyID = curID) + 
                (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = :customer_id AND visa.saleCurrencyID = curID) + 
                (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges 
                 INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = :customer_id AND visaextracharges.saleCurrencyID = curID) +
                CASE WHEN curID = 1 THEN 0 ELSE 
                    (SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = :customer_id AND residence.saleCurID = curID)
                END + 
                CASE WHEN curID = 1 THEN 0 ELSE 
                    (SELECT IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine 
                     INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = :customer_id AND residencefine.fineCurrencyID = curID)
                END +
                CASE WHEN curID = 1 THEN 0 ELSE 
                    (SELECT IFNULL(SUM(rcc.sale_price),0) FROM residence_custom_charges rcc
                     INNER JOIN residence ON residence.residenceID = rcc.residence_id WHERE residence.customer_id = :customer_id AND rcc.currency_id = curID)
                END + 
                (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = :customer_id AND servicedetails.saleCurrencyID = curID) + 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = curID) + 
                (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = :customer_id AND hotel.saleCurrencyID = curID) + 
                (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = :customer_id AND car_rental.saleCurrencyID = curID) + 
                (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = :customer_id AND loan.currencyID = curID) - 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
                 INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = curID) - 
                CASE WHEN curID = 1 THEN 
                    (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                     WHERE customer_payments.customer_id = :customer_id AND customer_payments.currencyID = curID 
                     AND customer_payments.PaymentFor IS NULL AND customer_payments.residenceFinePayment IS NULL)
                ELSE 
                    (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
                     WHERE customer_payments.customer_id = :customer_id AND customer_payments.currencyID = curID)
                END AS total 
                FROM (
                    SELECT ticket.currencyID AS curID FROM ticket WHERE ticket.customer_id = :customer_id 
                    UNION SELECT visa.saleCurrencyID AS curID FROM visa WHERE visa.customer_id = :customer_id 
                    UNION SELECT visaextracharges.saleCurrencyID AS curID FROM visaextracharges 
                    INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = :customer_id 
                    UNION SELECT residence.saleCurID AS curID FROM residence WHERE residence.customer_id = :customer_id 
                    UNION SELECT residencefine.fineCurrencyID AS curID FROM residencefine 
                    INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = :customer_id 
                    UNION SELECT servicedetails.saleCurrencyID AS curID FROM servicedetails WHERE servicedetails.customer_id = :customer_id 
                    UNION SELECT datechange.saleCurrencyID AS curID FROM datechange 
                    INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id 
                    UNION SELECT loan.currencyID AS curID FROM loan WHERE loan.customer_id = :customer_id 
                    UNION SELECT hotel.saleCurrencyID AS curID FROM hotel WHERE hotel.customer_id = :customer_id 
                    UNION SELECT car_rental.saleCurrencyID AS curID FROM car_rental WHERE car_rental.customer_id = :customer_id 
                    UNION SELECT customer_payments.currencyID AS curID FROM customer_payments WHERE customer_payments.customer_id = :customer_id
                ) AS baseTable
            ) AS finalTable WHERE ABS(total) > 0.01 ORDER BY curName ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':customer_id', $customer_id);
        }
        
        $stmt->execute();
        $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $currencies
        ]);
    }
    
    // Get Total Charges for Customer
    if ($action == 'getTotalCharges') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        
        if (!$customer_id || !$currency_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID and Currency ID are required'
            ]);
        }
        
        // For AED (currencyID = 1), exclude residence-related transactions
        $isAED = ($currency_id == 1);
        
        $sql = "SELECT 
            (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = :customer_id AND ticket.currencyID = :currencyID) + 
            (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = :customer_id AND visa.saleCurrencyID = :currencyID) + 
            (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges 
             INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = :customer_id AND visaextracharges.saleCurrencyID = :currencyID) + " .
            ($isAED ? "0" : "(SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = :customer_id AND residence.saleCurID = :currencyID)") . " + " .
            ($isAED ? "0" : "(SELECT IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine 
             INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE residence.customer_id = :customer_id AND residencefine.fineCurrencyID = :currencyID)") . " + " .
            ($isAED ? "0" : "(SELECT IFNULL(SUM(rcc.sale_price),0) FROM residence_custom_charges rcc
             INNER JOIN residence ON residence.residenceID = rcc.residence_id WHERE residence.customer_id = :customer_id AND rcc.currency_id = :currencyID)") . " + 
            (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = :customer_id AND servicedetails.saleCurrencyID = :currencyID) + 
            (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
             INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = :currencyID) + 
            (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = :customer_id AND hotel.saleCurrencyID = :currencyID) + 
            (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = :customer_id AND car_rental.saleCurrencyID = :currencyID) + 
            (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = :customer_id AND loan.currencyID = :currencyID) - 
            (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange 
             INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = :currencyID) - " .
            ($isAED ? "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
             WHERE customer_payments.customer_id = :customer_id AND customer_payments.currencyID = :currencyID 
             AND customer_payments.PaymentFor IS NULL AND customer_payments.residenceFinePayment IS NULL)" 
            : "(SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments 
             WHERE customer_payments.customer_id = :customer_id AND customer_payments.currencyID = :currencyID)") . " AS total";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':currencyID', $currency_id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $result
        ]);
    }
    
    // Add Payment
    if ($action == 'addPayment') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : 0;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        $remarks = isset($input['remarks']) ? trim($input['remarks']) : '';
        
        if (!$customer_id || $payment_amount <= 0 || !$currency_id || !$account_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Invalid payment data'
            ]);
        }
        
        // Get customer info for SMS
        $customerStmt = $pdo->prepare("SELECT customer_name, customer_phone FROM customer WHERE customer_id = :customer_id");
        $customerStmt->bindParam(':customer_id', $customer_id);
        $customerStmt->execute();
        $customerInfo = $customerStmt->fetch(PDO::FETCH_ASSOC);
        
        // Get currency name
        $currencyStmt = $pdo->prepare("SELECT currencyName FROM currency WHERE currencyID = :currency_id");
        $currencyStmt->bindParam(':currency_id', $currency_id);
        $currencyStmt->execute();
        $currencyInfo = $currencyStmt->fetch(PDO::FETCH_ASSOC);
        
        $sql = "INSERT INTO customer_payments (customer_id, payment_amount, currencyID, staff_id, remarks, accountID) 
                VALUES (:customer_id, :payment_amount, :currencyID, :staff_id, :remarks, :accountID)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':currencyID', $currency_id);
        $stmt->bindParam(':staff_id', $user_id);
        $stmt->bindParam(':remarks', $remarks);
        $stmt->bindParam(':accountID', $account_id);
        $stmt->execute();
        
        // Send SMS notification if customer has valid phone
        $smsStatus = ['sent' => false];
        if ($customerInfo && !empty($customerInfo['customer_phone'])) {
            try {
                $formattedAmount = number_format($payment_amount, 2);
                $currencyName = $currencyInfo['currencyName'] ?? 'AED';
                $smsStatus = sendPaymentSMS(
                    $customerInfo['customer_phone'],
                    $formattedAmount,
                    $currencyName,
                    $customerInfo['customer_name']
                );
                
                // Log SMS status
                error_log("Payment SMS to {$customerInfo['customer_phone']}: " . ($smsStatus['sent'] ? 'SUCCESS' : 'FAILED - ' . $smsStatus['message']));
            } catch (Exception $smsError) {
                error_log("Payment SMS Error: " . $smsError->getMessage());
            }
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment added successfully' . ($smsStatus['sent'] ? ' and SMS sent' : ''),
            'sms_sent' => $smsStatus['sent']
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

