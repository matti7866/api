<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Residence Fines
 * Endpoint: /api/residence/get-fines.php
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

// Get residenceID from query parameter
$residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : null;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Missing required parameter: residenceID');
}

try {
    // Get all fines for this residence
    $sql = "SELECT 
                rf.residenceFineID,
                rf.residenceID,
                DATE_FORMAT(DATE(rf.datetime), '%d-%b-%Y') AS residenceFineDate,
                rf.fineAmount,
                rf.fineCurrencyID AS currencyID,
                rf.accountID,
                curr.currencyName,
                acc.account_Name,
                s.staff_name,
                rf.docName,
                rf.originalName
            FROM residencefine rf
            INNER JOIN currency curr ON curr.currencyID = rf.fineCurrencyID
            INNER JOIN accounts acc ON acc.account_ID = rf.accountID
            INNER JOIN staff s ON s.staff_id = rf.imposedBy
            WHERE rf.residenceID = :residenceID
            ORDER BY rf.datetime DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    $fines = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate total fine amount
    $totalFineQuery = $pdo->prepare("SELECT IFNULL(SUM(fineAmount), 0) AS total_fine FROM residencefine WHERE residenceID = :residenceID");
    $totalFineQuery->bindParam(':residenceID', $residenceID);
    $totalFineQuery->execute();
    $totalFineData = $totalFineQuery->fetch(PDO::FETCH_ASSOC);
    $totalFine = floatval($totalFineData['total_fine']);
    
    // Calculate total fine payments
    $finePaidQuery = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) AS fine_paid 
                                    FROM customer_payments 
                                    WHERE residenceFinePayment IN (
                                        SELECT residenceFineID FROM residencefine WHERE residenceID = :residenceID
                                    )");
    $finePaidQuery->bindParam(':residenceID', $residenceID);
    $finePaidQuery->execute();
    $finePaidData = $finePaidQuery->fetch(PDO::FETCH_ASSOC);
    $totalFinePaid = floatval($finePaidData['fine_paid']);
    
    // Calculate outstanding balance
    $outstandingBalance = max(0, $totalFine - $totalFinePaid);
    
    JWTHelper::sendResponse(200, true, 'Fines retrieved successfully', [
        'fines' => $fines,
        'totalFine' => $totalFine,
        'totalFinePaid' => $totalFinePaid,
        'outstandingBalance' => $outstandingBalance
    ]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error retrieving fines: ' . $e->getMessage());
}

