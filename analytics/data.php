<?php
/**
 * Analytics API Controller
 * Provides all analytics endpoints for the dashboard
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
    exit;
}

// Get action from request
$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');

// $pdo is already available from connection.php

try {
    switch ($action) {
        case 'realTimeComparison':
            getRealTimeComparison($pdo);
            break;
        case 'salesData':
            getSalesData($pdo);
            break;
        case 'performance':
            getPerformance($pdo);
            break;
        case 'monthlyCounts':
            getMonthlyCounts($pdo);
            break;
        case 'weeklyCounts':
            getWeeklyCounts($pdo);
            break;
        default:
            JWTHelper::sendResponse(400, false, 'Invalid action');
    }
} catch (PDOException $e) {
    error_log("Database Error in analytics/data.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Database error: ' . $e->getMessage());
} catch (Exception $e) {
    error_log("Error in analytics/data.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

function getRealTimeComparison($pdo) {
    // Today's data (from midnight to now)
    $today = date('Y-m-d');
    $now = date('Y-m-d H:i:s');
    $currentHour = (int)date('H');
    
    // Past 7 days (excluding today)
    $pastDays = [];
    $pastDaysLabels = [];
    for ($i = 1; $i <= 7; $i++) {
        $pastDays[] = date('Y-m-d', strtotime("-{$i} day"));
        $pastDaysLabels[] = date('D', strtotime("-{$i} day"));
    }
    
    $types = [
        'ticket'    => 'ticket',
        'visa'      => 'visa',
        'residence' => 'residence',
    ];
    
    $todayCounts = [];
    $pastDailyCounts = [];
    $pastAverageCounts = [];
    $pastAverageUpToNowCounts = [];
    $hourlyBreakdown = [];
    $hourlyBreakdownPast = [];
    $dailyBreakdown = [];
    
    foreach ($types as $key => $table) {
        // Today's count
        $sql = "SELECT COUNT(*) FROM {$table} WHERE datetime BETWEEN :start AND :end";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':start' => $today . ' 00:00:00', ':end' => $now]);
        $todayCounts[$key] = (int) $stmt->fetchColumn();
        
        // Past days counts
        $pastDailyCounts[$key] = [];
        $totalPastCount = 0;
        $totalPastUpToNowCount = 0;
        
        foreach ($pastDays as $index => $pastDay) {
            // Full day count
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':start' => $pastDay . ' 00:00:00', ':end' => $pastDay . ' 23:59:59']);
            $count = (int) $stmt->fetchColumn();
            $pastDailyCounts[$key][$pastDaysLabels[$index]] = $count;
            $totalPastCount += $count;
            
            // Up to current time of day count (for fair comparison)
            $currentTimeOfDay = date('H:i:s');
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':start' => $pastDay . ' 00:00:00', ':end' => $pastDay . ' ' . $currentTimeOfDay]);
            $upToNowCount = (int) $stmt->fetchColumn();
            $totalPastUpToNowCount += $upToNowCount;
        }
        
        // Calculate averages
        $pastAverageCounts[$key] = round($totalPastCount / count($pastDays), 1);
        $pastAverageUpToNowCounts[$key] = round($totalPastUpToNowCount / count($pastDays), 1);
        
        // Store daily breakdown
        $dailyBreakdown[$key] = $pastDailyCounts[$key];
        
        // Hourly breakdown for today
        $sqlHourly = "SELECT HOUR(datetime) as hour, COUNT(*) as count 
                     FROM {$table} 
                     WHERE DATE(datetime) = :date
                     GROUP BY HOUR(datetime) 
                     ORDER BY HOUR(datetime)";
        $stmt = $pdo->prepare($sqlHourly);
        $stmt->execute([':date' => $today]);
        
        // Initialize hourly data with zeros
        $hourlyBreakdown[$key] = [];
        $hourlyBreakdownPast[$key] = [];
        for ($i = 0; $i < 24; $i++) {
            $hourLabel = sprintf("%02d:00", $i);
            $hourlyBreakdown[$key][$hourLabel] = 0;
            $hourlyBreakdownPast[$key][$hourLabel] = 0;
        }
        
        // Fill in actual values for today
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $hour = sprintf("%02d:00", (int)$row['hour']);
            $hourlyBreakdown[$key][$hour] = (int)$row['count'];
        }
        
        // Get average hourly data for past days
        foreach ($pastDays as $pastDay) {
            $stmt = $pdo->prepare($sqlHourly);
            $stmt->execute([':date' => $pastDay]);
            
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $hour = sprintf("%02d:00", (int)$row['hour']);
                $hourlyBreakdownPast[$key][$hour] += (int)$row['count'];
            }
        }
        
        // Calculate hourly averages
        foreach ($hourlyBreakdownPast[$key] as $hour => $total) {
            $hourlyBreakdownPast[$key][$hour] = round($total / count($pastDays), 1);
        }
    }
    
    // Calculate percentage changes
    $percentChanges = [];
    foreach ($types as $key => $table) {
        if ($pastAverageCounts[$key] > 0) {
            $percentChanges[$key] = round((($todayCounts[$key] - $pastAverageCounts[$key]) / $pastAverageCounts[$key]) * 100, 1);
        } else {
            $percentChanges[$key] = $todayCounts[$key] > 0 ? 100 : 0;
        }
    }
    
    JWTHelper::sendResponse(200, true, 'Success', [
        'today' => [
            'counts' => $todayCounts,
            'start' => $today . ' 00:00:00',
            'end' => $now
        ],
        'pastAverage' => [
            'counts' => $pastAverageCounts,
            'upToNowCounts' => $pastAverageUpToNowCounts,
            'dailyBreakdown' => $dailyBreakdown,
            'days' => $pastDaysLabels
        ],
        'percentChanges' => $percentChanges,
        'hourlyBreakdown' => $hourlyBreakdown,
        'hourlyBreakdownPast' => $hourlyBreakdownPast,
        'currentHour' => $currentHour
    ]);
}

function getSalesData($pdo) {
    // Last 30 days including today
    $days = 30;
    $endDate = date('Y-m-d');
    $startDate = date('Y-m-d', strtotime("-$days days +1 day"));
    
    // Build date index with zero defaults
    $dates = [];
    for ($i = 0; $i < $days; $i++) {
        $d = date('Y-m-d', strtotime($startDate . " +$i day"));
        $dates[$d] = [
            'ticket' => 0,
            'visa' => 0,
            'residence' => 0,
        ];
    }
    
    // Helper to populate results
    $populate = function ($sql, $fieldName) use (&$dates, $pdo, $startDate, $endDate) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':start' => $startDate, ':end' => $endDate]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $d = $row['date'];
            if (isset($dates[$d])) {
                $dates[$d][$fieldName] = (int) $row['total'];
            }
        }
    };
    
    // Ticket count per day
    $populate(
        'SELECT DATE(datetime) AS date, COUNT(*) AS total FROM ticket WHERE DATE(datetime) BETWEEN :start AND :end GROUP BY DATE(datetime)',
        'ticket'
    );
    
    // Visa count per day
    $populate(
        'SELECT DATE(datetime) AS date, COUNT(*) AS total FROM visa WHERE DATE(datetime) BETWEEN :start AND :end GROUP BY DATE(datetime)',
        'visa'
    );
    
    // Residence count per day
    $populate(
        'SELECT DATE(datetime) AS date, COUNT(*) AS total FROM residence WHERE DATE(datetime) BETWEEN :start AND :end GROUP BY DATE(datetime)',
        'residence'
    );
    
    // Prepare sequential array
    $out = [];
    foreach ($dates as $date => $values) {
        $out[] = array_merge(['date' => $date], $values);
    }
    
    JWTHelper::sendResponse(200, true, 'Success', ['data' => $out]);
}

function getPerformance($pdo) {
    $period = isset($_GET['period']) ? $_GET['period'] : (isset($_POST['period']) ? $_POST['period'] : 'month');
    
    // Determine date ranges
    if ($period === 'year') {
        $currentStart = date('Y-01-01');
        $currentEnd = date('Y-m-d');
        $previousStart = date('Y-01-01', strtotime('-1 year'));
        $previousEnd = date('Y-m-d', strtotime('-1 year'));
    } elseif ($period === 'ytd') {
        $currentStart = date('Y-m-01');
        $currentEnd = date('Y-m-d');
        $previousStart = date('Y-01-01');
        $previousEnd = $currentEnd;
    } else { // month
        $currentStart = date('Y-m-01');
        $currentEnd = date('Y-m-d');
        $previousStart = date('Y-m-01', strtotime('-1 month', strtotime($currentStart)));
        $previousEnd = date('Y-m-t', strtotime('-1 month'));
    }
    
    $types = [
        'ticket' => 'ticket',
        'visa' => 'visa',
        'residence' => 'residence',
    ];
    
    $currentCounts = [];
    $previousCounts = [];
    
    foreach ($types as $key => $table) {
        $sql = "SELECT COUNT(*) FROM {$table} WHERE DATE(datetime) BETWEEN :start AND :end";
        
        // Current period
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':start' => $currentStart, ':end' => $currentEnd]);
        $currentCounts[$key] = (int) $stmt->fetchColumn();
        
        // Previous period
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':start' => $previousStart, ':end' => $previousEnd]);
        $previousCounts[$key] = (int) $stmt->fetchColumn();
    }
    
    JWTHelper::sendResponse(200, true, 'Success', [
        'period' => $period,
        'current' => $currentCounts,
        'previous' => $previousCounts
    ]);
}

function getMonthlyCounts($pdo) {
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (isset($_POST['year']) ? (int)$_POST['year'] : (int)date('Y'));
    
    $data = [
        'ticket' => array_fill(1, 12, 0),
        'visa' => array_fill(1, 12, 0),
        'residence' => array_fill(1, 12, 0)
    ];
    
    $types = [
        'ticket' => 'ticket',
        'visa' => 'visa',
        'residence' => 'residence'
    ];
    
    foreach ($types as $key => $table) {
        $sql = "SELECT MONTH(datetime) AS m, COUNT(*) AS total FROM {$table} WHERE YEAR(datetime)=:year GROUP BY MONTH(datetime)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':year' => $year]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $data[$key][(int)$row['m']] = (int)$row['total'];
        }
    }
    
    JWTHelper::sendResponse(200, true, 'Success', [
        'year' => $year,
        'data' => $data
    ]);
}

function getWeeklyCounts($pdo) {
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (isset($_POST['year']) ? (int)$_POST['year'] : (int)date('Y'));
    $month = isset($_GET['month']) ? (int)$_GET['month'] : (isset($_POST['month']) ? (int)$_POST['month'] : null);
    
    $data = [
        'ticket' => [],
        'visa' => [],
        'residence' => []
    ];
    
    $types = [
        'ticket' => 'ticket',
        'visa' => 'visa',
        'residence' => 'residence'
    ];
    
    foreach ($types as $key => $table) {
        $sql = "SELECT WEEK(datetime, 3) AS wk, COUNT(*) AS total FROM {$table} WHERE YEAR(datetime)=:year";
        $params = [':year' => $year];
        if ($month) {
            $sql .= " AND MONTH(datetime)=:month";
            $params[':month'] = $month;
        }
        $sql .= " GROUP BY wk";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $wk = (int)$row['wk'];
            if ($wk == 0) $wk = 53;
            $data[$key][$wk] = (int)$row['total'];
        }
    }
    
    JWTHelper::sendResponse(200, true, 'Success', [
        'year' => $year,
        'month' => $month,
        'data' => $data
    ]);
}
?>

