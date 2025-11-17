<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['ticket_id'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket ID is required'
        ], 400);
    }
    
    // Build update query dynamically based on provided fields
    $updateFields = [];
    $params = [':ticket_id' => $input['ticket_id']];
    
    // Allowed fields to update
    $allowedFields = [
        'ticketNumber', 'Pnr', 'customer_id', 'passenger_name',
        'date_of_travel', 'return_date', 'from_id', 'to_id',
        'sale', 'currencyID', 'supp_id', 'net_price', 'net_CurrencyID',
        'remarks', 'flight_number', 'return_flight_number',
        'departure_time', 'arrival_time', 'return_departure_time',
        'return_arrival_time', 'flight_type'
    ];
    
    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            // Convert empty strings to null for date/time fields
            $value = $input[$field];
            if (in_array($field, ['return_date', 'return_flight_number', 'departure_time', 'arrival_time', 'return_departure_time', 'return_arrival_time']) && $value === '') {
                $value = null;
            }
            
            $updateFields[] = "$field = :$field";
            $params[":$field"] = $value;
        }
    }
    
    if (empty($updateFields)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'No fields to update'
        ], 400);
    }
    
    $sql = "UPDATE ticket SET " . implode(', ', $updateFields) . " WHERE ticket = :ticket_id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    if ($stmt->rowCount() > 0) {
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Ticket updated successfully'
        ]);
    } else {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket not found or no changes made'
        ], 404);
    }
    
} catch (PDOException $e) {
    error_log("Database Error in ticket/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in ticket/update.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}

