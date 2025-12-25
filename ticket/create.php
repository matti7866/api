<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $requiredFields = ['pnr', 'customer_id', 'passengers', 'date_of_travel', 'from_id', 'to_id', 'supp_id', 'flight_type'];
    $missingFields = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($input[$field])) {
            $missingFields[] = $field;
        }
    }
    
    if (!empty($missingFields)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Missing required fields: ' . implode(', ', $missingFields)
        ], 400);
    }
    
    // Get staff branch
    $branchStmt = $pdo->prepare("SELECT staff_branchID FROM staff WHERE staff_id = :staff_id");
    $branchStmt->execute([':staff_id' => $user['staff_id']]);
    $branchData = $branchStmt->fetch(PDO::FETCH_ASSOC);
    $branchID = $branchData['staff_branchID'] ?? 1;
    
    // Begin transaction
    $pdo->beginTransaction();
    
    $ticketIds = [];
    
    // Convert empty strings to null for date/time fields
    $input['return_date'] = !empty($input['return_date']) ? $input['return_date'] : null;
    $input['departure_time'] = !empty($input['departure_time']) ? $input['departure_time'] : null;
    $input['arrival_time'] = !empty($input['arrival_time']) ? $input['arrival_time'] : null;
    $input['return_departure_time'] = !empty($input['return_departure_time']) ? $input['return_departure_time'] : null;
    $input['return_arrival_time'] = !empty($input['return_arrival_time']) ? $input['return_arrival_time'] : null;
    $input['return_flight_number'] = !empty($input['return_flight_number']) ? $input['return_flight_number'] : null;
    
    // Insert ticket for each passenger
    foreach ($input['passengers'] as $passenger) {
        $sql = "INSERT INTO ticket (
            ticketNumber, Pnr, customer_id, passenger_name, 
            date_of_travel, return_date, from_id, to_id, 
            sale, currencyID, staff_id, supp_id, 
            net_price, net_CurrencyID, branchID, remarks,
            flight_number, return_flight_number, 
            departure_time, arrival_time,
            return_departure_time, return_arrival_time, 
            flight_type
        ) VALUES (
            :ticketNumber, :pnr, :customer_id, :passenger_name,
            :date_of_travel, :return_date, :from_id, :to_id,
            :sale, :currencyID, :staff_id, :supp_id,
            :net_price, :net_CurrencyID, :branchID, :remarks,
            :flight_number, :return_flight_number,
            :departure_time, :arrival_time,
            :return_departure_time, :return_arrival_time,
            :flight_type
        )";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':ticketNumber' => $passenger['ticketNumber'] ?? '',
            ':pnr' => $input['pnr'],
            ':customer_id' => $input['customer_id'],
            ':passenger_name' => $passenger['passenger_name'],
            ':date_of_travel' => $input['date_of_travel'],
            ':return_date' => $input['return_date'],
            ':from_id' => $input['from_id'],
            ':to_id' => $input['to_id'],
            ':sale' => $passenger['sale'],
            ':currencyID' => $passenger['currencyID'],
            ':staff_id' => $user['staff_id'],
            ':supp_id' => $input['supp_id'],
            ':net_price' => $passenger['net_price'],
            ':net_CurrencyID' => $passenger['net_CurrencyID'],
            ':branchID' => $branchID,
            ':remarks' => $input['remarks'] ?? '',
            ':flight_number' => $input['flight_number'] ?? '',
            ':return_flight_number' => $input['return_flight_number'],
            ':departure_time' => $input['departure_time'],
            ':arrival_time' => $input['arrival_time'],
            ':return_departure_time' => $input['return_departure_time'],
            ':return_arrival_time' => $input['return_arrival_time'],
            ':flight_type' => $input['flight_type']
        ]);
        
        $ticketIds[] = $pdo->lastInsertId();
    }
    
    // Handle customer payment if provided
    if (isset($input['customer_payment']) && $input['customer_payment'] > 0) {
        $paymentSql = "INSERT INTO customer_payments (
            customer_id, payment_amount, currencyID, staff_id, accountID
        ) VALUES (
            :customer_id, :payment_amount, :currencyID, :staff_id, :accountID
        )";
        
        $paymentStmt = $pdo->prepare($paymentSql);
        $paymentStmt->execute([
            ':customer_id' => $input['customer_id'],
            ':payment_amount' => $input['customer_payment'],
            ':currencyID' => $input['payment_currency_type'],
            ':staff_id' => $user['staff_id'],
            ':accountID' => $input['account_id']
        ]);
    }
    
    // Commit transaction
    $pdo->commit();
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Tickets created successfully',
        'data' => [
            'ticket_ids' => $ticketIds
        ]
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Database Error in ticket/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Failed to create ticket'
    ], 500);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error in ticket/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}

