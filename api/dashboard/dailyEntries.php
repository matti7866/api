<?php
/**
 * Get Daily Entries Report
 * Endpoint: /api/dashboard/dailyEntries.php
 */

// Include CORS headers - this handles all CORS logic including OPTIONS requests
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check if user is Admin
try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$sql = "SELECT role_name FROM `roles` WHERE role_id = :role_id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $role = $stmt->fetch(PDO::FETCH_ASSOC);
    $role_name = $role['role_name'];
    
    if ($role_name != 'Admin') {
        JWTHelper::sendResponse(403, false, 'Only admins can view daily entries report');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Role check failed: ' . $e->getMessage());
}

// Get request parameters
$request = $_SERVER['REQUEST_METHOD'] === 'POST' 
    ? json_decode(file_get_contents('php://input'), true) 
    : $_GET;

if (!$request) {
    $request = [];
}

$fromDate = isset($request['fromDate']) ? $request['fromDate'] : date('Y-m-d');
$toDate = isset($request['toDate']) ? $request['toDate'] : date('Y-m-d');

try {
    $selectQuery = $pdo->prepare("SELECT 'Ticket Entry' AS EntryType, customer_name, passenger_name,
        CONCAT(CONCAT(CONCAT(CONCAT('Travel From: ', airports.airport_code),' To '),to_airport.airport_code),' Airport') AS 
        Details, datetime, staff_name FROM ticket INNER JOIN customer ON customer.customer_id = ticket.customer_id INNER JOIN 
        airports ON airports.airport_id = ticket.from_id INNER JOIN airports AS to_airport ON to_airport.airport_id = ticket.to_id
        INNER JOIN staff ON staff.staff_id = ticket.staff_id WHERE DATE(datetime) BETWEEN :from_date AND :to_date
        UNION ALL
        SELECT 'Visa Entry' AS EntryType, customer_name, passenger_name, country_names AS Details, datetime, staff_name FROM visa 
        INNER JOIN country_name ON country_name.country_id = visa.country_id INNER JOIN customer ON customer.customer_id = 
        visa.customer_id INNER JOIN staff ON staff.staff_id = visa.staff_id WHERE DATE(datetime) BETWEEN :from_date AND :to_date
        UNION ALL
        SELECT 'Visa Fine Entry' AS EntryType, customer_name, passenger_name, country_names AS Details, visaextracharges.datetime,
        staff_name FROM visaextracharges INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id INNER JOIN country_name ON 
        country_name.country_id = visa.country_id INNER JOIN staff ON staff.staff_id = visaextracharges.uploadedBy INNER JOIN 
        customer ON customer.customer_id = visa.customer_id WHERE DATE(visaextracharges.datetime) BETWEEN :from_date AND 
        :to_date AND visaextracharges.typeID = 1
        UNION ALL
        SELECT 'Residence Entry Basic Information Section' AS EntryType, customer_name, passenger_name, country_names AS Details, residence.datetime,
        staff_name FROM residence INNER JOIN customer ON customer.customer_id = residence.customer_id INNER JOIN country_name ON
        country_name.country_id = residence.VisaType INNER JOIN staff ON staff.staff_id = residence.StepOneUploader WHERE 
        DATE(residence.datetime) BETWEEN :from_date AND :to_date AND residence.StepOneUploader IS NOT NULL
        UNION ALL
        SELECT 'Hotel Reservation Entry' AS EntryType, customer_name, '' AS passenger_name, CONCAT('Hotel Name: 
        ',hotel.hotel_name) AS Details,datetime, staff_name FROM hotel INNER JOIN customer ON customer.customer_id = 
        hotel.customer_id INNER JOIN staff ON staff.staff_id = hotel.staffID WHERE DATE(datetime)  BETWEEN :from_date AND 
        :to_date
        UNION ALL
        SELECT 'Rental Car Reservation Entry' AS EntryType, customer_name, '' AS passenger_name, CONCAT('Car Description: 
        ',car_rental.car_description) AS Details,datetime, staff_name FROM car_rental INNER JOIN customer ON customer.customer_id
        = car_rental.customer_id INNER JOIN staff ON staff.staff_id = car_rental.staffID WHERE DATE(datetime)  BETWEEN :from_date
        AND :to_date
        UNION ALL
        SELECT 'Customer Payment Entry' AS EntryType, customer_name, '' AS passenger_name, CONCAT('Amount & Remarks: 
        ',CONCAT(CONCAT(CONCAT(CONCAT(customer_payments.payment_amount,' '), currencyName)),', '),IFNULL(customer_payments.remarks
        ,'No Remarks')) AS Details, datetime, staff_name FROM customer_payments INNER JOIN customer ON customer.customer_id = 
        customer_payments.customer_id INNER JOIN currency ON currency.currencyID = customer_payments.currencyID INNER JOIN staff 
        ON staff.staff_id = customer_payments.staff_id WHERE DATE(datetime)  BETWEEN :from_date AND :to_date
        UNION ALL
        SELECT 'Expense Entry' AS EntryType, expense_type AS customer_name, '' AS passenger_name, CONCAT('Amount & Remarks: 
        ',CONCAT(CONCAT(CONCAT(CONCAT(expense.expense_amount,' '), currencyName)),', '),IFNULL(expense.expense_remark,
        'No Remarks')) AS Details, time_creation AS datetime, staff_name FROM expense INNER JOIN expense_type ON 
        expense_type.expense_type_id = expense.expense_type_id INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
        INNER JOIN staff ON staff.staff_id = expense.staff_id WHERE DATE(time_creation)  BETWEEN :from_date AND :to_date
        UNION ALL
        SELECT 'Supplier Payment Entry' AS EntryType, supplier.supp_name AS customer_name, '' AS passenger_name, 
        CONCAT('Amount & Remarks: ',CONCAT(CONCAT(CONCAT(CONCAT(payment.payment_amount,' '), currencyName)),', '),
        IFNULL(payment.payment_detail,'No Details')) AS Details,time_creation AS datetime, staff_name FROM payment INNER JOIN 
        supplier ON supplier.supp_id = payment.supp_id INNER JOIN currency ON currency.currencyID = payment.currencyID INNER JOIN
        staff ON staff.staff_id = payment.staff_id WHERE DATE(time_creation)  BETWEEN :from_date AND :to_date
        ORDER BY datetime DESC");
    
    $selectQuery->bindParam(':from_date', $fromDate);
    $selectQuery->bindParam(':to_date', $toDate);
    $selectQuery->execute();
    
    $entries = $selectQuery->fetchAll(PDO::FETCH_ASSOC);
    
    // Ensure we return an array, not an object
    if (empty($entries)) {
        $entries = [];
    }
    
    // Wrap in data key to ensure proper array serialization
    JWTHelper::sendResponse(200, true, 'Success', ['data' => $entries]);

} catch (PDOException $e) {
    error_log("Database Error in dashboard/dailyEntries.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in dashboard/dailyEntries.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

