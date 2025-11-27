<?php
/**
 * DIAGNOSTIC API - Check Medical Step Issues
 * Helps identify why medical costs might not be showing
 */

require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    // Check medical entries in residence table
    $query = "SELECT 
                residenceID,
                passenger_name,
                medicalTCost,
                medicalTCur,
                medicalAccount,
                medicalSupplier,
                medicalDate,
                CASE 
                    WHEN medicalAccount IS NOT NULL THEN 'Account'
                    WHEN medicalSupplier IS NOT NULL THEN 'Supplier'
                    ELSE 'None'
                END as charged_to
              FROM residence 
              WHERE medicalTCost > 0 
              AND medicalDate IS NOT NULL
              AND DATE(medicalDate) >= '2025-10-01'
              ORDER BY medicalDate DESC
              LIMIT 50";
    
    $stmt = $pdo->query($query);
    $medicalEntries = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Count breakdown
    $withAccount = 0;
    $withSupplier = 0;
    $withNeither = 0;
    
    foreach ($medicalEntries as $entry) {
        if ($entry['medicalAccount']) {
            $withAccount++;
        } elseif ($entry['medicalSupplier']) {
            $withSupplier++;
        } else {
            $withNeither++;
        }
    }
    
    echo json_encode([
        'total_medical_entries' => count($medicalEntries),
        'breakdown' => [
            'charged_to_account' => $withAccount,
            'charged_to_supplier' => $withSupplier,
            'no_charge_entity' => $withNeither
        ],
        'sample_entries' => array_slice($medicalEntries, 0, 10),
        'message' => 'Medical entries charged to SUPPLIERS will NOT appear in account transactions!',
        'solution' => 'Only medical costs with medicalAccount set will show in accounts report'
    ]);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>

