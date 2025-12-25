<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


require_once '../../connection.php';
require_once '../auth/JWTHelper.php';

// Handle preflight requests FIRST
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $allowedOrigins = ['http://localhost:5174', 'http://127.0.0.1:5174'];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(200);
    exit;
}

// CORS Headers for actual requests
$allowedOrigins = ['http://localhost:5174', 'http://127.0.0.1:5174'];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Content-Type: application/json');

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

try {
    // Get upcoming flights (next 365 days)
    $sql = "SELECT 
                t.ticket,
                t.ticketNumber,
                t.Pnr,
                t.passenger_name,
                af.name as from_place,
                at.name as to_place,
                t.date_of_travel,
                t.return_date,
                t.flight_type,
                c.customer_name
            FROM ticket t
            LEFT JOIN customer c ON t.customer_id = c.customer_id
            LEFT JOIN airports af ON t.from_id = af.airport_id
            LEFT JOIN airports at ON t.to_id = at.airport_id
            WHERE t.date_of_travel >= CURDATE()
            AND t.date_of_travel <= CURDATE() + INTERVAL 365 DAY
            ORDER BY t.date_of_travel ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $flights = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Success', ['flights' => $flights]);

} catch (PDOException $e) {
    error_log("Database Error in calendar/flights.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in calendar/flights.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

