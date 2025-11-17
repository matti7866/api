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

// Verify JWT token first
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
    
    // Create supplier
    if ($action == 'createSupplier') {
        $supplier_name = isset($input['supplier_name']) ? trim($input['supplier_name']) : null;
        $supplier_email = isset($input['supplier_email']) ? trim($input['supplier_email']) : null;
        $supplier_address = isset($input['supplier_address']) ? trim($input['supplier_address']) : null;
        $supplier_phone = isset($input['supplier_phone']) ? trim($input['supplier_phone']) : null;
        $supplier_type_id = isset($input['supplier_type_id']) ? trim($input['supplier_type_id']) : null;
        
        $errors = [];
        
        if (empty($supplier_name)) $errors['supplier_name'] = 'Supplier name is required';
        if (empty($supplier_email)) $errors['supplier_email'] = 'Supplier email is required';
        if (empty($supplier_address)) $errors['supplier_address'] = 'Supplier address is required';
        if (empty($supplier_phone)) $errors['supplier_phone'] = 'Supplier phone is required';
        if (empty($supplier_type_id) || $supplier_type_id == '-1') $errors['supplier_type_id'] = 'Supplier type is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $sql = "INSERT INTO `supplier`(`supp_name`, `supp_email`, `supp_add`, `supp_phone`, `supp_type_id`) 
                VALUES (:supp_name, :supp_email, :supp_add, :supp_phone, :supp_type_id)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_name', $supplier_name);
        $stmt->bindParam(':supp_email', $supplier_email);
        $stmt->bindParam(':supp_add', $supplier_address);
        $stmt->bindParam(':supp_phone', $supplier_phone);
        $stmt->bindParam(':supp_type_id', $supplier_type_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Supplier created successfully'
        ]);
    }
    
    // Get all suppliers
    if ($action == 'getSuppliers') {
        $sql = "SELECT `supp_id`, `supp_name`, `supp_email`, `supp_add`, `supp_phone`, 
                CASE WHEN supp_type_id = 1 THEN 'Travel' ELSE 'Exchange' END AS supp_type,
                supp_type_id
                FROM `supplier` ORDER BY supp_name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $suppliers
        ]);
    }
    
    // Get single supplier
    if ($action == 'getSupplier') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        
        if (empty($supplier_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM supplier WHERE supp_id = :supp_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_id', $supplier_id);
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
    
    // Update supplier
    if ($action == 'updateSupplier') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        $supplier_name = isset($input['supplier_name']) ? trim($input['supplier_name']) : null;
        $supplier_email = isset($input['supplier_email']) ? trim($input['supplier_email']) : null;
        $supplier_address = isset($input['supplier_address']) ? trim($input['supplier_address']) : null;
        $supplier_phone = isset($input['supplier_phone']) ? trim($input['supplier_phone']) : null;
        $supplier_type_id = isset($input['supplier_type_id']) ? trim($input['supplier_type_id']) : null;
        
        $errors = [];
        
        if (empty($supplier_id)) $errors['supplier_id'] = 'Supplier ID is required';
        if (empty($supplier_name)) $errors['supplier_name'] = 'Supplier name is required';
        if (empty($supplier_email)) $errors['supplier_email'] = 'Supplier email is required';
        if (empty($supplier_address)) $errors['supplier_address'] = 'Supplier address is required';
        if (empty($supplier_phone)) $errors['supplier_phone'] = 'Supplier phone is required';
        if (empty($supplier_type_id)) $errors['supplier_type_id'] = 'Supplier type is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $sql = "UPDATE `supplier` SET supp_name = :supp_name, supp_email = :supp_email, 
                supp_add = :supp_add, supp_phone = :supp_phone, supp_type_id = :supp_type_id 
                WHERE supp_id = :supp_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_name', $supplier_name);
        $stmt->bindParam(':supp_email', $supplier_email);
        $stmt->bindParam(':supp_add', $supplier_address);
        $stmt->bindParam(':supp_phone', $supplier_phone);
        $stmt->bindParam(':supp_type_id', $supplier_type_id);
        $stmt->bindParam(':supp_id', $supplier_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Supplier updated successfully'
        ]);
    }
    
    // Delete supplier
    if ($action == 'deleteSupplier') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        
        if (empty($supplier_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID is required'
            ]);
        }
        
        $sql = "DELETE FROM supplier WHERE supp_id = :supp_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_id', $supplier_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Supplier deleted successfully'
        ]);
    }
    
    // Get pending suppliers
    if ($action == 'getPendingSuppliers') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        
        if (empty($currency_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency ID is required'
            ]);
        }
        
        // Complex query to calculate pending amounts
        if (empty($supplier_id)) {
            $sql = "SELECT * FROM(SELECT supp_id as main_supp, supp_name, supp_email, supp_phone,
                    (SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = main_supp AND ticket.net_CurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = main_supp AND visa.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = main_supp AND residence.offerLetterCostCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = main_supp AND residence.insuranceCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = main_supp AND residence.laborCardCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = main_supp AND residence.eVisaCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = main_supp AND residence.changeStatusCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = main_supp AND residence.medicalTCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = main_supp AND residence.emiratesIDCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = main_supp AND residence.visaStampingCur = :currencyID)
                    + (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = main_supp AND servicedetails.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = main_supp AND visaextracharges.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 1)
                    + (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = main_supp AND hotel.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = main_supp AND car_rental.netCurrencyID = :currencyID)
                    - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 2)
                    - (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = main_supp AND payment.currencyID = :currencyID) AS Pending
                    FROM supplier) AS Total WHERE Pending != 0 ORDER BY supp_name ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->execute();
            $suppliers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $sql = "SELECT * FROM(SELECT supp_id as main_supp, supp_name, supp_email, supp_phone,
                    (SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = main_supp AND ticket.net_CurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = main_supp AND visa.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = main_supp AND residence.offerLetterCostCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = main_supp AND residence.insuranceCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = main_supp AND residence.laborCardCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = main_supp AND residence.eVisaCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = main_supp AND residence.changeStatusCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = main_supp AND residence.medicalTCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = main_supp AND residence.emiratesIDCur = :currencyID)
                    + (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = main_supp AND residence.visaStampingCur = :currencyID)
                    + (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = main_supp AND servicedetails.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = main_supp AND visaextracharges.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 1)
                    + (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = main_supp AND hotel.netCurrencyID = :currencyID)
                    + (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = main_supp AND car_rental.netCurrencyID = :currencyID)
                    - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = main_supp AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 2)
                    - (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = main_supp AND payment.currencyID = :currencyID) AS Pending
                    FROM supplier WHERE supp_id = :supp_id) as baseTable WHERE Pending != 0 ORDER by supp_name";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':currencyID', $currency_id);
            $stmt->bindParam(':supp_id', $supplier_id);
            $stmt->execute();
            $supplier = $stmt->fetch(PDO::FETCH_ASSOC);
            $suppliers = $supplier ? [$supplier] : [];
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $suppliers
        ]);
    }
    
    // Get supplier payment details (total pending)
    if ($action == 'getSupplierPaymentDetails') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        
        if (empty($supplier_id) || empty($currency_id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID and Currency ID are required'
            ]);
        }
        
        $sql = "SELECT ((SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = :supp_id AND ticket.net_CurrencyID = :currencyID)
                + (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = :supp_id AND visa.netCurrencyID = :currencyID)
                + (SELECT IFNULL(SUM(residence.offerLetterCost),0) FROM residence WHERE residence.offerLetterSupplier = :supp_id AND residence.offerLetterCostCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.insuranceCost),0) FROM residence WHERE residence.insuranceSupplier = :supp_id AND residence.insuranceCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.laborCardFee),0) FROM residence WHERE residence.laborCardSupplier = :supp_id AND residence.laborCardCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.eVisaCost),0) FROM residence WHERE residence.eVisaSupplier = :supp_id AND residence.eVisaCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.changeStatusCost),0) FROM residence WHERE residence.changeStatusSupplier = :supp_id AND residence.changeStatusCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.medicalTCost),0) FROM residence WHERE residence.medicalSupplier = :supp_id AND residence.medicalTCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.emiratesIDCost),0) FROM residence WHERE residence.emiratesIDSupplier = :supp_id AND residence.emiratesIDCur = :currencyID)
                + (SELECT IFNULL(SUM(residence.visaStampingCost),0) FROM residence WHERE residence.visaStampingSupplier = :supp_id AND residence.visaStampingCur = :currencyID)
                + (SELECT IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = :supp_id AND servicedetails.netCurrencyID = :currencyID)
                + (SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges WHERE visaextracharges.supplierID = :supp_id AND visaextracharges.netCurrencyID = :currencyID)
                + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = :supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 1)
                + (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = :supp_id AND hotel.netCurrencyID = :currencyID)
                + (SELECT IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = :supp_id AND car_rental.netCurrencyID = :currencyID)
                - (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange WHERE datechange.supplier = :supp_id AND datechange.netCurrencyID = :currencyID AND datechange.ticketStatus = 2)
                - (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = :supp_id AND payment.currencyID = :currencyID)) AS total";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_id', $supplier_id);
        $stmt->bindParam(':currencyID', $currency_id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => ['total' => $result['total'] ?? 0]
        ]);
    }
    
    // Make payment
    if ($action == 'makePayment') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? trim($input['payment_amount']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        $remarks = isset($input['remarks']) ? trim($input['remarks']) : null;
        $account_id = isset($input['account_id']) ? trim($input['account_id']) : null;
        
        $errors = [];
        
        if (empty($supplier_id)) $errors['supplier_id'] = 'Supplier ID is required';
        if (empty($payment_amount) || $payment_amount <= 0) $errors['payment_amount'] = 'Payment amount must be greater than 0';
        if (empty($currency_id)) $errors['currency_id'] = 'Currency is required';
        if (empty($account_id) || $account_id == '-1') $errors['account_id'] = 'Account is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        $sql = "INSERT INTO `payment`(`supp_id`, `payment_amount`, `currencyID`, `payment_detail`, `staff_id`, `accountID`) 
                VALUES (:supp_id, :payment_amount, :currencyID, :payment_detail, :staff_id, :accountID)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supp_id', $supplier_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':currencyID', $currency_id);
        $stmt->bindParam(':payment_detail', $remarks);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->bindParam(':accountID', $account_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment recorded successfully'
        ]);
    }
    
    // Get currencies for supplier
    if ($action == 'getCurrencies') {
        $supplier_id = isset($input['supplier_id']) ? trim($input['supplier_id']) : null;
        
        if (empty($supplier_id)) {
            // Get all currencies
            $sql = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Get currencies for specific supplier (complex query)
            $sql = "SELECT curID AS currencyID, (SELECT currencyName FROM currency WHERE currency.currencyID = curID) AS currencyName 
                    FROM (SELECT ticket.net_CurrencyID AS curID FROM ticket WHERE ticket.supp_id = :supp_id 
                    UNION SELECT visa.netCurrencyID AS curID FROM visa WHERE visa.supp_id = :supp_id 
                    UNION SELECT residence.offerLetterCostCur AS curID FROM residence WHERE residence.offerLetterSupplier = :supp_id 
                    UNION SELECT insuranceCur AS curID FROM residence WHERE residence.insuranceSupplier = :supp_id 
                    UNION SELECT residence.laborCardCur AS curID FROM residence WHERE residence.laborCardSupplier = :supp_id 
                    UNION SELECT residence.eVisaCur AS curID FROM residence WHERE residence.eVisaSupplier = :supp_id 
                    UNION SELECT residence.changeStatusCur AS curID FROM residence WHERE residence.changeStatusSupplier = :supp_id 
                    UNION SELECT medicalTCur AS curID FROM residence WHERE residence.medicalSupplier = :supp_id 
                    UNION SELECT residence.emiratesIDCur AS curID FROM residence WHERE residence.emiratesIDSupplier = :supp_id 
                    UNION SELECT residence.visaStampingCur AS curID FROM residence WHERE residence.visaStampingSupplier = :supp_id 
                    UNION SELECT servicedetails.netCurrencyID AS curID FROM servicedetails WHERE servicedetails.Supplier_id = :supp_id 
                    UNION SELECT visaextracharges.netCurrencyID AS curID FROM visaextracharges WHERE visaextracharges.supplierID = :supp_id 
                    UNION SELECT datechange.netCurrencyID AS curID FROM datechange WHERE datechange.supplier = :supp_id 
                    UNION SELECT hotel.netCurrencyID AS curID FROM hotel WHERE hotel.supplier_id = :supp_id 
                    UNION SELECT car_rental.netCurrencyID AS curID FROM car_rental WHERE car_rental.supplier_id = :supp_id 
                    UNION SELECT payment.currencyID AS curID FROM payment WHERE payment.supp_id = :supp_id) AS baseTable 
                    GROUP BY curID ORDER BY currencyName ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':supp_id', $supplier_id);
            $stmt->execute();
            $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $currencies
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Supplier API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

