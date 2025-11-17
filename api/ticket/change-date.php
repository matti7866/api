<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
    // Handle file upload or JSON data
    // Check if data is coming as FormData (multipart) or JSON
    if (!empty($_POST)) {
        // Data sent as FormData
        $input = $_POST;
    } else {
        // Data sent as JSON
        $input = json_decode(file_get_contents('php://input'), true);
    }
    
    // Validate required fields
    $requiredFields = ['ticket_id', 'extended_date', 'supplier_id', 'net_amount', 'sale_amount'];
    $missingFields = [];
    
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || $input[$field] === '' || $input[$field] === null) {
            $missingFields[] = $field;
        }
    }
    
    if (!empty($missingFields)) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Missing required fields: ' . implode(', ', $missingFields)
        ], 400);
    }
    
    // Handle file upload
    $changedTicketPath = null;
    if (isset($_FILES['changedTicket']) && $_FILES['changedTicket']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['changedTicket'];
        
        // Validate file type
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        $fileType = mime_content_type($file['tmp_name']);
        
        if (!in_array($fileType, $allowedTypes)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Invalid file type. Only JPG, PNG, GIF, and PDF are allowed'
            ], 400);
        }
        
        // Validate file size (max 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'File size must be less than 5MB'
            ], 400);
        }
        
        // Create upload directory
        $uploadDir = '../../uploads/datechange/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Generate unique filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'datechange_' . $input['ticket_id'] . '_' . time() . '.' . $extension;
        $uploadPath = $uploadDir . $filename;
        $changedTicketPath = 'uploads/datechange/' . $filename;
        
        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Failed to upload file'
            ], 500);
        }
    }
    
    // Get staff branch
    $branchStmt = $pdo->prepare("SELECT staff_branchID FROM staff WHERE staff_id = :staff_id");
    $branchStmt->execute([':staff_id' => $user['staff_id']]);
    $branchData = $branchStmt->fetch(PDO::FETCH_ASSOC);
    $branchID = $branchData['staff_branchID'] ?? 1;
    
    // Begin transaction
    $pdo->beginTransaction();
    
    // Insert into datechange table
    $sql = "INSERT INTO datechange (
        ticket_id, supplier, net_amount, netCurrencyID, 
        sale_amount, saleCurrencyID, remarks, extended_Date, 
        changedTicket, branchID, ticketStatus
    ) VALUES (
        :ticket_id, :supplier, :net_amount, :netCurrencyID,
        :sale_amount, :saleCurrencyID, :remarks, :extended_date,
        :changedTicket, :branchID, 1
    )";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':ticket_id' => $input['ticket_id'],
        ':supplier' => $input['supplier_id'],
        ':net_amount' => $input['net_amount'],
        ':netCurrencyID' => $input['net_currency_id'] ?? 1,
        ':sale_amount' => $input['sale_amount'],
        ':saleCurrencyID' => $input['sale_currency_id'] ?? 1,
        ':remarks' => $input['remarks'] ?? '',
        ':extended_date' => $input['extended_date'],
        ':changedTicket' => $changedTicketPath,
        ':branchID' => $branchID
    ]);
    
    // Update ticket travel date and status (2 = Date Changed)
    $updateSql = "UPDATE ticket SET date_of_travel = :extended_date, status = 2 WHERE ticket = :ticket_id";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([
        ':extended_date' => $input['extended_date'],
        ':ticket_id' => $input['ticket_id']
    ]);
    
    // Commit transaction
    $pdo->commit();
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Date change saved successfully',
        'change_id' => $pdo->lastInsertId()
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Database Error in ticket/change-date.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error in ticket/change-date.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}

