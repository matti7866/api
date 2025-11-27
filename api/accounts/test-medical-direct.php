<?php
/**
 * DIRECT TEST: Medical Costs Query
 * Run this to test the exact query used in transactions.php
 */

require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

$fromDate = '2025-10-01';
$toDate = date('Y-m-d');
$resetDate = '2025-10-01';

try {
    error_log("========== TESTING MEDICAL QUERY DIRECTLY ==========");
    
    // Exact query from transactions.php
    $sql = "SELECT 
                r.residenceID as id,
                r.medicalDate as transaction_date,
                'Residence - Medical' as transaction_type,
                'debit' as type_category,
                COALESCE(r.medicalAccount, 0) as accountID,
                r.medicalTCost as amount,
                r.medicalTCur as currencyID,
                CASE 
                    WHEN r.medicalAccount IS NOT NULL THEN CONCAT('Account charged - Medical test')
                    WHEN r.medicalSupplier IS NOT NULL THEN CONCAT('Supplier charged - Medical test')
                    ELSE 'Medical test processing'
                END as remarks,
                r.residenceID as reference_id,
                NULL as staff_name,
                CONCAT('Medical for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                       CASE 
                           WHEN r.medicalSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                           ELSE ''
                       END) as description,
                r.medicalAccount,
                r.medicalSupplier,
                r.medicalDate
            FROM residence r
            LEFT JOIN customer c ON r.customer_id = c.customer_id
            WHERE (r.medicalAccount IS NOT NULL OR r.medicalSupplier IS NOT NULL)
            AND r.medicalTCost > 0
            AND r.medicalDate IS NOT NULL
            AND (r.medicalAccount IS NULL OR r.medicalAccount != 25)
            AND DATE(r.medicalDate) >= :resetDate
            AND DATE(r.medicalDate) BETWEEN :fromDate AND :toDate
            ORDER BY r.medicalDate DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':fromDate', $fromDate);
    $stmt->bindParam(':toDate', $toDate);
    $stmt->bindParam(':resetDate', $resetDate);
    $stmt->execute();
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    error_log("Medical query returned: " . count($results) . " results");
    
    // Also count what's in database
    $countStmt = $pdo->prepare("SELECT 
                                    COUNT(*) as total,
                                    SUM(CASE WHEN medicalDate IS NULL THEN 1 ELSE 0 END) as no_date,
                                    SUM(CASE WHEN DATE(medicalDate) < :resetDate THEN 1 ELSE 0 END) as before_reset,
                                    SUM(CASE WHEN medicalAccount IS NULL AND medicalSupplier IS NULL THEN 1 ELSE 0 END) as no_charge
                                FROM residence 
                                WHERE medicalTCost > 0");
    $countStmt->execute([':resetDate' => $resetDate]);
    $counts = $countStmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'query_used' => 'Same as transactions.php',
        'parameters' => [
            'fromDate' => $fromDate,
            'toDate' => $toDate,
            'resetDate' => $resetDate,
            'accountFilter' => 'NONE (showing all)'
        ],
        'results_count' => count($results),
        'results' => $results,
        'database_stats' => [
            'total_with_medical_cost' => (int)$counts['total'],
            'missing_date' => (int)$counts['no_date'],
            'before_reset_date' => (int)$counts['before_reset'],
            'no_charge_entity' => (int)$counts['no_charge'],
            'should_appear' => count($results)
        ],
        'diagnosis' => [
            'If results_count = 0' => 'Check database_stats to see why',
            'If missing_date > 0' => 'Medical entries exist but have no medicalDate',
            'If before_reset_date > 0' => 'Medical entries exist but before 2025-10-01',
            'If no_charge_entity > 0' => 'Medical entries have no account or supplier assigned'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

