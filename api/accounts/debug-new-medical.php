<?php
/**
 * DEBUG: Why aren't new medical entries showing?
 * Checks the last 10 medical entries saved
 */

require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    // Get the LAST 10 medical entries (most recent)
    $stmt = $pdo->query("SELECT 
                            residenceID,
                            passenger_name,
                            medicalTCost,
                            medicalAccount,
                            medicalSupplier,
                            medicalDate,
                            DATE(medicalDate) as date_only,
                            TIME(medicalDate) as time_only,
                            TIMESTAMPDIFF(MINUTE, medicalDate, NOW()) as minutes_ago,
                            datetime as residence_created,
                            CASE 
                                WHEN medicalAccount IS NOT NULL THEN CONCAT('✅ Account: ', medicalAccount)
                                WHEN medicalSupplier IS NOT NULL THEN CONCAT('✅ Supplier: ', medicalSupplier)
                                ELSE '❌ NO CHARGE ENTITY - WILL NOT SHOW IN REPORT!'
                            END as charged_to,
                            CASE
                                WHEN medicalDate IS NULL THEN '❌ NO DATE - WILL NOT SHOW!'
                                WHEN DATE(medicalDate) = CURDATE() THEN '✅ TODAY'
                                WHEN DATE(medicalDate) >= '2025-10-01' THEN '✅ After Reset'
                                ELSE '❌ Before Reset'
                            END as date_status,
                            CASE
                                WHEN medicalDate IS NULL THEN '❌ NO medicalDate'
                                WHEN medicalAccount IS NULL AND medicalSupplier IS NULL THEN '❌ NO account/supplier'
                                WHEN medicalAccount = 25 THEN '❌ Account 25 (excluded)'
                                WHEN DATE(medicalDate) < '2025-10-01' THEN '❌ Before reset date'
                                ELSE '✅ SHOULD SHOW IN REPORT'
                            END as will_show
                        FROM residence 
                        WHERE medicalTCost > 0
                        ORDER BY medicalDate DESC
                        LIMIT 10");
    $recentEntries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Check specifically for today
    $stmt2 = $pdo->query("SELECT 
                            residenceID,
                            passenger_name,
                            medicalTCost,
                            medicalAccount,
                            medicalSupplier,
                            medicalDate,
                            CASE 
                                WHEN medicalAccount IS NOT NULL THEN CONCAT('Account: ', medicalAccount)
                                WHEN medicalSupplier IS NOT NULL THEN CONCAT('Supplier: ', medicalSupplier)
                                ELSE 'NONE ⚠️'
                            END as charged_to
                          FROM residence 
                          WHERE medicalTCost > 0
                          AND DATE(medicalDate) = CURDATE()
                          ORDER BY medicalDate DESC");
    $todayEntries = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    
    // Count issues
    $issues = [
        'no_date' => 0,
        'no_charge_entity' => 0,
        'account_25' => 0,
        'before_reset' => 0,
        'should_show' => 0
    ];
    
    foreach ($recentEntries as $entry) {
        if ($entry['will_show'] == '✅ SHOULD SHOW IN REPORT') {
            $issues['should_show']++;
        }
    }
    
    echo json_encode([
        'current_server_time' => date('Y-m-d H:i:s'),
        'current_date' => date('Y-m-d'),
        'last_10_medical_entries' => $recentEntries,
        'medical_entries_saved_today' => count($todayEntries),
        'todays_entries' => $todayEntries,
        'summary' => [
            'total_checked' => count($recentEntries),
            'should_show_in_report' => $issues['should_show'],
            'have_issues' => count($recentEntries) - $issues['should_show']
        ],
        'diagnosis' => [
            'check_last_10_entries' => 'See if your 3 new medical entries are here',
            'check_will_show_column' => 'If it says NO, see the reason',
            'check_charged_to' => 'Must have Account OR Supplier set',
            'check_date_status' => 'Must be TODAY or After Reset'
        ],
        'instructions' => [
            '1' => 'Find your 3 new medical entries in last_10_medical_entries',
            '2' => 'Check the will_show field - must say SHOULD SHOW IN REPORT',
            '3' => 'If it says NO, check why (no date, no account, etc)',
            '4' => 'Copy paste the result so I can help fix it'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

