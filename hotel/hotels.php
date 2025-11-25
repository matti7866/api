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

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Handle JSON body for POST requests
    if ($method === 'POST' && empty($_POST)) {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if ($data) {
            $_POST = array_merge($_POST, $data);
        }
    }
    
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    // Database connection already available as $pdo from connection.php
    
    function filterInput($name) {
        return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : (isset($_GET[$name]) ? $_GET[$name] : ''))));
    }
    
    // Search hotels
    if ($action == 'searchHotels') {
        $customer = filterInput('customer');
        $start_date = filterInput('start_date');
        $end_date = filterInput('end_date');
        $search_by_date = filterInput('search_by_date');
        
        // Build WHERE clause
        $where = [];
        $params = [];
        
        if (!empty($customer)) {
            $where[] = "hotel.customer_id = :customer_id";
            $params[':customer_id'] = $customer;
        }
        
        if ($search_by_date == '1' && !empty($start_date) && !empty($end_date)) {
            $where[] = "DATE(hotel.datetime) BETWEEN :start_date AND :end_date";
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        }
        
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        $sql = "
        SELECT 
            hotel.hotel_id,
            customer.customer_name,
            hotel.passenger_name,
            supplier.supp_name,
            accounts.account_Name AS account_name,
            hotel.hotel_name,
            hotel.checkin_date,
            hotel.checkout_date,
            hotel.net_price,
            netCur.currencyName AS netCurrency,
            netCur.currencyID AS netCurrencyID,
            hotel.sale_price,
            saleCur.currencyName AS saleCurrency,
            saleCur.currencyID AS saleCurrencyID,
            country_name.country_names,
            country_name.country_id,
            hotel.datetime,
            staff.staff_name,
            hotel.customer_id,
            hotel.supplier_id,
            hotel.account_id
        FROM `hotel` 
        INNER JOIN customer ON customer.customer_id = hotel.customer_id
        LEFT JOIN supplier ON supplier.supp_id = hotel.supplier_id
        LEFT JOIN accounts ON accounts.account_ID = hotel.account_id
        INNER JOIN country_name ON country_name.country_id = hotel.country_id
        INNER JOIN staff ON staff.staff_id = hotel.staffID
        INNER JOIN currency AS netCur ON netCur.currencyID = hotel.netCurrencyID
        INNER JOIN currency AS saleCur ON saleCur.currencyID = hotel.saleCurrencyID
        $whereClause
        ORDER BY hotel.hotel_id DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $hotels = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $hotels
        ]);
    }
    
    // Get single hotel
    if ($action == 'getHotel') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Hotel ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM `hotel` WHERE `hotel_id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $hotel = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($hotel) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $hotel
            ]);
        } else {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Hotel not found'
            ]);
        }
    }
    
    // Add hotel
    if ($action == 'addHotel') {
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $hotel_name = filterInput('hotel_name');
        $supplier_id = filterInput('supplier_id');
        $checkin_date = filterInput('checkin_date');
        $checkout_date = filterInput('checkout_date');
        $net_price = filterInput('net_price');
        $net_currency_id = filterInput('net_currency_id');
        $sale_price = filterInput('sale_price');
        $sale_currency_id = filterInput('sale_currency_id');
        $country_id = filterInput('country_id');
        $cus_payment = filterInput('cus_payment');
        $cus_payment_currency = filterInput('cus_payment_currency');
        $account_id = filterInput('account_id');
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger name is required';
        if (empty($hotel_name)) $errors['hotel_name'] = 'Hotel name is required';
        if (empty($checkin_date)) $errors['checkin_date'] = 'Check-in date is required';
        if (empty($checkout_date)) $errors['checkout_date'] = 'Check-out date is required';
        if (empty($net_price)) $errors['net_price'] = 'Net price is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale price is required';
        if (empty($country_id)) $errors['country_id'] = 'Country is required';
        
        // Supplier is optional now - can be NULL for direct account payments
        
        // If customer payment is provided, account is required
        if (!empty($cus_payment) && $cus_payment > 0 && empty($account_id)) {
            $errors['account_id'] = 'Account is required when customer payment is provided';
        }
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        $pdo->beginTransaction();
        
        try {
            // Insert hotel
            $sql = "INSERT INTO `hotel` (
                `customer_id`, `passenger_name`, `supplier_id`, `hotel_name`, 
                `checkin_date`, `checkout_date`, `net_price`, `netCurrencyID`, 
                `sale_price`, `saleCurrencyID`, `country_id`, `staffID`, `account_id`
            ) VALUES (
                :customer_id, :passenger_name, :supplier_id, :hotel_name, 
                :checkin_date, :checkout_date, :net_price, :net_currency_id, 
                :sale_price, :sale_currency_id, :country_id, :staff_id, :account_id
            )";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':customer_id', $customer_id);
            $stmt->bindParam(':passenger_name', $passenger_name);
            $stmt->bindValue(':supplier_id', !empty($supplier_id) ? $supplier_id : null, PDO::PARAM_INT);
            $stmt->bindParam(':hotel_name', $hotel_name);
            $stmt->bindParam(':checkin_date', $checkin_date);
            $stmt->bindParam(':checkout_date', $checkout_date);
            $stmt->bindParam(':net_price', $net_price);
            $stmt->bindParam(':net_currency_id', $net_currency_id);
            $stmt->bindParam(':sale_price', $sale_price);
            $stmt->bindParam(':sale_currency_id', $sale_currency_id);
            $stmt->bindParam(':country_id', $country_id);
            $stmt->bindParam(':staff_id', $staff_id);
            $stmt->bindValue(':account_id', !empty($account_id) ? $account_id : null, PDO::PARAM_INT);
            $stmt->execute();
            
            // Insert customer payment if provided
            if (!empty($cus_payment) && $cus_payment > 0) {
                $sql = "INSERT INTO `customer_payments` (
                    `customer_id`, `payment_amount`, `currencyID`, `staff_id`, `accountID`
                ) VALUES (
                    :customer_id, :payment_amount, :currency_id, :staff_id, :account_id
                )";
                
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':customer_id', $customer_id);
                $stmt->bindParam(':payment_amount', $cus_payment);
                $stmt->bindParam(':currency_id', $cus_payment_currency);
                $stmt->bindParam(':staff_id', $staff_id);
                $stmt->bindParam(':account_id', $account_id);
                $stmt->execute();
            }
            
            $pdo->commit();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Hotel booking added successfully'
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    
    // Update hotel
    if ($action == 'updateHotel') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Hotel ID is required'
            ]);
        }
        
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $hotel_name = filterInput('hotel_name');
        $supplier_id = filterInput('supplier_id');
        $checkin_date = filterInput('checkin_date');
        $checkout_date = filterInput('checkout_date');
        $net_price = filterInput('net_price');
        $net_currency_id = filterInput('net_currency_id');
        $sale_price = filterInput('sale_price');
        $sale_currency_id = filterInput('sale_currency_id');
        $country_id = filterInput('country_id');
        
        $errors = [];
        
        if (empty($customer_id)) $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger name is required';
        if (empty($hotel_name)) $errors['hotel_name'] = 'Hotel name is required';
        
        // Supplier is optional - can be NULL if it's a direct account payment
        if (empty($supplier_id)) {
            error_log("Hotel update: No supplier provided, setting to NULL");
        }
        
        if (empty($checkin_date)) $errors['checkin_date'] = 'Check-in date is required';
        if (empty($checkout_date)) $errors['checkout_date'] = 'Check-out date is required';
        if (empty($net_price)) $errors['net_price'] = 'Net price is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale price is required';
        if (empty($country_id)) $errors['country_id'] = 'Country is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        $account_id = filterInput('account_id');
        
        $sql = "UPDATE `hotel` SET 
                `customer_id` = :customer_id,
                `passenger_name` = :passenger_name,
                `supplier_id` = :supplier_id,
                `hotel_name` = :hotel_name,
                `checkin_date` = :checkin_date,
                `checkout_date` = :checkout_date,
                `net_price` = :net_price,
                `netCurrencyID` = :net_currency_id,
                `sale_price` = :sale_price,
                `saleCurrencyID` = :sale_currency_id,
                `country_id` = :country_id,
                `staffID` = :staff_id,
                `account_id` = :account_id
                WHERE `hotel_id` = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':passenger_name', $passenger_name);
        $stmt->bindValue(':supplier_id', !empty($supplier_id) ? $supplier_id : null, PDO::PARAM_INT);
        $stmt->bindParam(':hotel_name', $hotel_name);
        $stmt->bindParam(':checkin_date', $checkin_date);
        $stmt->bindParam(':checkout_date', $checkout_date);
        $stmt->bindParam(':net_price', $net_price);
        $stmt->bindParam(':net_currency_id', $net_currency_id);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->bindParam(':sale_currency_id', $sale_currency_id);
        $stmt->bindParam(':country_id', $country_id);
        $stmt->bindParam(':staff_id', $staff_id);
        $stmt->bindValue(':account_id', !empty($account_id) ? $account_id : null, PDO::PARAM_INT);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Hotel booking updated successfully'
        ]);
    }
    
    // Delete hotel
    if ($action == 'deleteHotel') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Hotel ID is required'
            ]);
        }
        
        $sql = "DELETE FROM `hotel` WHERE `hotel_id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Hotel booking deleted successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Hotels API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

