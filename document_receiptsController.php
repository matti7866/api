<?php
require_once __DIR__ . '/cors-headers.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if(!isset($_SESSION['user_id'])){
    // Try JWT token from Authorization header
    require_once(__DIR__ . '/auth/JWTHelper.php');
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        $decoded = JWTHelper::validateToken($token);
        if ($decoded && isset($decoded->data)) {
            $_SESSION['user_id'] = $decoded->data->staff_id ?? null;
            $_SESSION['role_id'] = $decoded->data->role_id ?? null;
            $_SESSION['staff_name'] = $decoded->data->staff_name ?? '';
        }
    }
    
    if(!isset($_SESSION['user_id'])){
        sendJsonResponse(['error' => 'Authentication required', 'success' => false], 401);
    }
}

include __DIR__ . '/../connection.php';

// Helper function to send JSON response
function sendJsonResponse($data, $statusCode = 200) {
    $allowedOrigins = [
        'http://localhost:5174', 
        'http://127.0.0.1:5174',
        'http://localhost:5176', 
        'http://127.0.0.1:5176',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://ssn.sntrips.com',
        'http://ssn.sntrips.com',
        'https://app.sntrips.com',
        'http://app.sntrips.com'
    ];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Get action from request
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_POST['action'] ?? null;

if (!$action) {
    sendJsonResponse(['success' => false, 'message' => 'Action is required'], 400);
}

// Handle different actions
switch ($action) {
    case 'getReceipts':
        getReceipts($pdo, $input);
        break;
    case 'getReceipt':
        getReceipt($pdo, $input);
        break;
    case 'createReceipt':
        createReceipt($pdo, $_POST, $_FILES);
        break;
    case 'updateReceipt':
        updateReceipt($pdo, $_POST, $_FILES);
        break;
    case 'deleteReceipt':
        deleteReceipt($pdo, $input);
        break;
    case 'getStats':
        getStats($pdo);
        break;
    case 'getDocumentTypeOptions':
        getDocumentTypeOptions($pdo);
        break;
    case 'addDocumentTypeOption':
        addDocumentTypeOption($pdo, $input);
        break;
    case 'deleteAttachment':
        deleteAttachment($pdo, $input);
        break;
    case 'getAvailableForReturn':
        getAvailableForReturn($pdo, $input);
        break;
    case 'getReceiptForPrint':
        getReceiptForPrint($pdo, $input);
        break;
    case 'getCustomers':
        getCustomers($pdo);
        break;
    default:
        sendJsonResponse(['success' => false, 'message' => 'Invalid action'], 400);
        break;
}

/**
 * Get all document receipts with filters
 */
function getReceipts($pdo, $input) {
    $search = $input['search'] ?? '';
    $transactionType = $input['transaction_type'] ?? null;
    $status = $input['status'] ?? null;
    $fromDate = $input['from_date'] ?? null;
    $toDate = $input['to_date'] ?? null;
    $page = intval($input['page'] ?? 1);
    $limit = intval($input['limit'] ?? 50);
    $offset = ($page - 1) * $limit;

    // Build WHERE clause
    $whereClauses = [];
    $params = [];

    if (!empty($search)) {
        $whereClauses[] = "(dr.customer_name LIKE :search1 OR dr.receipt_number LIKE :search2 OR dr.customer_phone LIKE :search3 OR dr.customer_email LIKE :search4)";
        $searchParam = "%$search%";
        $params[':search1'] = $searchParam;
        $params[':search2'] = $searchParam;
        $params[':search3'] = $searchParam;
        $params[':search4'] = $searchParam;
    }

    if ($transactionType) {
        $whereClauses[] = "dr.transaction_type = :transaction_type";
        $params[':transaction_type'] = $transactionType;
    }

    if ($status) {
        $whereClauses[] = "dr.status = :status";
        $params[':status'] = $status;
    }

    if ($fromDate) {
        $whereClauses[] = "DATE(dr.transaction_date) >= :from_date";
        $params[':from_date'] = $fromDate;
    }

    if ($toDate) {
        $whereClauses[] = "DATE(dr.transaction_date) <= :to_date";
        $params[':to_date'] = $toDate;
    }

    $whereSQL = !empty($whereClauses) ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    // Count total records
    $countSQL = "SELECT COUNT(*) as total FROM document_receipts dr $whereSQL";
    $countStmt = $pdo->prepare($countSQL);
    $countStmt->execute($params);
    $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get receipts
    $sql = "SELECT 
                dr.*,
                s1.staff_name as received_by_name,
                s2.staff_name as returned_by_name
            FROM document_receipts dr
            LEFT JOIN staff s1 ON dr.received_by_id = s1.staff_id
            LEFT JOIN staff s2 ON dr.returned_by_id = s2.staff_id
            $whereSQL
            ORDER BY dr.created_at DESC
            LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $receipts = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Get document types for this receipt
        $docTypesSQL = "SELECT * FROM document_receipt_items WHERE receipt_id = :receipt_id";
        $docStmt = $pdo->prepare($docTypesSQL);
        $docStmt->execute([':receipt_id' => $row['id']]);
        
        $documentTypes = [];
        while ($docRow = $docStmt->fetch(PDO::FETCH_ASSOC)) {
            $documentTypes[] = [
                'id' => (int)$docRow['id'],
                'document_type_name' => $docRow['document_type_name'],
                'quantity' => (int)$docRow['quantity'],
                'description' => $docRow['description']
            ];
        }

        // Get attachments
        $attSQL = "SELECT * FROM document_receipt_attachments WHERE receipt_id = :receipt_id";
        $attStmt = $pdo->prepare($attSQL);
        $attStmt->execute([':receipt_id' => $row['id']]);
        
        $attachments = [];
        while ($attRow = $attStmt->fetch(PDO::FETCH_ASSOC)) {
            $attachments[] = [
                'id' => (int)$attRow['id'],
                'file_name' => $attRow['file_name'],
                'file_path' => $attRow['file_path'],
                'file_type' => $attRow['file_type'],
                'file_size' => (int)$attRow['file_size']
            ];
        }

        $receipts[] = [
            'id' => (int)$row['id'],
            'receipt_number' => $row['receipt_number'],
            'customer_name' => $row['customer_name'],
            'customer_phone' => $row['customer_phone'],
            'customer_email' => $row['customer_email'],
            'transaction_type' => $row['transaction_type'],
            'transaction_date' => $row['transaction_date'],
            'label' => $row['label'],
            'notes' => $row['notes'],
            'status' => $row['status'],
            'received_by' => $row['received_by_name'],
            'received_by_id' => $row['received_by_id'] ? (int)$row['received_by_id'] : null,
            'returned_by' => $row['returned_by_name'],
            'returned_by_id' => $row['returned_by_id'] ? (int)$row['returned_by_id'] : null,
            'original_receipt_id' => $row['original_receipt_id'] ? (int)$row['original_receipt_id'] : null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'document_types' => $documentTypes,
            'attachments' => $attachments
        ];
    }

    sendJsonResponse([
        'success' => true,
        'data' => $receipts,
        'pagination' => [
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => ceil($total / $limit)
        ]
    ]);
}

/**
 * Get a single document receipt
 */
function getReceipt($pdo, $input) {
    $id = intval($input['id'] ?? 0);
    
    if (!$id) {
        sendJsonResponse(['success' => false, 'message' => 'Receipt ID is required'], 400);
    }

    $sql = "SELECT 
                dr.*,
                s1.staff_name as received_by_name,
                s2.staff_name as returned_by_name
            FROM document_receipts dr
            LEFT JOIN staff s1 ON dr.received_by_id = s1.staff_id
            LEFT JOIN staff s2 ON dr.returned_by_id = s2.staff_id
            WHERE dr.id = :id";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
        sendJsonResponse(['success' => false, 'message' => 'Receipt not found'], 404);
    }

    // Get document types
    $docTypesSQL = "SELECT * FROM document_receipt_items WHERE receipt_id = :receipt_id";
    $docStmt = $pdo->prepare($docTypesSQL);
    $docStmt->execute([':receipt_id' => $id]);
    
    $documentTypes = [];
    while ($docRow = $docStmt->fetch(PDO::FETCH_ASSOC)) {
        $documentTypes[] = [
            'id' => (int)$docRow['id'],
            'document_type_name' => $docRow['document_type_name'],
            'quantity' => (int)$docRow['quantity'],
            'description' => $docRow['description']
        ];
    }

    // Get attachments
    $attSQL = "SELECT * FROM document_receipt_attachments WHERE receipt_id = :receipt_id";
    $attStmt = $pdo->prepare($attSQL);
    $attStmt->execute([':receipt_id' => $id]);
    
    $attachments = [];
    while ($attRow = $attStmt->fetch(PDO::FETCH_ASSOC)) {
        $attachments[] = [
            'id' => (int)$attRow['id'],
            'file_name' => $attRow['file_name'],
            'file_path' => $attRow['file_path'],
            'file_type' => $attRow['file_type'],
            'file_size' => (int)$attRow['file_size'],
            'uploaded_at' => $attRow['uploaded_at']
        ];
    }

    $receipt = [
        'id' => (int)$row['id'],
        'receipt_number' => $row['receipt_number'],
        'customer_name' => $row['customer_name'],
        'customer_phone' => $row['customer_phone'],
        'customer_email' => $row['customer_email'],
        'transaction_type' => $row['transaction_type'],
        'transaction_date' => $row['transaction_date'],
        'label' => $row['label'],
        'notes' => $row['notes'],
        'status' => $row['status'],
        'received_by' => $row['received_by_name'],
        'received_by_id' => $row['received_by_id'] ? (int)$row['received_by_id'] : null,
        'returned_by' => $row['returned_by_name'],
        'returned_by_id' => $row['returned_by_id'] ? (int)$row['returned_by_id'] : null,
        'original_receipt_id' => $row['original_receipt_id'] ? (int)$row['original_receipt_id'] : null,
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'document_types' => $documentTypes,
        'attachments' => $attachments
    ];

    sendJsonResponse(['success' => true, 'data' => $receipt]);
}

/**
 * Create a new document receipt
 */
function createReceipt($pdo, $post, $files) {
    $staffId = $_SESSION['user_id'] ?? null;

    $customerName = trim($post['customer_name'] ?? '');
    $customerPhone = trim($post['customer_phone'] ?? '');
    $customerEmail = trim($post['customer_email'] ?? '');
    $transactionType = $post['transaction_type'] ?? '';
    $transactionDate = $post['transaction_date'] ?? date('Y-m-d H:i:s');
    $label = trim($post['label'] ?? '');
    $notes = trim($post['notes'] ?? '');
    $originalReceiptId = !empty($post['original_receipt_id']) ? intval($post['original_receipt_id']) : null;
    $documentTypes = json_decode($post['document_types'] ?? '[]', true);

    // Validation
    if (empty($customerName)) {
        sendJsonResponse(['success' => false, 'message' => 'Customer name is required'], 400);
    }

    if (!in_array($transactionType, ['received', 'returned'])) {
        sendJsonResponse(['success' => false, 'message' => 'Invalid transaction type'], 400);
    }

    if (empty($documentTypes) || !is_array($documentTypes)) {
        sendJsonResponse(['success' => false, 'message' => 'At least one document type is required'], 400);
    }

    // Generate receipt number
    $prefix = $transactionType === 'received' ? 'RCV' : 'RET';
    $year = date('Y');
    $month = date('m');
    
    $countSQL = "SELECT COUNT(*) as count FROM document_receipts WHERE receipt_number LIKE :pattern";
    $countStmt = $pdo->prepare($countSQL);
    $countStmt->execute([':pattern' => "$prefix-$year$month-%"]);
    $count = $countStmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    $receiptNumber = sprintf("%s-%s%s-%04d", $prefix, $year, $month, $count + 1);

    // Determine status
    $status = $transactionType === 'received' ? 'with_company' : 'with_customer';

    // Start transaction
    $pdo->beginTransaction();

    try {
        // Insert receipt
        $sql = "INSERT INTO document_receipts 
                (receipt_number, customer_name, customer_phone, customer_email, 
                 transaction_type, transaction_date, label, notes, status, 
                 received_by_id, returned_by_id, original_receipt_id) 
                VALUES (:receipt_number, :customer_name, :customer_phone, :customer_email, 
                        :transaction_type, :transaction_date, :label, :notes, :status, 
                        :received_by_id, :returned_by_id, :original_receipt_id)";
        
        $stmt = $pdo->prepare($sql);
        $receivedById = $transactionType === 'received' ? $staffId : null;
        $returnedById = $transactionType === 'returned' ? $staffId : null;
        
        $stmt->execute([
            ':receipt_number' => $receiptNumber,
            ':customer_name' => $customerName,
            ':customer_phone' => $customerPhone,
            ':customer_email' => $customerEmail,
            ':transaction_type' => $transactionType,
            ':transaction_date' => $transactionDate,
            ':label' => $label,
            ':notes' => $notes,
            ':status' => $status,
            ':received_by_id' => $receivedById,
            ':returned_by_id' => $returnedById,
            ':original_receipt_id' => $originalReceiptId
        ]);
        
        $receiptId = $pdo->lastInsertId();

        // Insert document types
        $docSQL = "INSERT INTO document_receipt_items 
                   (receipt_id, document_type_name, quantity, description) 
                   VALUES (:receipt_id, :document_type_name, :quantity, :description)";
        $docStmt = $pdo->prepare($docSQL);
        
        foreach ($documentTypes as $docType) {
            $typeName = trim($docType['document_type_name'] ?? '');
            $quantity = intval($docType['quantity'] ?? 1);
            $description = trim($docType['description'] ?? '');
            
            if (!empty($typeName) && $quantity > 0) {
                $docStmt->execute([
                    ':receipt_id' => $receiptId,
                    ':document_type_name' => $typeName,
                    ':quantity' => $quantity,
                    ':description' => $description
                ]);
            }
        }

        // Handle file uploads
        if (!empty($files['attachments']['name'][0])) {
            $uploadDir = __DIR__ . '/../uploads/document-receipts/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $attSQL = "INSERT INTO document_receipt_attachments 
                       (receipt_id, file_name, file_path, file_type, file_size) 
                       VALUES (:receipt_id, :file_name, :file_path, :file_type, :file_size)";
            $attStmt = $pdo->prepare($attSQL);

            $fileCount = count($files['attachments']['name']);
            for ($i = 0; $i < $fileCount; $i++) {
                if ($files['attachments']['error'][$i] === UPLOAD_ERR_OK) {
                    $fileName = basename($files['attachments']['name'][$i]);
                    $fileSize = $files['attachments']['size'][$i];
                    $fileType = $files['attachments']['type'][$i];
                    $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
                    
                    $newFileName = uniqid() . '_' . time() . '.' . $fileExt;
                    $filePath = $uploadDir . $newFileName;
                    
                    if (move_uploaded_file($files['attachments']['tmp_name'][$i], $filePath)) {
                        $attStmt->execute([
                            ':receipt_id' => $receiptId,
                            ':file_name' => $fileName,
                            ':file_path' => $filePath,
                            ':file_type' => $fileType,
                            ':file_size' => $fileSize
                        ]);
                    }
                }
            }
        }

        // If this is a return, update the original receipt status
        if ($transactionType === 'returned' && $originalReceiptId) {
            $updateSQL = "UPDATE document_receipts SET status = 'with_customer' WHERE id = :id";
            $updateStmt = $pdo->prepare($updateSQL);
            $updateStmt->execute([':id' => $originalReceiptId]);
        }

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => 'Document receipt created successfully',
            'receipt_id' => $receiptId,
            'receipt_number' => $receiptNumber
        ]);

    } catch (Exception $e) {
        $pdo->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Failed to create receipt: ' . $e->getMessage()], 500);
    }
}

/**
 * Delete a document receipt
 */
function deleteReceipt($pdo, $input) {
    $id = intval($input['id'] ?? 0);
    
    if (!$id) {
        sendJsonResponse(['success' => false, 'message' => 'Receipt ID is required'], 400);
    }

    $pdo->beginTransaction();

    try {
        // Get attachments to delete files
        $attSQL = "SELECT file_path FROM document_receipt_attachments WHERE receipt_id = :receipt_id";
        $attStmt = $pdo->prepare($attSQL);
        $attStmt->execute([':receipt_id' => $id]);
        
        $filesToDelete = [];
        while ($attRow = $attStmt->fetch(PDO::FETCH_ASSOC)) {
            $filesToDelete[] = $attRow['file_path'];
        }

        // Delete attachments records
        $delAttSQL = "DELETE FROM document_receipt_attachments WHERE receipt_id = :receipt_id";
        $delAttStmt = $pdo->prepare($delAttSQL);
        $delAttStmt->execute([':receipt_id' => $id]);

        // Delete document items
        $delItemsSQL = "DELETE FROM document_receipt_items WHERE receipt_id = :receipt_id";
        $delItemsStmt = $pdo->prepare($delItemsSQL);
        $delItemsStmt->execute([':receipt_id' => $id]);

        // Delete receipt
        $delReceiptSQL = "DELETE FROM document_receipts WHERE id = :id";
        $delReceiptStmt = $pdo->prepare($delReceiptSQL);
        $delReceiptStmt->execute([':id' => $id]);

        $pdo->commit();

        // Delete physical files
        foreach ($filesToDelete as $filePath) {
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }

        sendJsonResponse([
            'success' => true,
            'message' => 'Document receipt deleted successfully'
        ]);

    } catch (Exception $e) {
        $pdo->rollback();
        sendJsonResponse(['success' => false, 'message' => 'Failed to delete receipt: ' . $e->getMessage()], 500);
    }
}

/**
 * Get statistics
 */
function getStats($pdo) {
    $sql = "SELECT 
                COUNT(*) as total_receipts,
                SUM(CASE WHEN transaction_type = 'received' THEN 1 ELSE 0 END) as total_received,
                SUM(CASE WHEN transaction_type = 'returned' THEN 1 ELSE 0 END) as total_returned,
                SUM(CASE WHEN status = 'with_company' THEN 1 ELSE 0 END) as currently_with_company,
                SUM(CASE WHEN status = 'with_customer' THEN 1 ELSE 0 END) as currently_with_customer
            FROM document_receipts";
    
    $stmt = $pdo->query($sql);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    sendJsonResponse([
        'success' => true,
        'data' => [
            'total_received' => (int)$stats['total_received'],
            'total_returned' => (int)$stats['total_returned'],
            'currently_with_company' => (int)$stats['currently_with_company'],
            'currently_with_customer' => (int)$stats['currently_with_customer']
        ]
    ]);
}

/**
 * Get document type options
 */
function getDocumentTypeOptions($pdo) {
    $sql = "SELECT * FROM document_type_options WHERE is_active = 1 ORDER BY type_name ASC";
    $stmt = $pdo->query($sql);

    $options = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $options[] = [
            'id' => (int)$row['id'],
            'type_name' => $row['type_name'],
            'is_active' => (bool)$row['is_active'],
            'created_at' => $row['created_at']
        ];
    }

    sendJsonResponse(['success' => true, 'data' => $options]);
}

/**
 * Add document type option
 */
function addDocumentTypeOption($pdo, $input) {
    $typeName = trim($input['type_name'] ?? '');
    
    if (empty($typeName)) {
        sendJsonResponse(['success' => false, 'message' => 'Document type name is required'], 400);
    }

    // Check if already exists
    $checkSQL = "SELECT id FROM document_type_options WHERE type_name = :type_name";
    $checkStmt = $pdo->prepare($checkSQL);
    $checkStmt->execute([':type_name' => $typeName]);
    if ($checkStmt->fetch()) {
        sendJsonResponse(['success' => false, 'message' => 'Document type already exists'], 400);
    }

    $sql = "INSERT INTO document_type_options (type_name) VALUES (:type_name)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':type_name' => $typeName]);
    $typeId = $pdo->lastInsertId();

    sendJsonResponse([
        'success' => true,
        'message' => 'Document type added successfully',
        'type_id' => $typeId
    ]);
}

/**
 * Delete an attachment
 */
function deleteAttachment($pdo, $input) {
    $attachmentId = intval($input['attachment_id'] ?? 0);
    
    if (!$attachmentId) {
        sendJsonResponse(['success' => false, 'message' => 'Attachment ID is required'], 400);
    }

    // Get file path
    $sql = "SELECT file_path FROM document_receipt_attachments WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $attachmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
        sendJsonResponse(['success' => false, 'message' => 'Attachment not found'], 404);
    }

    $filePath = $row['file_path'];

    // Delete from database
    $delSQL = "DELETE FROM document_receipt_attachments WHERE id = :id";
    $delStmt = $pdo->prepare($delSQL);
    $delStmt->execute([':id' => $attachmentId]);

    // Delete physical file
    if (file_exists($filePath)) {
        unlink($filePath);
    }

    sendJsonResponse([
        'success' => true,
        'message' => 'Attachment deleted successfully'
    ]);
}

/**
 * Get receipts available for return (currently with company)
 */
function getAvailableForReturn($pdo, $input) {
    $customerName = $input['customer_name'] ?? null;

    $sql = "SELECT 
                dr.*,
                s.staff_name as received_by_name
            FROM document_receipts dr
            LEFT JOIN staff s ON dr.received_by_id = s.staff_id
            WHERE dr.status = 'with_company' 
            AND dr.transaction_type = 'received'";
    
    $params = [];
    
    if ($customerName) {
        $sql .= " AND dr.customer_name LIKE :customer_name";
        $params[':customer_name'] = "%$customerName%";
    }
    
    $sql .= " ORDER BY dr.created_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $receipts = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Get document types
        $docTypesSQL = "SELECT * FROM document_receipt_items WHERE receipt_id = :receipt_id";
        $docStmt = $pdo->prepare($docTypesSQL);
        $docStmt->execute([':receipt_id' => $row['id']]);
        
        $documentTypes = [];
        while ($docRow = $docStmt->fetch(PDO::FETCH_ASSOC)) {
            $documentTypes[] = [
                'id' => (int)$docRow['id'],
                'document_type_name' => $docRow['document_type_name'],
                'quantity' => (int)$docRow['quantity'],
                'description' => $docRow['description']
            ];
        }

        $receipts[] = [
            'id' => (int)$row['id'],
            'receipt_number' => $row['receipt_number'],
            'customer_name' => $row['customer_name'],
            'customer_phone' => $row['customer_phone'],
            'customer_email' => $row['customer_email'],
            'transaction_date' => $row['transaction_date'],
            'label' => $row['label'],
            'received_by' => $row['received_by_name'],
            'document_types' => $documentTypes
        ];
    }

    sendJsonResponse(['success' => true, 'data' => $receipts]);
}

/**
 * Get receipt for printing
 */
function getReceiptForPrint($pdo, $input) {
    getReceipt($pdo, $input);
}

/**
 * Get customers for dropdown
 */
function getCustomers($pdo) {
    $sql = "SELECT customer_id, customer_name, customer_phone, customer_email 
            FROM customer 
            WHERE status = 1 
            ORDER BY customer_name ASC 
            LIMIT 500";
    
    $stmt = $pdo->query($sql);
    
    $customers = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $customers[] = [
            'customer_id' => (int)$row['customer_id'],
            'customer_name' => $row['customer_name'],
            'customer_phone' => $row['customer_phone'],
            'customer_email' => $row['customer_email']
        ];
    }
    
    sendJsonResponse(['success' => true, 'data' => $customers]);
}
?>

