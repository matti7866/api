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

try {
    // Get filter parameters
    $startDate = isset($_GET['startDate']) ? $_GET['startDate'] : null;
    $endDate = isset($_GET['endDate']) ? $_GET['endDate'] : null;
    $customerId = isset($_GET['customerId']) ? intval($_GET['customerId']) : null;
    $supplierId = isset($_GET['supplierId']) ? intval($_GET['supplierId']) : null;
    $pnr = isset($_GET['pnr']) ? $_GET['pnr'] : null;
    $passengerName = isset($_GET['passengerName']) ? $_GET['passengerName'] : null;
    $ticketNumber = isset($_GET['ticketNumber']) ? $_GET['ticketNumber'] : null;
    $flightType = isset($_GET['flightType']) ? $_GET['flightType'] : null;
    $fromAirport = isset($_GET['fromAirport']) ? intval($_GET['fromAirport']) : null;
    $toAirport = isset($_GET['toAirport']) ? intval($_GET['toAirport']) : null;
    
    // Build query
    $sql = "SELECT 
                t.ticket,
                t.ticketNumber,
                t.Pnr,
                t.customer_id,
                t.passenger_name,
                DATE_FORMAT(t.date_of_travel, '%Y-%m-%d') as date_of_travel,
                DATE_FORMAT(t.return_date, '%Y-%m-%d') as return_date,
                t.from_id,
                t.to_id,
                t.sale,
                t.currencyID,
                t.staff_id,
                t.supp_id,
                t.net_price,
                t.net_CurrencyID,
                t.ticketCopy,
                t.remarks,
                t.flight_number,
                t.return_flight_number,
                t.departure_time,
                t.arrival_time,
                t.return_departure_time,
                t.return_arrival_time,
                t.flight_type,
                t.status,
                t.datetime,
                c.customer_name,
                c.customer_phone,
                f.airport_code as from_code,
                to_airport.airport_code as to_code,
                curr.currencyName as currency_name,
                net_curr.currencyName as net_currency_name,
                s.supp_name as supplier_name,
                st.staff_name
            FROM ticket t
            INNER JOIN customer c ON c.customer_id = t.customer_id
            INNER JOIN airports f ON f.airport_id = t.from_id
            INNER JOIN airports to_airport ON to_airport.airport_id = t.to_id
            INNER JOIN currency curr ON curr.currencyID = t.currencyID
            INNER JOIN currency net_curr ON net_curr.currencyID = t.net_CurrencyID
            INNER JOIN supplier s ON s.supp_id = t.supp_id
            LEFT JOIN staff st ON st.staff_id = t.staff_id
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if ($startDate) {
        $sql .= " AND DATE(t.date_of_travel) >= :startDate";
        $params[':startDate'] = $startDate;
    }
    
    if ($endDate) {
        $sql .= " AND DATE(t.date_of_travel) <= :endDate";
        $params[':endDate'] = $endDate;
    }
    
    if ($customerId) {
        $sql .= " AND t.customer_id = :customerId";
        $params[':customerId'] = $customerId;
    }
    
    if ($supplierId) {
        $sql .= " AND t.supp_id = :supplierId";
        $params[':supplierId'] = $supplierId;
    }
    
    if ($pnr) {
        $sql .= " AND t.Pnr LIKE :pnr";
        $params[':pnr'] = "%$pnr%";
    }
    
    if ($passengerName) {
        $sql .= " AND t.passenger_name LIKE :passengerName";
        $params[':passengerName'] = "%$passengerName%";
    }
    
    if ($ticketNumber) {
        $sql .= " AND t.ticketNumber LIKE :ticketNumber";
        $params[':ticketNumber'] = "%$ticketNumber%";
    }
    
    if ($flightType) {
        $sql .= " AND t.Flight_type = :flightType";
        $params[':flightType'] = $flightType;
    }
    
    if ($fromAirport) {
        $sql .= " AND t.from_id = :fromAirport";
        $params[':fromAirport'] = $fromAirport;
    }
    
    if ($toAirport) {
        $sql .= " AND t.to_id = :toAirport";
        $params[':toAirport'] = $toAirport;
    }
    
    $sql .= " ORDER BY t.datetime DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $tickets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => $tickets
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in ticket/list.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Failed to fetch tickets'
    ], 500);
} catch (Exception $e) {
    error_log("Error in ticket/list.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error'
    ], 500);
}

