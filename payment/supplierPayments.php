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
    
    // Get total charges for a supplier
    if ($action == 'getTotalCharges') {
        $supplier_id = isset($input['supplier_id']) ? intval($input['supplier_id']) : null;
        
        if (!$supplier_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Supplier ID is required'
            ]);
        }
        
        $sql = "SELECT curID, (SELECT currencyName FROM currency WHERE currency.currencyID = curID) AS curName, 
                (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = 
                datechange.ticket_id WHERE ticket.supp_id = :supplier_id AND datechange.ticketStatus = 2 AND datechange.netCurrencyID = 
                curID) + (SELECT IFNULL(SUM(payment.payment_amount),0) FROM payment WHERE payment.supp_id = :supplier_id AND 
                payment.currencyID = curID) - ((SELECT IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE ticket.supp_id = :supplier_id
                AND ticket.net_CurrencyID = curID) + (SELECT IFNULL(SUM(visa.net_price),0) FROM visa WHERE visa.supp_id = :supplier_id 
                AND visa.netCurrencyID = curID) + (SELECT IFNULL(SUM(datechange.net_amount),0) FROM datechange INNER JOIN ticket ON 
                ticket.ticket = datechange.ticket_id WHERE ticket.supp_id = :supplier_id AND datechange.ticketStatus = 1 AND 
                datechange.netCurrencyID = curID) + (SELECT IFNULL(SUM(hotel.net_price),0) FROM hotel WHERE hotel.supplier_id = 
                :supplier_id AND hotel.netCurrencyID = curID) + (SELECT IFNULL(SUM(residence.net_price),0) FROM 
                residence WHERE residence.supplier = :supplier_id AND residence.netCurID = curID)+ (SELECT 
                IFNULL(SUM(servicedetails.netPrice),0) FROM servicedetails WHERE servicedetails.Supplier_id = :supplier_id AND 
                servicedetails.netCurrencyID = curID ) +(SELECT IFNULL(SUM(visaextracharges.net_price),0) FROM visaextracharges 
                WHERE visaextracharges.supplierID = :supplier_id AND visaextracharges.netCurrencyID = curID) + (SELECT 
                IFNULL(SUM(car_rental.net_price),0) FROM car_rental WHERE car_rental.supplier_id = :supplier_id AND 
                car_rental.netCurrencyID = curID)) AS total 
                FROM (SELECT ticket.net_CurrencyID AS curID FROM ticket WHERE ticket.supp_id = :supplier_id 
                UNION SELECT visa.netCurrencyID AS curID FROM visa WHERE visa.supp_id = :supplier_id
                UNION SELECT residence.netCurID AS curID FROM residence WHERE residence.supplier = :supplier_id 
                UNION SELECT servicedetails.netCurrencyID AS curID FROM servicedetails WHERE servicedetails.Supplier_id = :supplier_id 
                UNION SELECT visaextracharges.netCurrencyID AS curID FROM visaextracharges WHERE visaextracharges.supplierID = :supplier_id 
                UNION SELECT datechange.netCurrencyID AS curID FROM datechange INNER JOIN ticket ON ticket.ticket = datechange.ticket_id 
                WHERE ticket.supp_id = :supplier_id 
                UNION SELECT hotel.netCurrencyID AS curID FROM hotel WHERE hotel.supplier_id = :supplier_id 
                UNION SELECT car_rental.netCurrencyID AS curID FROM car_rental WHERE car_rental.supplier_id = :supplier_id
                UNION SELECT payment.currencyID AS curID FROM payment WHERE payment.supp_id = :supplier_id) AS baseTable 
                HAVING total != 0 ORDER BY curName ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supplier_id', $supplier_id);
        $stmt->execute();
        $charges = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $charges
        ]);
    }
    
    // Search payments
    if ($action == 'searchPayments') {
        $from_date = isset($input['from_date']) ? trim($input['from_date']) : null;
        $to_date = isset($input['to_date']) ? trim($input['to_date']) : null;
        $supplier_id = isset($input['supplier_id']) ? intval($input['supplier_id']) : null;
        $date_search_enabled = isset($input['date_search_enabled']) ? (bool)$input['date_search_enabled'] : false;
        $search = isset($input['search']) ? trim($input['search']) : null;
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $per_page = isset($input['per_page']) ? max(1, min(100, intval($input['per_page']))) : 20;
        $offset = ($page - 1) * $per_page;
        
        // Build base query - Use LEFT JOIN to ensure we get all payments even if some relations are missing
        $baseSql = "FROM payment 
                    LEFT JOIN supplier ON supplier.supp_id = payment.supp_id 
                    LEFT JOIN staff ON staff.staff_id = payment.staff_id 
                    LEFT JOIN accounts ON accounts.account_ID = payment.accountID 
                    LEFT JOIN currency ON currency.currencyID = payment.currencyID";
        
        $whereConditions = [];
        $params = [];
        
        if ($date_search_enabled && !empty($from_date) && !empty($to_date)) {
            $whereConditions[] = "DATE(payment.time_creation) BETWEEN :from_date AND :to_date";
            $params[':from_date'] = $from_date;
            $params[':to_date'] = $to_date;
        }
        
        if (!empty($supplier_id)) {
            $whereConditions[] = "payment.supp_id = :supplier_id";
            $params[':supplier_id'] = $supplier_id;
        }
        
        if (!empty($search)) {
            $whereConditions[] = "(supplier.supp_name LIKE :search OR payment.payment_detail LIKE :search OR staff.staff_name LIKE :search OR payment.payment_amount LIKE :search OR accounts.account_Name LIKE :search OR currency.currencyName LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total " . $baseSql . " " . $whereClause;
        
        try {
            $countStmt = $pdo->prepare($countSql);
            foreach ($params as $key => $value) {
                $countStmt->bindValue($key, $value);
            }
            $countStmt->execute();
            $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
            $total = intval($totalResult['total']);
        } catch (Exception $e) {
            error_log('Supplier Payment Count Error: ' . $e->getMessage() . ' SQL: ' . $countSql);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Error counting payments: ' . $e->getMessage()
            ]);
        }
        
        // Get paginated results
        $sql = "SELECT payment.payment_id, payment.supp_id, supplier.supp_name, payment.payment_amount, 
                       payment.currencyID, currency.currencyName, payment.payment_detail,
                       payment.staff_id, staff.staff_name, payment.time_creation, payment.accountID, accounts.account_Name 
                " . $baseSql . " " . $whereClause . " 
                ORDER BY payment.payment_id DESC LIMIT :limit OFFSET :offset";
        
        try {
            $stmt = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Log for debugging
            error_log('Supplier Payments Query: Found ' . count($payments) . ' payments. Total: ' . $total);
            
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $payments,
                'pagination' => [
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => $total,
                    'total_pages' => ceil($total / $per_page)
                ]
            ]);
        } catch (Exception $e) {
            error_log('Supplier Payment Query Error: ' . $e->getMessage() . ' SQL: ' . $sql);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Error fetching payments: ' . $e->getMessage(),
                'data' => [],
                'pagination' => [
                    'page' => $page,
                    'per_page' => $per_page,
                    'total' => 0,
                    'total_pages' => 0
                ]
            ]);
        }
    }
    
    // Add payment
    if ($action == 'addPayment') {
        $supplier_id = isset($input['supplier_id']) ? intval($input['supplier_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        $payment_detail = isset($input['payment_detail']) ? trim($input['payment_detail']) : '';
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        
        if (!$supplier_id || !$payment_amount || !$currency_id || !$account_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'All required fields must be filled'
            ]);
        }
        
        // Get staff_id from user object - try multiple possible keys
        // Based on login.php, the JWT token contains 'staff_id' key
        $staff_id = null;
        if (isset($user['staff_id'])) {
            $staff_id = intval($user['staff_id']);
        } elseif (isset($user['user_id'])) {
            $staff_id = intval($user['user_id']);
        } elseif (isset($user['id'])) {
            $staff_id = intval($user['id']);
        }
        
        if (!$staff_id || $staff_id <= 0) {
            error_log('Supplier Payment Error: Unable to get staff_id from user object. User data: ' . json_encode($user));
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Unable to determine staff ID. Please ensure you are logged in.'
            ]);
        }
        
        $sql = "INSERT INTO payment (supp_id, payment_amount, currencyID, payment_detail, staff_id, accountID) 
                VALUES (:supplier_id, :payment_amount, :currency_id, :payment_detail, :staff_id, :account_id)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':supplier_id', $supplier_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':payment_detail', $payment_detail);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment added successfully'
        ]);
    }
    
    // Update payment
    if ($action == 'updatePayment') {
        $payment_id = isset($input['payment_id']) ? intval($input['payment_id']) : null;
        $supplier_id = isset($input['supplier_id']) ? intval($input['supplier_id']) : null;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : null;
        $currency_id = isset($input['currency_id']) ? intval($input['currency_id']) : null;
        $payment_detail = isset($input['payment_detail']) ? trim($input['payment_detail']) : '';
        $account_id = isset($input['account_id']) ? intval($input['account_id']) : null;
        
        if (!$payment_id || !$supplier_id || !$payment_amount || !$currency_id || !$account_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'All required fields must be filled'
            ]);
        }
        
        // Get staff_id from user object - try multiple possible keys
        // Based on login.php, the JWT token contains 'staff_id' key
        $staff_id = null;
        if (isset($user['staff_id'])) {
            $staff_id = intval($user['staff_id']);
        } elseif (isset($user['user_id'])) {
            $staff_id = intval($user['user_id']);
        } elseif (isset($user['id'])) {
            $staff_id = intval($user['id']);
        }
        
        if (!$staff_id || $staff_id <= 0) {
            error_log('Supplier Payment Update Error: Unable to get staff_id from user object. User data: ' . json_encode($user));
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Unable to determine staff ID. Please ensure you are logged in.'
            ]);
        }
        
        $sql = "UPDATE payment SET 
                supp_id = :supplier_id,
                payment_amount = :payment_amount,
                currencyID = :currency_id,
                payment_detail = :payment_detail,
                staff_id = :staff_id,
                accountID = :account_id
                WHERE payment_id = :payment_id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':payment_id', $payment_id);
        $stmt->bindParam(':supplier_id', $supplier_id);
        $stmt->bindParam(':payment_amount', $payment_amount);
        $stmt->bindParam(':currency_id', $currency_id);
        $stmt->bindParam(':payment_detail', $payment_detail);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->bindParam(':account_id', $account_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment updated successfully'
        ]);
    }
    
    // Get payment by ID
    if ($action == 'getPayment') {
        $payment_id = isset($input['payment_id']) ? intval($input['payment_id']) : null;
        
        if (!$payment_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM payment WHERE payment_id = :payment_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':payment_id', $payment_id);
        $stmt->execute();
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($payment) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $payment
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment not found'
            ]);
        }
    }
    
    // Delete payment
    if ($action == 'deletePayment') {
        $payment_id = isset($input['payment_id']) ? intval($input['payment_id']) : null;
        
        if (!$payment_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Payment ID is required'
            ]);
        }
        
        $sql = "DELETE FROM payment WHERE payment_id = :payment_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':payment_id', $payment_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Payment deleted successfully'
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

