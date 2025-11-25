<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Attachments for a Residence
 * Endpoint: /api/residence/attachments.php
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

// Get residence ID
$residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : 0;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    // Map fileType to step number
    $fileTypeToStep = [
        1 => 0,   // Passport - Initial Documents
        11 => 0,  // Photo - Initial Documents
        12 => 0,  // Emirates ID Front - Initial Documents
        13 => 0,  // Emirates ID Back - Initial Documents
        2 => 1,   // Offer Letter
        3 => 2,   // Insurance
        4 => 3,   // Labor Card
        5 => 4,   // E-Visa
        6 => 5,   // Change Status
        7 => 6,   // Medical
        8 => 7,   // Emirates ID
        9 => 8,   // Visa Stamping
        10 => 9,  // Final Documents
    ];
    
    // Get all attachments from residencedocuments table
    $sql = "SELECT 
                ResidenceDocID as attachment_id,
                ResID as residenceID,
                file_name,
                original_name,
                fileType,
                DATE_FORMAT(uploaded_at, '%Y-%m-%d %H:%i:%s') as uploaded_at
            FROM residencedocuments 
            WHERE ResID = :residenceID
            ORDER BY fileType ASC, ResidenceDocID DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID, PDO::PARAM_INT);
    $stmt->execute();
    $documents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Transform to match expected format
    $attachments = [];
    foreach ($documents as $doc) {
        $fileType = (int)$doc['fileType'];
        $stepNumber = isset($fileTypeToStep[$fileType]) ? $fileTypeToStep[$fileType] : 0;
        
        $attachments[] = [
            'attachment_id' => (int)$doc['attachment_id'],
            'residenceID' => (int)$doc['residenceID'],
            'file_path' => 'residence/' . $doc['file_name'],
            'file_name' => $doc['original_name'] ?: $doc['file_name'],
            'file_type' => pathinfo($doc['file_name'], PATHINFO_EXTENSION),
            'step_number' => $stepNumber,
            'uploaded_at' => $doc['uploaded_at']
        ];
    }
    
    // sendResponse merges arrays, so wrap in data key
    JWTHelper::sendResponse(200, true, 'Success', ['data' => $attachments]);
    
} catch (Exception $e) {
    error_log("Get attachments error: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}
