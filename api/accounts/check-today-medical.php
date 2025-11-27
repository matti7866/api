<?php
/**
 * CHECK TODAY'S MEDICAL ENTRIES
 * Shows medical entries created today
 */

require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    $today = date('Y-m-d');
    
    // Check all medical entries from today
    $stmt = $pdo->prepare("SELECT 
                            residenceID,
                            passenger_name,
                            medicalTCost,
                            medicalAccount,
                            medicalSupplier,
                            medicalDate,
                            DATE(medicalDate) as date_only,
                            TIME(medicalDate) as time_only,
                            TIMESTAMPDIFF(MINUTE, medicalDate, NOW()) as minutes_ago,
                            CASE 
                                WHEN medicalAccount IS NOT NULL THEN CONCAT('Account: ', medicalAccount)
                                WHEN medicalSupplier IS NOT NULL THEN CONCAT('Supplier: ', medicalSupplier)
                                ELSE 'NO CHARGE ENTITY ⚠️'
                            END as charged_to,
                            CASE
                                WHEN medicalDate IS NULL THEN '❌ NO DATE SET'
                                WHEN DATE(medicalDate) = CURDATE() THEN '✅ TODAY'
                                WHEN DATE(medicalDate) > CURDATE() THEN '⚠️ FUTURE DATE'
                                ELSE 'PAST DATE'
                            END as date_status
                          FROM residence 
                          WHERE DATE(medicalDate) = CURDATE()
                          OR (medicalTCost > 0 AND TIMESTAMPDIFF(HOUR, medicalDate, NOW()) < 2)
                          ORDER BY medicalDate DESC");
    $stmt->execute();
    $todayEntries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Check what the accounts API would return for today
    $resetDate = '2025-10-01';
    $stmt2 = $pdo->prepare("SELECT 
                            r.residenceID as id,
                            r.medicalDate as transaction_date,
                            'Residence - Medical' as transaction_type,
                            COALESCE(r.medicalAccount, 0) as accountID,
                            r.medicalTCost as amount,
                            r.passenger_name
                          FROM residence r
                          WHERE (r.medicalAccount IS NOT NULL OR r.medicalSupplier IS NOT NULL)
                          AND r.medicalTCost > 0
                          AND r.medicalDate IS NOT NULL
                          AND (r.medicalAccount IS NULL OR r.medicalAccount != 25)
                          AND DATE(r.medicalDate) >= :resetDate
                          AND DATE(r.medicalDate) = CURDATE()
                          ORDER BY r.medicalDate DESC");
    $stmt2->execute([':resetDate' => $resetDate]);
    $apiWouldReturn = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'current_time' => date('Y-m-d H:i:s'),
        'today_date' => $today,
        'medical_entries_saved_today' => count($todayEntries),
        'entries_api_would_return' => count($apiWouldReturn),
        'todays_medical_entries' => $todayEntries,
        'what_api_returns' => $apiWouldReturn,
        'diagnosis' => [
            'if_saved_today_count_is_0' => 'No medical entries saved today - check if save is working',
            'if_saved_but_not_in_api' => 'Check if medicalAccount or medicalSupplier is set',
            'if_in_api_but_not_showing' => 'Accounts Report needs to reload - click Load Transactions button'
        ],
        'action_needed' => 'After saving medical, go to Accounts Report and click "Load Transactions" button'
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>

