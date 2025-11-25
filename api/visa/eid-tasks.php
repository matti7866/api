<?php
/**
 * Emirates ID Tasks API
 * Endpoint: /api/visa/eid-tasks.php
 * Returns filtered Emirates ID tasks based on step (pending, received, delivered)
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

$step = isset($_GET['step']) ? (string)$_GET['step'] : 'pending';
$dateAfter = '2024-09-01';

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Build WHERE clause based on step
    $where = '';
    
    if ($step == 'pending') {
        $where = " AND eid_received = 0 AND eid_delivered = 0 ";
    } elseif ($step == 'received') {
        $where = " AND eid_received = 1 AND eid_delivered = 0 ";
    } elseif ($step == 'delivered') {
        $where = " AND eid_delivered = 1 AND eid_received = 1 ";
    }

    // Get residences (Mainland)
    $sql = "
        SELECT 
            residenceID,
            passenger_name,
            passportNumber,
            EmiratesIDNumber,
            completedStep,
            customer.customer_name as customer_name,
            IFNULL((sale_price - (SELECT IFNULL(SUM(payment_amount),0) FROM customer_payments WHERE PaymentFor = residence.residenceID)),0) as remaining_balance,
            'ML' as `type`
        FROM residence 
        LEFT JOIN customer ON customer.customer_id = residence.customer_id
        WHERE completedStep >= 7 $where AND datetime >= :dateAfter
        
        UNION 
        
        SELECT 
            id as residenceID,
            passangerName as passenger_name,
            passportNumber,
            eidNumber as EmiratesIDNumber,
            completedSteps as completedStep,
            customer.customer_name as customer_name,
            0 as remaining_balance,
            'FZ' as `type`
        FROM freezone
        LEFT JOIN customer ON customer.customer_id = freezone.customerID
        WHERE completedSteps >= 5 $where AND created_at >= :dateAfter
        
        ORDER BY remaining_balance DESC, completedStep ASC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':dateAfter', $dateAfter);
    $stmt->execute();
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Calculate step counts
    $stepCounts = [
        'pending' => 0,
        'received' => 0,
        'delivered' => 0
    ];

    // Count pending
    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT residenceID FROM residence WHERE completedStep >= 7 AND eid_received = 0 AND eid_delivered = 0 AND datetime >= :dateAfter
            UNION
            SELECT id FROM freezone WHERE completedSteps >= 5 AND eid_received = 0 AND eid_delivered = 0 AND created_at >= :dateAfter
        ) AS total
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->bindParam(':dateAfter', $dateAfter);
    $countStmt->execute();
    $stepCounts['pending'] = (int)$countStmt->fetchColumn();

    // Count received
    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT residenceID FROM residence WHERE completedStep >= 7 AND eid_received = 1 AND eid_delivered = 0 AND datetime >= :dateAfter
            UNION
            SELECT id FROM freezone WHERE completedSteps >= 5 AND eid_received = 1 AND eid_delivered = 0 AND created_at >= :dateAfter
        ) AS total
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->bindParam(':dateAfter', $dateAfter);
    $countStmt->execute();
    $stepCounts['received'] = (int)$countStmt->fetchColumn();

    // Count delivered
    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT residenceID FROM residence WHERE completedStep >= 7 AND eid_delivered = 1 AND eid_received = 1 AND datetime >= :dateAfter
            UNION
            SELECT id FROM freezone WHERE completedSteps >= 5 AND eid_delivered = 1 AND eid_received = 1 AND created_at >= :dateAfter
        ) AS total
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->bindParam(':dateAfter', $dateAfter);
    $countStmt->execute();
    $stepCounts['delivered'] = (int)$countStmt->fetchColumn();

    // Calculate total remaining balance
    $totalRemainingBalance = array_sum(array_column($tasks, 'remaining_balance'));

    JWTHelper::sendResponse(200, true, 'Success', [
        'tasks' => $tasks,
        'stepCounts' => $stepCounts,
        'totalRemainingBalance' => $totalRemainingBalance
    ]);

} catch (Exception $e) {
    error_log("EID Tasks API Error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Failed to load tasks: ' . $e->getMessage());
}



