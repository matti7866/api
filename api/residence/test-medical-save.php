<?php
/**
 * TEST MEDICAL SAVE
 * Manually save a medical entry to test if it works
 */

require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    $testResidenceID = 1767; // Use an existing residence ID
    $medicalTCost = 999; // Test amount to identify
    $medicalAccount = 22; // MUNNA - MEDICAL-ID
    $medicalTCur = 1; // AED
    $staff_id = 15; // Arsalan
    
    // Try to save medical
    $sql = "UPDATE `residence` SET 
            medicalTCost = :medicalTCost,
            medicalTCur = :medicalTCur,
            medicalSupplier = NULL,
            medicalAccount = :medicalAccount,
            stepsevenUpploader = :stepsevenUpploader,
            medicalDate = NOW()
            WHERE residenceID = :residenceID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':medicalTCost', $medicalTCost);
    $stmt->bindParam(':medicalTCur', $medicalTCur);
    $stmt->bindParam(':medicalAccount', $medicalAccount);
    $stmt->bindParam(':stepsevenUpploader', $staff_id);
    $stmt->bindParam(':residenceID', $testResidenceID);
    
    $result = $stmt->execute();
    $rowsAffected = $stmt->rowCount();
    
    // Read it back
    $check = $pdo->prepare("SELECT residenceID, passenger_name, medicalTCost, medicalAccount, medicalDate 
                            FROM residence WHERE residenceID = ?");
    $check->execute([$testResidenceID]);
    $saved = $check->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'test' => 'Medical Save Test',
        'sql_executed' => $result,
        'rows_affected' => $rowsAffected,
        'test_residence_id' => $testResidenceID,
        'test_amount' => $medicalTCost,
        'saved_data' => $saved,
        'success' => ($saved['medicalTCost'] == $medicalTCost),
        'diagnosis' => [
            'if_success_is_false' => 'Save is not working - database issue',
            'if_medicalDate_is_old' => 'Date is not updating - check NOW() function',
            'if_rows_affected_is_0' => 'UPDATE query not matching any rows'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>

