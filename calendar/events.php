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
    // Check if calendar_events table exists
    $checkTable = $pdo->query("SHOW TABLES LIKE 'calendar_events'");
    if ($checkTable->rowCount() == 0) {
        // Table doesn't exist, return empty array
        JWTHelper::sendResponse(200, true, 'Success', ['events' => []]);
        exit;
    }
    
    // Get custom calendar events
    $sql = "SELECT 
                ce.id,
                ce.title,
                ce.description,
                ce.event_date,
                ce.event_time,
                ce.event_type,
                ce.priority,
                ce.color,
                ce.status,
                ce.all_day,
                s1.staff_name as created_by_name,
                s2.staff_name as assigned_to_name
            FROM calendar_events ce
            LEFT JOIN staff s1 ON ce.created_by = s1.staff_id
            LEFT JOIN staff s2 ON ce.assigned_to = s2.staff_id
            WHERE ce.status != 'cancelled'
            AND ce.event_date >= CURDATE() - INTERVAL 30 DAY
            ORDER BY ce.event_date ASC, ce.event_time ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format events for calendar
    $formattedEvents = [];
    foreach ($events as $event) {
        $formattedEvents[] = [
            'id' => $event['id'],
            'title' => $event['title'],
            'description' => $event['description'],
            'date' => $event['event_date'],
            'time' => $event['event_time'],
            'type' => 'custom',
            'subtype' => $event['event_type'],
            'priority' => $event['priority'],
            'color' => $event['color'],
            'status' => $event['status'],
            'all_day' => $event['all_day'],
            'created_by' => $event['created_by_name'],
            'assigned_to' => $event['assigned_to_name']
        ];
    }
    
    JWTHelper::sendResponse(200, true, 'Success', ['events' => $formattedEvents]);

} catch (PDOException $e) {
    error_log("Database Error in calendar/events.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in calendar/events.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

