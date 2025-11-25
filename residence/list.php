<?php
    /**
 * Get Residence List with Filters and Pagination
 * Endpoint: /api/residence/list.php
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

// Check permission for Residence module
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request parameters (support both GET and POST)
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
$customer_id = isset($request['customer_id']) ? (int)$request['customer_id'] : null;
$company = isset($request['company']) ? (int)$request['company'] : null;
$status = isset($request['status']) ? (int)$request['status'] : null;
$dateFrom = isset($request['dateFrom']) ? $request['dateFrom'] : null;
$dateTo = isset($request['dateTo']) ? $request['dateTo'] : null;
$completedStep = isset($request['completedStep']) ? (int)$request['completedStep'] : null;
$cancelled = isset($request['cancelled']) ? (bool)$request['cancelled'] : null;
$nationality = isset($request['nationality']) ? (int)$request['nationality'] : null;
$visaType = isset($request['visaType']) ? (int)$request['visaType'] : null;
$deleted = isset($request['deleted']) ? (bool)$request['deleted'] : false;
$hold = isset($request['hold']) ? (bool)$request['hold'] : null;
$insideOutside = isset($request['insideOutside']) ? strtolower($request['insideOutside']) : null;

try {
    // Build the query
    $sql = "SELECT 
                r.*,
                c.customer_name,
                c.customer_phone,
                c.customer_email,
                a.countryName as nationality_name,
                s.serviceName as visa_type_name,
                curr.currencyName as sale_currency_name,
                comp.company_name,
                pos.posiiton_name as position_name,
                IFNULL(rch.tawjeeh_included_in_sale, 0) AS tawjeehIncluded,
                IFNULL(rch.insurance_included_in_sale, 0) AS insuranceIncluded,
                IFNULL(rch.tawjeeh_amount, 150) AS tawjeeh_amount,
                IFNULL(rch.insurance_amount, 126) AS insuranceAmount,
                IFNULL(rch.insurance_fine, 0) AS iloe_fine,
                COALESCE((SELECT SUM(payment_amount) FROM customer_payments WHERE PaymentFor = r.residenceID), 0) AS total_paid,
                COALESCE((SELECT SUM(fineAmount) FROM residencefine WHERE residencefine.residenceID = r.residenceID), 0) AS total_Fine,
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
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if ($deleted !== null) {
        $sql .= " AND (r.deleted = :deleted OR r.deleted IS NULL)";
        $params[':deleted'] = $deleted ? 1 : 0;
    } else {
        $sql .= " AND (r.deleted = 0 OR r.deleted IS NULL)";
    }
    
    if ($search) {
        $sql .= " AND (
            r.passenger_name LIKE :search 
            OR c.customer_name LIKE :search 
            OR r.passportNumber LIKE :search
            OR r.uid LIKE :search
            OR comp.company_name LIKE :search
            OR r.EmiratesIDNumber LIKE :search
        )";
        $params[':search'] = '%' . $search . '%';
    }
    
    if ($customer_id) {
        $sql .= " AND r.customer_id = :customer_id";
        $params[':customer_id'] = $customer_id;
    }
    
    if ($company) {
        $sql .= " AND r.company = :company";
        $params[':company'] = $company;
    }
    
    if ($status !== null) {
        $sql .= " AND r.status = :status";
        $params[':status'] = $status;
    }
    
    if ($dateFrom) {
        $sql .= " AND DATE(r.datetime) >= :dateFrom";
        $params[':dateFrom'] = $dateFrom;
    }
    
    if ($dateTo) {
        $sql .= " AND DATE(r.datetime) <= :dateTo";
        $params[':dateTo'] = $dateTo;
    }
    
    if ($completedStep !== null) {
        $sql .= " AND r.completedStep = :completedStep";
        $params[':completedStep'] = $completedStep;
    }
    
    if ($cancelled !== null) {
        $sql .= " AND r.cancelled = :cancelled";
        $params[':cancelled'] = $cancelled ? 1 : 0;
    }
    
    if ($nationality) {
        $sql .= " AND r.Nationality = :nationality";
        $params[':nationality'] = $nationality;
    }
    
    if ($visaType) {
        $sql .= " AND r.VisaType = :visaType";
        $params[':visaType'] = $visaType;
    }
    
    if ($hold !== null) {
        $sql .= " AND r.hold = :hold";
        $params[':hold'] = $hold ? 1 : 0;
    }
    
    if ($insideOutside) {
        $sql .= " AND LOWER(r.insideOutside) = :insideOutside";
        $params[':insideOutside'] = $insideOutside;
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
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

