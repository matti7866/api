<?php
/**
 * Get Agent's Customer Residences
 * Endpoint: /api/agent/residences.php
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$agentData = JWTHelper::verifyRequest();

if (!$agentData || !isset($agentData['type']) || $agentData['type'] !== 'agent') {
    JWTHelper::sendResponse(401, false, 'Unauthorized - Agent access only');
}

// Get request parameters
$request = $_SERVER['REQUEST_METHOD'] === 'POST' 
    ? json_decode(file_get_contents('php://input'), true) 
    : $_GET;

if (!$request) {
    $request = [];
}

$page = isset($request['page']) ? (int)$request['page'] : 1;
$limit = isset($request['limit']) ? (int)$request['limit'] : 50;
$offset = ($page - 1) * $limit;
$search = isset($request['search']) ? $request['search'] : '';
$completedStep = isset($request['completedStep']) ? (int)$request['completedStep'] : null;

try {
    // Get agent's customer_id
    $customer_id = $agentData['customer_id'];
    
    // Build the query - only show residences for agent's customer
    $sql = "SELECT 
                r.*,
                c.customer_name,
                c.customer_phone,
                c.customer_email,
                a.countryName as nationality_name,
                a.countryCode,
                s.serviceName as visa_type_name,
                curr.currencyName as sale_currency_name,
                comp.company_name,
                comp.company_number,
                pos.posiiton_name as position_name,
                IFNULL(rch.tawjeeh_included_in_sale, 0) AS tawjeehIncluded,
                IFNULL(rch.insurance_included_in_sale, 0) AS insuranceIncluded,
                IFNULL(rch.tawjeeh_amount, 150) AS tawjeeh_amount,
                IFNULL(rch.insurance_amount, 126) AS insuranceAmount,
                COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE PaymentFor = r.residenceID), 0) AS total_paid,
                COALESCE((SELECT SUM(fineAmount) FROM residencefine WHERE residencefine.residenceID = r.residenceID), 0) AS total_fine,
                COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE residenceFinePayment IN (SELECT residenceFineID FROM residencefine WHERE residencefine.residenceID = r.residenceID)), 0) AS totalFinePaid,
                COALESCE((SELECT IFNULL(SUM(sale_price), 0) FROM residence_custom_charges WHERE residence_id = r.residenceID), 0) AS custom_charges_total,
                CASE 
                    WHEN r.completedStep = 10 THEN 'Completed'
                    WHEN r.cancelled = 1 THEN 'Cancelled'
                    WHEN r.hold = 1 THEN 'On Hold'
                    ELSE CONCAT('Step ', r.completedStep)
                END as status_name
            FROM residence r
            LEFT JOIN customer c ON r.customer_id = c.customer_id
            LEFT JOIN airports a ON r.Nationality = a.airport_id
            LEFT JOIN service s ON r.VisaType = s.serviceID
            LEFT JOIN currency curr ON r.saleCurID = curr.currencyID
            LEFT JOIN company comp ON r.company = comp.company_id
            LEFT JOIN position pos ON r.positionID = pos.position_id
            LEFT JOIN residence_charges rch ON r.residenceID = rch.residence_id
            WHERE r.customer_id = :customer_id
            AND (r.deleted = 0 OR r.deleted IS NULL)";
    
    $params = [':customer_id' => $customer_id];
    
    // Apply search filter
    if ($search) {
        $sql .= " AND (
            r.passenger_name LIKE :search 
            OR r.passportNumber LIKE :search
            OR r.uid LIKE :search
            OR comp.company_name LIKE :search
            OR r.EmiratesIDNumber LIKE :search
        )";
        $params[':search'] = '%' . $search . '%';
    }
    
    // Apply completedStep filter
    if ($completedStep !== null) {
        // Handle special cases for 1a (step 2 with offer letter submitted) and 4a (step 5 with evisa submitted)
        if ($completedStep == 2) {
            // Step 1a: Offer Letter Submitted
            $sql .= " AND r.completedStep = 2 AND r.offerLetterStatus = 'submitted'";
        } elseif ($completedStep == 5) {
            // Could be step 4 or 4a, need to check which one is requested
            // For now, just show all step 5
            $sql .= " AND r.completedStep = 5";
        } else {
            $sql .= " AND r.completedStep = :completedStep";
            $params[':completedStep'] = $completedStep;
        }
    }
    
    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM (" . $sql . ") as count_query";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
    $total = $totalResult['total'];
    
    // Add pagination
    $sql .= " ORDER BY r.datetime DESC LIMIT :limit OFFSET :offset";
    $params[':limit'] = $limit;
    $params[':offset'] = $offset;
    
    // Execute query
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        if ($key === ':limit' || $key === ':offset') {
            $stmt->bindValue($key, $value, PDO::PARAM_INT);
        } else {
            $stmt->bindValue($key, $value);
        }
    }
    $stmt->execute();
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Success', [
        'data' => $data,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($total / $limit)
    ]);
    
} catch (Exception $e) {
    error_log("Agent residences error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error fetching residences: ' . $e->getMessage());
}
?>

