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
    // Get upcoming cheques (next 365 days)
    $sql = "SELECT 
                c.id,
                c.number,
                c.type,
                c.payee,
                c.amount,
                c.date,
                c.cheque_status as status,
                c.bank
            FROM cheques c
            WHERE c.date >= CURDATE() 
            AND c.date <= CURDATE() + INTERVAL 365 DAY 
            AND c.cheque_status != 'cancelled'
            ORDER BY c.date ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $cheques = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Success', ['cheques' => $cheques]);

} catch (PDOException $e) {
    error_log("Database Error in calendar/cheques.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in calendar/cheques.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

