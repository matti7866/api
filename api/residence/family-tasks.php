<?php
/**
 * Family Residence Tasks API
 * Endpoint: /api/residence/family-tasks.php
 * Returns filtered family residence list based on step, company, and search
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

// Check permission
try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
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

$step = isset($_GET['step']) ? (string)$_GET['step'] : '1';
$company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';
$main_residence_id = isset($_GET['main_residence_id']) ? (int)$_GET['main_residence_id'] : 0;

try {
    // Build WHERE clause based on step
    // For family residence, steps are: 1=E-Visa, 2=Change Status, 3=Medical, 4=Emirates ID, 5=Visa Stamping, 6=Completed
    $where = '';
    $params = [];
    
    // Handle 'all' step - show all family residences regardless of status
    if ($step == 'all') {
        // No status filter for 'all' - show all records
        $statusCondition = "1=1";
        // No step filter for 'all'
    } else {
        // For step 6 (Completed), show 'completed' status records, for others show 'active' or NULL status
        if ($step == '6') {
            $statusCondition = "fr.status = 'completed'";
        } else {
            // Check if status column exists, if not, just show all
            $statusCondition = "(fr.status = 'active' OR fr.status IS NULL OR fr.status = '')";
        }
        
        $where = " AND fr.completed_step = :step ";
        $params[':step'] = (int)$step;
    }

    if ($company_id > 0) {
        // Filter by company - check both through residence and directly through customer
        $where .= " AND (
            r.company = :company_id 
            OR EXISTS (
                SELECT 1 FROM residence res 
                WHERE res.customer_id = fr.customer_id 
                AND res.company = :company_id 
                LIMIT 1
            )
        ) ";
        $params[':company_id'] = $company_id;
    }

    if ($search != '') {
        $where .= " AND (fr.passenger_name LIKE :search1 OR fr.passport_number LIKE :search2) ";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
    }

    // Filter by main residence ID if provided
    if ($main_residence_id > 0) {
        $where .= " AND fr.residence_id = :main_residence_id ";
        $params[':main_residence_id'] = $main_residence_id;
    }

    // Get family residences from family_residence table
    $sql = "
        SELECT 
            fr.*,
            fr.id as familyResidenceID,
            fr.id as residenceID,
            fr.residence_id as main_residence_id,
            fr.inside_outside as insideOutside,
            r.residenceID as main_residence_residenceID,
            r.passenger_name as main_passenger,
            r.passportNumber as main_passport,
            c.customer_name,
            a.countryName as nationality_name,
            a.countryName,
            a.countryCode,
            comp.company_name,
            comp.company_number,
            comp.username,
            comp.password,
            fr.passport_number as passportNumber,
            fr.sale_price,
            fr.sale_currency,
            fr.remarks,
            (SELECT IFNULL(SUM(payment_amount),0) FROM customer_payments 
             WHERE PaymentFor = fr.id 
             AND family_res_payment = 1) as paid_amount
        FROM family_residence fr
        LEFT JOIN residence r ON r.residenceID = fr.residence_id
        LEFT JOIN customer c ON c.customer_id = fr.customer_id
        LEFT JOIN residence r2 ON r2.customer_id = fr.customer_id AND r2.residenceID = (
            SELECT residenceID FROM residence WHERE customer_id = fr.customer_id ORDER BY residenceID DESC LIMIT 1
        )
        LEFT JOIN company comp ON comp.company_id = COALESCE(r.company, r2.company)
        LEFT JOIN airports a ON a.airport_id = fr.nationality
        WHERE 1=1 AND {$statusCondition} {$where}
        ORDER BY fr.id DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    if (!$stmt->execute()) {
        $errorInfo = $stmt->errorInfo();
        throw new Exception('SQL Error: ' . $errorInfo[2]);
    }
    
    $families = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate step counts
    $stepCounts = [
        '1' => 0,
        '2' => 0,
        '3' => 0,
        '4' => 0,
        '5' => 0,
        '6' => 0
    ];
    
    // Count by completed_step
    // For step 6 (Completed), count 'completed' status, for others count 'active' status
    foreach ($stepCounts as $stepKey => $value) {
        $statusForCount = ($stepKey == '6') ? "'completed'" : "'active'";
        $countSql = "
            SELECT COUNT(*) as cnt 
            FROM family_residence 
            WHERE completed_step = :step 
            AND status = {$statusForCount}
        ";
        
        $countParams = [':step' => (int)$stepKey];
        if ($search != '') {
            $countSql .= " AND (passenger_name LIKE :search1 OR passport_number LIKE :search2) ";
            $countParams[':search1'] = '%' . $search . '%';
            $countParams[':search2'] = '%' . $search . '%';
        }
        
        $countStmt = $pdo->prepare($countSql);
        foreach ($countParams as $key => $val) {
            $countStmt->bindValue($key, $val);
        }
        $countStmt->execute();
        $result = $countStmt->fetch(PDO::FETCH_ASSOC);
        $stepCounts[$stepKey] = (int)($result['cnt'] ?? 0);
    }

    JWTHelper::sendResponse(200, true, 'Family tasks loaded successfully', [
        'families' => $families,
        'stepCounts' => $stepCounts
    ]);
} catch (Exception $e) {
    error_log('Family Tasks API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    error_log('File: ' . $e->getFile() . ' Line: ' . $e->getLine());
    
    $errorMessage = 'Error loading family tasks: ' . $e->getMessage();
    
    JWTHelper::sendResponse(500, false, $errorMessage);
}

