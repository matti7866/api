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

// Verify JWT token first
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get dashboard statistics
    if ($action == 'getDashboardStats') {
        $stats = [];
        
        // Total Expense Types
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM expense_type");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['totalExpenseTypes'] = $result['count'] ?? 0;
        
        // Total Expenses Count
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM expense");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['totalExpenses'] = $result['count'] ?? 0;
        
        // This Month Expenses Count
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM expense WHERE MONTH(time_creation) = MONTH(CURRENT_DATE()) AND YEAR(time_creation) = YEAR(CURRENT_DATE())");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['thisMonthExpenses'] = $result['count'] ?? 0;
        
        // Pending Documents (expenses without documents)
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM expense WHERE expense_document IS NULL OR expense_document = ''");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['pendingDocuments'] = $result['count'] ?? 0;
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $stats
        ]);
    }
    
    // Get chart data
    if ($action == 'getChartData') {
        $chartData = [
            'labels' => [],
            'values' => []
        ];
        
        // Get expense data for the last 7 days
        $stmt = $pdo->prepare("
            SELECT 
                DATE(time_creation) as expense_date,
                COUNT(*) as expense_count
            FROM expense 
            WHERE time_creation >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            GROUP BY DATE(time_creation)
            ORDER BY expense_date ASC
        ");
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fill in missing dates with 0 values
        $dates = [];
        $values = [];
        
        for ($i = 6; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime("-$i days"));
            $dates[] = date('M j', strtotime($date));
            $values[] = 0;
            
            // Check if we have data for this date
            foreach ($results as $result) {
                if ($result['expense_date'] === $date) {
                    $values[count($values) - 1] = (int)$result['expense_count'];
                    break;
                }
            }
        }
        
        $chartData['labels'] = $dates;
        $chartData['values'] = $values;
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $chartData
        ]);
    }
    
    // Get recent activities
    if ($action == 'getRecentActivities') {
        $stmt = $pdo->prepare("
            SELECT 
                e.expense_id,
                e.expense_amount,
                e.time_creation,
                et.expense_type,
                s.staff_name,
                c.currencyName
            FROM expense e
            INNER JOIN expense_type et ON et.expense_type_id = e.expense_type_id
            INNER JOIN staff s ON s.staff_id = e.staff_id
            INNER JOIN currency c ON c.currencyID = e.CurrencyID
            ORDER BY e.time_creation DESC
            LIMIT 10
        ");
        $stmt->execute();
        $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $formattedActivities = [];
        foreach ($activities as $activity) {
            $formattedActivities[] = [
                'id' => $activity['expense_id'],
                'amount' => number_format($activity['expense_amount'], 2),
                'currency' => $activity['currencyName'],
                'type' => $activity['expense_type'],
                'staff' => $activity['staff_name'],
                'time' => date('M j, H:i', strtotime($activity['time_creation']))
            ];
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $formattedActivities
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

