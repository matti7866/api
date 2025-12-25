<?php
/**
 * VERIFY MOVE - Check if residence was actually moved
 * Pass: ?id=1760
 */

require_once __DIR__ . '/../cors-headers.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

$residenceID = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$residenceID) {
    echo json_encode(['error' => 'Please provide residence ID: ?id=1760']);
    exit;
}

try {
    // Get current residence data
    $stmt = $pdo->prepare("SELECT 
                            residenceID,
                            passenger_name,
                            completedStep,
                            offerLetterStatus,
                            eVisaStatus,
                            current_status,
                            CASE 
                                WHEN completedStep = 0 THEN 'Step 1 - Offer Letter'
                                WHEN completedStep = 1 THEN 'Step 2 - Insurance (or 1a if submitted)'
                                WHEN completedStep = 2 THEN 'Step 3 - Labour Card'
                                WHEN completedStep = 3 THEN 'Step 4 - E-Visa'
                                WHEN completedStep = 4 THEN 'Step 5 - Change Status (or 4a if evisa submitted)'
                                WHEN completedStep = 5 THEN 'Step 6 - Medical'
                                WHEN completedStep = 6 THEN 'Step 7 - Emirates ID'
                                WHEN completedStep = 7 THEN 'Step 8 - Visa Stamping'
                                WHEN completedStep = 8 THEN 'Step 9 - Contract Submission'
                                WHEN completedStep = 10 THEN 'Step 10 - Completed'
                                ELSE CONCAT('Unknown Step (', completedStep, ')')
                            END as current_step_name
                          FROM residence 
                          WHERE residenceID = ?");
    $stmt->execute([$residenceID]);
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        echo json_encode(['error' => 'Residence not found']);
        exit;
    }
    
    // Check which lists this residence SHOULD appear in
    $appearsIn = [];
    
    // Step 1: completedStep = 0
    if ($residence['completedStep'] == 0) {
        $appearsIn[] = 'Step 1 (Offer Letter)';
    }
    
    // Step 1a: completedStep = 1 AND offerLetterStatus = submitted
    if ($residence['completedStep'] == 1 && $residence['offerLetterStatus'] == 'submitted') {
        $appearsIn[] = 'Step 1a (Offer Letter Submitted)';
    }
    
    // Step 2: completedStep = 1 AND offerLetterStatus = accepted
    if ($residence['completedStep'] == 1 && $residence['offerLetterStatus'] == 'accepted') {
        $appearsIn[] = 'Step 2 (Insurance)';
    }
    
    // Step 3: completedStep = 2
    if ($residence['completedStep'] == 2) {
        $appearsIn[] = 'Step 3 (Labour Card)';
    }
    
    // Step 4: completedStep = 3
    if ($residence['completedStep'] == 3) {
        $appearsIn[] = 'Step 4 (E-Visa)';
    }
    
    // Step 4a: completedStep = 4 AND eVisaStatus = submitted
    if ($residence['completedStep'] == 4 && $residence['eVisaStatus'] == 'submitted') {
        $appearsIn[] = 'Step 4a (E-Visa Submitted)';
    }
    
    // Step 5: completedStep = 4 AND eVisaStatus = accepted
    if ($residence['completedStep'] == 4 && $residence['eVisaStatus'] == 'accepted') {
        $appearsIn[] = 'Step 5 (Change Status)';
    }
    
    // Step 6: completedStep = 5
    if ($residence['completedStep'] == 5) {
        $appearsIn[] = 'Step 6 (Medical)';
    }
    
    // Step 7: completedStep = 6
    if ($residence['completedStep'] == 6) {
        $appearsIn[] = 'Step 7 (Emirates ID)';
    }
    
    // Step 8: completedStep = 7
    if ($residence['completedStep'] == 7) {
        $appearsIn[] = 'Step 8 (Visa Stamping)';
    }
    
    // Step 9: completedStep = 8
    if ($residence['completedStep'] == 8) {
        $appearsIn[] = 'Step 9 (Contract Submission)';
    }
    
    // Step 10: completedStep = 10
    if ($residence['completedStep'] == 10) {
        $appearsIn[] = 'Step 10 (Completed)';
    }
    
    echo json_encode([
        'residence_id' => $residence['residenceID'],
        'passenger_name' => $residence['passenger_name'],
        'completed_step_value' => (int)$residence['completedStep'],
        'current_step_interpretation' => $residence['current_step_name'],
        'offer_letter_status' => $residence['offerLetterStatus'],
        'evisa_status' => $residence['eVisaStatus'],
        'should_appear_in_these_step_lists' => $appearsIn,
        'explanation' => [
            'completedStep_value' => (int)$residence['completedStep'],
            'meaning' => 'This many steps have been COMPLETED',
            'current_working_step' => 'completedStep + 1 (e.g., if completedStep=3, currently on step 4)',
            'appears_in' => 'Step lists where filtering matches this completedStep value'
        ]
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>

