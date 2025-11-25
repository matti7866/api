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
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Check if data is coming as FormData or JSON
    if (!empty($_POST)) {
        $input = $_POST;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
    }
    
    // Validate required fields
    $requiredFields = ['customer_id', 'passenger_name', 'supp_id', 'country_id', 
                       'net_price', 'netCurrencyID', 'sale', 'saleCurrencyID', 
                       'gaurantee', 'address', 'nationalityID'];
    
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || $input[$field] === '') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => "Missing required field: $field"
            ], 400);
        }
    }
    
    // Get staff branchID
    $staffStmt = $pdo->prepare("SELECT staff_branchID FROM staff WHERE staff_id = :staff_id");
    $staffStmt->execute([':staff_id' => $user['staff_id']]);
    $staffData = $staffStmt->fetch(PDO::FETCH_ASSOC);
    $branchID = $staffData['staff_branchID'] ?? 1;
    
    // Handle file upload if present
    $visaCopyPath = null;
    if (isset($_FILES['visaCopy']) && $_FILES['visaCopy']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['visaCopy'];
        
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
        $uploadDir = __DIR__ . '/../../uploads/visas/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Generate filename
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'visa_' . time() . '_' . uniqid() . '.' . $extension;
        $uploadPath = $uploadDir . $filename;
        $visaCopyPath = 'uploads/visas/' . $filename;
        
        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Failed to upload file'
            ], 500);
        }
    }
    
    // Begin transaction
    $pdo->beginTransaction();
    
    // Insert visa
    $sql = "INSERT INTO visa (
        customer_id, passenger_name, supp_id, country_id, staff_id,
        net_price, netCurrencyID, sale, saleCurrencyID, gaurantee,
        address, pendingvisa, visaCopy, branchID, PassportNum, nationalityID
    ) VALUES (
        :customer_id, :passenger_name, :supp_id, :country_id, :staff_id,
        :net_price, :netCurrencyID, :sale, :saleCurrencyID, :gaurantee,
        :address, :pendingvisa, :visaCopy, :branchID, :PassportNum, :nationalityID
    )";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':customer_id' => $input['customer_id'],
        ':passenger_name' => $input['passenger_name'],
        ':supp_id' => $input['supp_id'],
        ':country_id' => $input['country_id'],
        ':staff_id' => $user['staff_id'],
        ':net_price' => $input['net_price'],
        ':netCurrencyID' => $input['netCurrencyID'],
        ':sale' => $input['sale'],
        ':saleCurrencyID' => $input['saleCurrencyID'],
        ':gaurantee' => $input['gaurantee'],
        ':address' => $input['address'],
        ':pendingvisa' => $input['pendingvisa'] ?? 1,
        ':visaCopy' => $visaCopyPath,
        ':branchID' => $branchID,
        ':PassportNum' => $input['PassportNum'] ?? '',
        ':nationalityID' => $input['nationalityID']
    ]);
    
    $visaId = $pdo->lastInsertId();
    
    // Commit transaction
    $pdo->commit();
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Visa created successfully',
        'visa_id' => $visaId
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Database Error in visa/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error in visa/create.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













