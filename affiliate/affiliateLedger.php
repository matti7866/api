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

// Database connection already available as $pdo from connection.php

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get affiliate customers (customers with affiliate_supp_id)
    if ($action == 'getCustomers') {
        $sql = "SELECT main_customer AS customer_id, customer_name 
                FROM (
                    SELECT customer_id as main_customer, 
                           CONCAT(customer_name, '--', customer_phone) AS customer_name,
                           affliate_supp_id
                    FROM customer 
                    WHERE affliate_supp_id IS NOT NULL
                ) AS baseTable 
                ORDER BY customer_name ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customers
        ]);
    }
    
    // Get currencies for affiliate business
    if ($action == 'getCurrencies') {
        $customer_id = $input['customer_id'] ?? '';
        $type = $input['type'] ?? 'all';
        
        if ($type == 'all' || empty($customer_id)) {
            $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
            $stmt = $pdo->prepare($sql);
        } else {
            // Get currencies that have transactions for this customer
            $sql = "SELECT curID AS currencyID, curName AS currencyName 
                    FROM (
                        SELECT curID, 
                               (SELECT currencyName FROM currency WHERE currency.currencyID = curID) AS curName
                        FROM (
                            SELECT ticket.currencyID AS curID FROM ticket WHERE ticket.customer_id = :customer_id
                            UNION SELECT visa.saleCurrencyID AS curID FROM visa WHERE visa.customer_id = :customer_id
                            UNION SELECT residence.saleCurID AS curID FROM residence WHERE residence.customer_id = :customer_id
                            UNION SELECT servicedetails.saleCurrencyID AS curID FROM servicedetails WHERE servicedetails.customer_id = :customer_id
                            UNION SELECT hotel.saleCurrencyID AS curID FROM hotel WHERE hotel.customer_id = :customer_id
                            UNION SELECT car_rental.saleCurrencyID AS curID FROM car_rental WHERE car_rental.customer_id = :customer_id
                            UNION SELECT customer_payments.currencyID AS curID FROM customer_payments WHERE customer_payments.customer_id = :customer_id
                        ) AS baseTable
                    ) AS finalTable 
                    WHERE curName IS NOT NULL
                    ORDER BY curName ASC";
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
    
    // Get pending affiliate customers
    if ($action == 'getPendingCustomers') {
        $customer_id = $input['customer_id'] ?? '';
        $currency_id = $input['currency_id'] ?? null;
        
        if (empty($currency_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency ID is required'
            ]);
        }
        
        if (empty($customer_id)) {
            // Get all affiliate customers with pending amounts
            $sql = "SELECT * FROM (
                        SELECT customer_id as main_customer, customer_name,
                               IFNULL(customer_email,'') AS customer_email,
                               customer_whatsapp, customer_phone, affliate_supp_id,
                               (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = main_customer AND ticket.currencyID = :currencyID)
                             + (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = main_customer AND visa.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = main_customer AND visaextracharges.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = main_customer AND residence.saleCurID = :currencyID)
                             + (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = main_customer AND servicedetails.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = main_customer AND hotel.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = main_customer AND car_rental.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = main_customer AND loan.currencyID = :currencyID)
                             - (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID)
                             - (SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = affliate_supp_id AND ticket.net_CurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = affliate_supp_id AND visa.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = affliate_supp_id AND residence.offerLetterCostCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = affliate_supp_id AND residence.insuranceCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = affliate_supp_id AND residence.laborCardCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = affliate_supp_id AND residence.eVisaCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = affliate_supp_id AND residence.changeStatusCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = affliate_supp_id AND residence.medicalTCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = affliate_supp_id AND residence.emiratesIDCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = affliate_supp_id AND residence.visaStampingCur = :currencyID)
                             - (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = affliate_supp_id AND servicedetails.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = affliate_supp_id AND visaextracharges.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = affliate_supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 1)
                             - (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = affliate_supp_id AND hotel.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = affliate_supp_id AND car_rental.netCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = affliate_supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 2)
                             + (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = affliate_supp_id AND payment.currencyID = :currencyID) AS total
                        FROM customer 
                        WHERE affliate_supp_id IS NOT NULL
                    ) as baseTable 
                    WHERE total != 0 
                    ORDER BY customer_name ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Get specific customer
            $sql = "SELECT * FROM (
                        SELECT customer_id as main_customer, customer_name,
                               IFNULL(customer_email,'') AS customer_email,
                               customer_whatsapp, customer_phone, affliate_supp_id,
                               (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = main_customer AND ticket.currencyID = :currencyID)
                             + (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = main_customer AND visa.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM visaextracharges INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = main_customer AND visaextracharges.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE residence.customer_id = main_customer AND residence.saleCurID = :currencyID)
                             + (SELECT IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = main_customer AND servicedetails.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 1 AND datechange.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = main_customer AND hotel.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE car_rental.customer_id = main_customer AND car_rental.saleCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(loan.amount),0) FROM loan WHERE loan.customer_id = main_customer AND loan.currencyID = :currencyID)
                             - (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = main_customer AND datechange.ticketStatus = 2 AND datechange.saleCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM customer_payments WHERE customer_payments.customer_id = main_customer AND customer_payments.currencyID = :currencyID)
                             - (SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = affliate_supp_id AND ticket.net_CurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = affliate_supp_id AND visa.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = affliate_supp_id AND residence.offerLetterCostCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = affliate_supp_id AND residence.insuranceCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = affliate_supp_id AND residence.laborCardCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = affliate_supp_id AND residence.eVisaCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = affliate_supp_id AND residence.changeStatusCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = affliate_supp_id AND residence.medicalTCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = affliate_supp_id AND residence.emiratesIDCur = :currencyID)
                             - (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = affliate_supp_id AND residence.visaStampingCur = :currencyID)
                             - (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = affliate_supp_id AND servicedetails.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = affliate_supp_id AND visaextracharges.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = affliate_supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 1)
                             - (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = affliate_supp_id AND hotel.netCurrencyID = :currencyID)
                             - (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = affliate_supp_id AND car_rental.netCurrencyID = :currencyID)
                             + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = affliate_supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 2)
                             + (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = affliate_supp_id AND payment.currencyID = :currencyID) AS total
                        FROM customer 
                        WHERE customer_id = :customer_id
                    ) AS baseTable 
                    WHERE total != 0 
                    ORDER BY customer_name ASC";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->bindParam(':customer_id', $customer_id);
            $stmt->execute();
            $customers = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($customers) {
                $customers = [$customers];
            } else {
                $customers = [];
            }
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customers
        ]);
    }
    
    // Default response for unknown action
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action: ' . $action
    ]);
    
} catch (PDOException $e) {
    error_log("Affiliate Ledger Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Affiliate Ledger Error: " . $e->getMessage());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>


