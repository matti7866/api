<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

try {
    
    $step = isset($_GET['step']) ? $_GET['step'] : '1';
    $queryStep = str_replace('a', '', $step);
    
    // Get step counts
    $stepCounts = [];
    
    // Count for step 1 (pending eVisa)
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM residence WHERE res_type = 'Freezone' AND completedStep = 1 AND (evisaStatus = 'pending' OR evisaStatus IS NULL)");
    $stmt->execute();
    $stepCounts['1'] = (int)$stmt->fetchColumn();
    
    // Count for step 1a (submitted eVisa - waiting for approval)
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM residence WHERE res_type = 'Freezone' AND completedStep = 1 AND evisaStatus = 'submitted'");
    $stmt->execute();
    $stepCounts['1a'] = (int)$stmt->fetchColumn();
    
    // Count for other steps
    $stmt = $pdo->prepare("SELECT completedStep as step, COUNT(*) as total FROM residence WHERE res_type = 'Freezone' AND completedStep > 1 GROUP BY completedStep");
    $stmt->execute();
    $otherCounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($otherCounts as $count) {
        $stepKey = (string)$count['step'];
        if ($stepKey == '2') {
            $stepCounts['2'] = (int)$count['total'];
        } elseif ($stepKey == '3') {
            $stepCounts['3'] = (int)$count['total'];
        } elseif ($stepKey == '4') {
            $stepCounts['4'] = (int)$count['total'];
        } elseif ($stepKey == '5') {
            $stepCounts['5'] = (int)$count['total'];
        } elseif ($stepKey == '6') {
            $stepCounts['6'] = (int)$count['total'];
        }
    }
    
    // Build WHERE clause
    $where = '';
    if ($step == '1') {
        $where .= " AND (residence.evisaStatus = 'pending' OR residence.evisaStatus IS NULL)";
    } elseif ($step == '1a') {
        $where .= " AND residence.evisaStatus = 'submitted'";
    }
    
    // Get residences
    $stmt = $pdo->prepare("
        SELECT 
            residence.*,
            customer.customer_name,
            position.posiiton_name,
            airports.countryCode,
            airports.countryName,
            company.company_name,
            company.company_number
        FROM residence 
        LEFT JOIN customer ON customer.customer_id = residence.customer_id
        LEFT JOIN position ON position.position_id = residence.positionID
        LEFT JOIN airports ON airports.airport_id = residence.Nationality
        LEFT JOIN company ON company.company_id = residence.company
        WHERE residence.res_type = 'Freezone' AND residence.completedStep = :completedSteps {$where}
        ORDER BY residence.datetime DESC
    ");
    $stmt->bindParam(':completedSteps', $queryStep);
    $stmt->execute();
    $residences = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format residences - use residenceID as primary key
    $formattedResidences = [];
    foreach ($residences as $residence) {
        $residenceId = (int)($residence['residenceID'] ?? $residence['id'] ?? 0);
        $formattedResidences[] = [
            'id' => $residenceId,
            'residenceID' => $residenceId,
            'datetime' => $residence['datetime'] ?? date('Y-m-d H:i:s'),
            'passenger_name' => $residence['passenger_name'] ?? $residence['passangerName'] ?? '',
            'customer_name' => $residence['customer_name'] ?? '',
            'company_name' => $residence['company_name'] ?? '',
            'company_number' => $residence['company_number'] ?? '',
            'passportNumber' => $residence['passportNumber'] ?? '',
            'passportExpiryDate' => $residence['passportExpiryDate'] ?? '',
            'countryName' => $residence['countryName'] ?? '',
            'countryCode' => $residence['countryCode'] ?? '',
            'uid' => $residence['uid'] ?? $residence['UID'] ?? '',
            'positionID' => (int)($residence['positionID'] ?? 0),
            'position_name' => $residence['posiiton_name'] ?? '',
            'evisaStatus' => $residence['evisaStatus'] ?? 'pending',
            'insideOutside' => $residence['insideOutside'] ?? '',
            'salePrice' => (float)($residence['salePrice'] ?? 0),
            'saleCurrency' => (int)($residence['saleCurrency'] ?? 0),
            'completedSteps' => (int)($residence['completedStep'] ?? 1),
        ];
    }
    
    JWTHelper::sendResponse(200, true, 'Freezone tasks loaded successfully', [
        'residences' => $formattedResidences,
        'stepCounts' => $stepCounts
    ]);
    
} catch (Exception $e) {
    error_log("Error in freezone/tasks.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Failed to load freezone tasks: ' . $e->getMessage());
}

