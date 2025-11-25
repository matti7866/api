<?php
/**
 * Get Today's Dashboard Statistics
 * Endpoint: /api/dashboard/todayStats.php
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
    $sql = "SELECT role_name FROM `roles` WHERE role_id = :role_id";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $role = $stmt->fetch(PDO::FETCH_ASSOC);
    $role_name = $role['role_name'];
    
    if ($role_name != 'Admin') {
        JWTHelper::sendResponse(403, false, 'Only admins can view dashboard statistics');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Role check failed: ' . $e->getMessage());
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get today's statistics
    $selectQuery = $pdo->prepare("SELECT 
        (SELECT COUNT(ticket.ticket) FROM ticket WHERE DATE(ticket.datetime) = CURRENT_DATE) AS Todays_Ticket,
        (SELECT IFNULL(SUM(ticket.Sale),0) - IFNULL(SUM(ticket.net_price),0) FROM ticket WHERE DATE(ticket.datetime) = CURRENT_DATE) AS ticket_profit,
        (SELECT COUNT(visa_id) FROM visa WHERE DATE(visa.datetime) = CURRENT_DATE) + 
        (SELECT COUNT(residenceID) FROM residence WHERE DATE(residence.datetime) = CURRENT_DATE) AS Todays_Visa,
        (SELECT IFNULL(SUM(sale),0) - IFNULL(SUM(net_price),0) FROM visa WHERE DATE(visa.datetime) = CURRENT_DATE) + 
        (SELECT IFNULL(SUM(sale_price),0) FROM residence WHERE DATE(residence.datetime) = CURRENT_DATE) AS Visa_Profit,
        (SELECT IFNULL(SUM(expense_amount),0) FROM expense WHERE DATE(expense.time_creation) = CURRENT_DATE) AS Total_Expense");
    
    $selectQuery->execute();
    $stats = $selectQuery->fetch(PDO::FETCH_ASSOC);
    
    // Ensure we have data
    if (!$stats) {
        $stats = [
            'Todays_Ticket' => 0,
            'ticket_profit' => 0,
            'Todays_Visa' => 0,
            'Visa_Profit' => 0,
            'Total_Expense' => 0
        ];
    }
    
    // Convert string numbers to proper numbers
    foreach ($stats as $key => $value) {
        $stats[$key] = is_numeric($value) ? floatval($value) : 0;
    }
    
    JWTHelper::sendResponse(200, true, 'Success', $stats);

} catch (PDOException $e) {
    error_log("Database Error in dashboard/todayStats.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in dashboard/todayStats.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

