<?php
/**
 * Residence Tasks API
 * Endpoint: /api/residence/tasks.php
 * Returns filtered residence list based on step, company, and search
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
$dateAfter = '2024-09-01';

try {
    // Build WHERE clause based on step
    $where = '';
    $params = [];
    
    if ($step == '1a') {
        $where = " AND completedStep = 2 AND offerLetterStatus = 'submitted' ";
    } elseif ($step == '4a') {
        $where = " AND completedStep = 5 AND (eVisaStatus = 'submitted' OR eVisaStatus = 'rejected') ";
    } elseif ($step == '2') {
        $where = " AND completedStep = 2 AND offerLetterStatus = 'accepted'";
    } elseif ($step == '5') {
        $where = " AND completedStep = 5 AND eVisaStatus = 'accepted' ";
    } else {
        $where = " AND completedStep = :step ";
        $params[':step'] = (int)$step;
    }

    if ($company_id > 0) {
        $where .= " AND company = :company_id ";
        $params[':company_id'] = $company_id;
    }

    if ($search != '') {
        $where .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
    }

    // Get residences
    $sql = "
        SELECT 
            residence.*,
            residence.insideOutside,
            customer.customer_name,
            airports.countryName,
            airports.countryCode,
            company.company_name,
            company.company_number,
            company.username,
            company.password,
            country_name.country_names as visaType,
            residence.mohreStatus,
            residence.mohreStatusDatetime,
            residence.mb_number,
            residence.uid,
            residence.LabourCardNumber,
            residence.hold,
            residence.document_verify,
            residence.document_verify_datetime,
            residence.document_verify_message,
            residence.remarks,
            (SELECT IFNULL(SUM(payment_amount),0) FROM customer_payments WHERE PaymentFor = residence.residenceID) as paid_amount
        FROM residence 
        LEFT JOIN customer ON customer.customer_id = residence.customer_id
        LEFT JOIN airports ON airports.airport_id = residence.Nationality
        LEFT JOIN company ON company.company_id = residence.company
        LEFT JOIN country_name ON country_name.country_id = residence.VisaType
        WHERE DATE(residence.datetime) >= :dateAfter {$where} 
        AND residence.current_status = 'Active' 
        AND residence.res_type = 'mainland'
        GROUP BY residence.residenceID
        ORDER BY residence.residenceID ASC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':dateAfter', $dateAfter);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    if (!$stmt->execute()) {
        $errorInfo = $stmt->errorInfo();
        throw new Exception('SQL Error: ' . $errorInfo[2]);
    }
    
    $residences = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate step counts
    $stepCounts = [
        '1' => 0,
        '1a' => 0,
        '2' => 0,
        '3' => 0,
        '4' => 0,
        '4a' => 0,
        '5' => 0,
        '6' => 0,
        '7' => 0,
        '8' => 0,
        '9' => 0,
        '10' => 0
    ];
    
    // Count by completedStep
    $countSql = "
        SELECT COUNT(*) as count, completedStep
        FROM residence 
        WHERE DATE(datetime) >= :dateAfter 
        AND current_status = 'Active' 
        AND res_type = 'mainland'
    ";
    
    $countParams = [':dateAfter' => $dateAfter];
    if ($search != '') {
        $countSql .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $countParams[':search1'] = '%' . $search . '%';
        $countParams[':search2'] = '%' . $search . '%';
    }
    
    $countSql .= " GROUP BY completedStep";
    
    $countStmt = $pdo->prepare($countSql);
    foreach ($countParams as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $counts = $countStmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($counts as $row) {
        $stepKey = (string)$row['completedStep'];
        if (isset($stepCounts[$stepKey])) {
            $stepCounts[$stepKey] = (int)$row['count'];
        }
    }
    
    // Count offer letter submitted (step 1a)
    $sql1a = "
        SELECT IFNULL(COUNT(*),0) as total 
        FROM residence 
        WHERE DATE(datetime) >= :dateAfter 
        AND completedStep = 2 
        AND offerLetterStatus = 'submitted' 
        AND current_status = 'Active' 
        AND res_type = 'mainland'
    ";
    $params1a = [':dateAfter' => $dateAfter];
    if ($search != '') {
        $sql1a .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $params1a[':search1'] = '%' . $search . '%';
        $params1a[':search2'] = '%' . $search . '%';
    }
    $stmt1a = $pdo->prepare($sql1a);
    foreach ($params1a as $key => $value) {
        $stmt1a->bindValue($key, $value);
    }
    $stmt1a->execute();
    $stepCounts['1a'] = (int)$stmt1a->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Count insurance (step 2) - offer letter accepted
    $sql2 = "
        SELECT IFNULL(COUNT(*),0) as total 
        FROM residence 
        WHERE DATE(datetime) >= :dateAfter 
        AND completedStep = 2 
        AND offerLetterStatus = 'accepted' 
        AND current_status = 'Active' 
        AND res_type = 'mainland'
    ";
    $params2 = [':dateAfter' => $dateAfter];
    if ($search != '') {
        $sql2 .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $params2[':search1'] = '%' . $search . '%';
        $params2[':search2'] = '%' . $search . '%';
    }
    $stmt2 = $pdo->prepare($sql2);
    foreach ($params2 as $key => $value) {
        $stmt2->bindValue($key, $value);
    }
    $stmt2->execute();
    $stepCounts['2'] = (int)$stmt2->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Count eVisa submitted (step 4a)
    $sql4a = "
        SELECT IFNULL(COUNT(*),0) as total 
        FROM residence 
        WHERE DATE(datetime) >= :dateAfter 
        AND completedStep = 5 
        AND eVisaStatus = 'submitted' 
        AND current_status = 'Active' 
        AND res_type = 'mainland'
    ";
    $params4a = [':dateAfter' => $dateAfter];
    if ($search != '') {
        $sql4a .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $params4a[':search1'] = '%' . $search . '%';
        $params4a[':search2'] = '%' . $search . '%';
    }
    $stmt4a = $pdo->prepare($sql4a);
    foreach ($params4a as $key => $value) {
        $stmt4a->bindValue($key, $value);
    }
    $stmt4a->execute();
    $stepCounts['4a'] = (int)$stmt4a->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Count change status (step 5) - eVisa accepted
    $sql5 = "
        SELECT IFNULL(COUNT(*),0) as total 
        FROM residence 
        WHERE DATE(datetime) >= :dateAfter 
        AND completedStep = 5 
        AND eVisaStatus = 'accepted' 
        AND current_status = 'Active' 
        AND res_type = 'mainland'
    ";
    $params5 = [':dateAfter' => $dateAfter];
    if ($search != '') {
        $sql5 .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2) ";
        $params5[':search1'] = '%' . $search . '%';
        $params5[':search2'] = '%' . $search . '%';
    }
    $stmt5 = $pdo->prepare($sql5);
    foreach ($params5 as $key => $value) {
        $stmt5->bindValue($key, $value);
    }
    $stmt5->execute();
    $stepCounts['5'] = (int)$stmt5->fetch(PDO::FETCH_ASSOC)['total'];

    JWTHelper::sendResponse(200, true, 'Tasks loaded successfully', [
        'residences' => $residences,
        'stepCounts' => $stepCounts
    ]);
} catch (Exception $e) {
    error_log('Tasks API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    error_log('File: ' . $e->getFile() . ' Line: ' . $e->getLine());
    
    // Return error details
    $errorMessage = 'Error loading tasks: ' . $e->getMessage();
    
    JWTHelper::sendResponse(500, false, $errorMessage);
}

