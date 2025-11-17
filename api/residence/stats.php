<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Residence Statistics
 * Endpoint: /api/residence/stats.php
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Get date filters if provided
$request = json_decode(file_get_contents('php://input'), true);
$dateFrom = isset($request['dateFrom']) ? $request['dateFrom'] : null;
$dateTo = isset($request['dateTo']) ? $request['dateTo'] : null;

try {
    $dateFilter = "";
    $params = [];
    
    if ($dateFrom) {
        $dateFilter .= " AND DATE(r.datetime) >= :dateFrom";
        $params[':dateFrom'] = $dateFrom;
    }
    
    if ($dateTo) {
        $dateFilter .= " AND DATE(r.datetime) <= :dateTo";
        $params[':dateTo'] = $dateTo;
    }
    
    // Total counts
    $sql = "SELECT 
                COUNT(*) as total_count,
                SUM(CASE WHEN completedStep < 10 AND cancelled = 0 THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN completedStep = 10 THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN cancelled = 1 THEN 1 ELSE 0 END) as cancelled_count,
                SUM(CASE WHEN hold = 1 THEN 1 ELSE 0 END) as held_count,
                SUM(sale_price) as total_sale_value,
                SUM(COALESCE(offerLetterCost, 0) + COALESCE(insuranceCost, 0) + COALESCE(laborCardFee, 0) + 
                    COALESCE(eVisaCost, 0) + COALESCE(changeStatusCost, 0) + COALESCE(medicalTCost, 0) + 
                    COALESCE(emiratesIDCost, 0) + COALESCE(visaStampingCost, 0)) as total_cost_value
            FROM residence r
            WHERE (r.deleted = 0 OR r.deleted IS NULL) $dateFilter";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $totals = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Calculate profit
    $totals['total_profit'] = $totals['total_sale_value'] - $totals['total_cost_value'];
    
    // By step
    $sql = "SELECT 
                completedStep as step,
                COUNT(*) as count
            FROM residence r
            WHERE (r.deleted = 0 OR r.deleted IS NULL) 
                AND r.cancelled = 0 
                $dateFilter
            GROUP BY completedStep
            ORDER BY completedStep";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $byStep = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // By nationality (top 10)
    $sql = "SELECT 
                a.countryName as nationality,
                COUNT(*) as count
            FROM residence r
            LEFT JOIN airports a ON r.Nationality = a.airport_id
            WHERE (r.deleted = 0 OR r.deleted IS NULL) $dateFilter
            GROUP BY r.Nationality, a.countryName
            ORDER BY count DESC
            LIMIT 10";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $byNationality = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // By visa type
    $sql = "SELECT 
                v.visa_name as visa_type,
                COUNT(*) as count
            FROM residence r
            LEFT JOIN visa v ON r.VisaType = v.visa_id
            WHERE (r.deleted = 0 OR r.deleted IS NULL) $dateFilter
            GROUP BY r.VisaType, v.visa_name
            ORDER BY count DESC";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $byVisaType = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Monthly trend (last 12 months)
    $sql = "SELECT 
                DATE_FORMAT(r.datetime, '%Y-%m') as month,
                COUNT(*) as count,
                SUM(r.sale_price) as total_sales
            FROM residence r
            WHERE (r.deleted = 0 OR r.deleted IS NULL)
                AND r.datetime >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                $dateFilter
            GROUP BY DATE_FORMAT(r.datetime, '%Y-%m')
            ORDER BY month DESC";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $monthlyTrend = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stats = array_merge($totals, [
        'by_step' => $byStep,
        'by_nationality' => $byNationality,
        'by_visa_type' => $byVisaType,
        'monthly_trend' => $monthlyTrend
    ]);
    
    JWTHelper::sendResponse(200, true, 'Success', $stats);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

