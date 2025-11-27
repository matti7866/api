<?php
/**
 * DIAGNOSTIC: Medical Costs Investigation
 * Run this to see EXACTLY what's in your database
 */

require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    $resetDate = '2025-10-01';
    
    // 1. Count all medical entries
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM residence WHERE medicalTCost > 0");
    $totalMedical = $stmt->fetchColumn();
    
    // 2. Count with date
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM residence WHERE medicalTCost > 0 AND medicalDate IS NOT NULL");
    $withDate = $stmt->fetchColumn();
    
    // 3. Count after reset date
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM residence WHERE medicalTCost > 0 AND medicalDate IS NOT NULL AND DATE(medicalDate) >= ?");
    $stmt->execute([$resetDate]);
    $afterReset = $stmt->fetchColumn();
    
    // 4. Breakdown by charge type
    $stmt = $pdo->prepare("SELECT 
                            COUNT(*) as total,
                            SUM(CASE WHEN medicalAccount IS NOT NULL THEN 1 ELSE 0 END) as charged_to_account,
                            SUM(CASE WHEN medicalSupplier IS NOT NULL AND medicalAccount IS NULL THEN 1 ELSE 0 END) as charged_to_supplier,
                            SUM(CASE WHEN medicalAccount IS NULL AND medicalSupplier IS NULL THEN 1 ELSE 0 END) as no_charge_entity,
                            SUM(CASE WHEN medicalDate IS NULL THEN 1 ELSE 0 END) as missing_date
                          FROM residence 
                          WHERE medicalTCost > 0");
    $stmt->execute();
    $breakdown = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 5. Get sample entries
    $stmt = $pdo->prepare("SELECT 
                            residenceID,
                            passenger_name,
                            medicalTCost,
                            medicalAccount,
                            medicalSupplier,
                            medicalDate,
                            DATE(medicalDate) as medicalDate_formatted,
                            CASE 
                                WHEN medicalAccount IS NOT NULL THEN CONCAT('Account: ', medicalAccount)
                                WHEN medicalSupplier IS NOT NULL THEN CONCAT('Supplier: ', medicalSupplier)
                                ELSE 'NO CHARGE ENTITY'
                            END as charged_to,
                            CASE
                                WHEN medicalDate IS NULL THEN 'NO DATE'
                                WHEN DATE(medicalDate) < ? THEN 'BEFORE RESET'
                                ELSE 'VALID'
                            END as status
                          FROM residence 
                          WHERE medicalTCost > 0
                          ORDER BY medicalDate DESC
                          LIMIT 20");
    $stmt->execute([$resetDate]);
    $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 6. Check what SHOULD appear in accounts report
    $stmt = $pdo->prepare("SELECT 
                            residenceID,
                            passenger_name,
                            medicalTCost,
                            medicalAccount,
                            medicalDate
                          FROM residence 
                          WHERE medicalTCost > 0
                          AND medicalDate IS NOT NULL
                          AND DATE(medicalDate) >= ?
                          AND (medicalAccount IS NOT NULL OR medicalSupplier IS NOT NULL)
                          ORDER BY medicalDate DESC
                          LIMIT 20");
    $stmt->execute([$resetDate]);
    $shouldAppear = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'database' => 'sntravels_prod',
        'reset_date' => $resetDate,
        'summary' => [
            'total_medical_with_cost' => (int)$totalMedical,
            'with_date' => (int)$withDate,
            'after_reset_date' => (int)$afterReset,
            'should_appear_in_report' => count($shouldAppear)
        ],
        'breakdown' => $breakdown,
        'sample_entries' => $samples,
        'entries_that_should_appear' => $shouldAppear,
        'analysis' => [
            'missing_dates' => (int)$breakdown['missing_date'],
            'before_reset' => (int)$withDate - (int)$afterReset,
            'valid_for_report' => count($shouldAppear)
        ],
        'warnings' => [
            'If medical entries have NULL medicalDate' => 'They will NOT appear (need date)',
            'If medical entries before 2025-10-01' => 'They will NOT appear (before reset)',
            'If medicalAccount AND medicalSupplier both NULL' => 'They will NOT appear (no charge entity)'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>

