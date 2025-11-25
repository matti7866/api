<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token first
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

// Get database connection
// Database connection already available as $pdo from connection.php

try {
    // Handle file uploads
    $isMultipart = !empty($_FILES);
    
    // Read JSON input for non-file requests
    if (!$isMultipart) {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
    } else {
        $input = $_POST;
    }
    
    $action = $input['action'] ?? null;
    
    if (!$action) {
        http_response_code(400);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Action is required'
        ]);
    }
    
    // Get expense types
    if ($action == 'getExpenseTypes') {
        $stmt = $pdo->prepare("SELECT expense_type_id, expense_type FROM expense_type ORDER BY expense_type ASC");
        $stmt->execute();
        $expenseTypes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $expenseTypes
        ]);
    }
    
    // Create expense
    if ($action == 'createExpense') {
        $staff_id = $user['staff_id'];
        $expense_type_id = isset($input['expense_type_id']) ? trim($input['expense_type_id']) : null;
        $expense_amount = isset($input['expense_amount']) ? trim($input['expense_amount']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        $account_id = isset($input['account_id']) ? trim($input['account_id']) : null;
        $expense_remark = isset($input['expense_remark']) ? trim($input['expense_remark']) : '';
        $amount_type = isset($input['amount_type']) ? trim($input['amount_type']) : 'fixed';
        
        // Validate required fields
        if (!$expense_type_id || $expense_type_id == '-1') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense Type is required'
            ]);
        }
        
        if (!$expense_amount || $expense_amount == '') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense Amount is required'
            ]);
        }
        
        if (!$expense_remark || $expense_remark == '') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Remarks is required'
            ]);
        }
        
        if (!$account_id || $account_id == '-1') {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Account is required'
            ]);
        }
        
        if (!$currency_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Currency is required'
            ]);
        }
        
        // Handle file upload
        $expense_document = null;
        $original_name = null;
        
        if (!empty($_FILES['expense_document']['name'])) {
            // Validate file size (max 3MB = 3145728 bytes)
            if ($_FILES['expense_document']['size'] > 3145728) {
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'File size is greater than 3 MB. Make sure it should be less than 3 MB'
                ]);
            }
            
            $uploadResult = uploadExpenseDocument($_FILES['expense_document']);
            if ($uploadResult['success']) {
                $expense_document = $uploadResult['file_path'];
                $original_name = $_FILES['expense_document']['name'];
            } else {
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => $uploadResult['message']
                ]);
            }
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Please upload file for expense'
            ]);
        }
        
        $time_creation = date('Y-m-d H:i:s');
        
        $pdo->beginTransaction();
        
        try {
            $sql = "INSERT INTO `expense` (`staff_id`, `expense_type_id`, `expense_amount`, `CurrencyID`, `amount_type`, `expense_remark`, `time_creation`, `accountID`, `expense_document`, `original_name`) 
                    VALUES (:staff_id, :expense_type_id, :expense_amount, :CurrencyID, :amount_type, :expense_remark, :time_creation, :accountID, :expense_document, :original_name)";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':staff_id', $staff_id);
            $stmt->bindParam(':expense_type_id', $expense_type_id);
            $stmt->bindParam(':expense_amount', $expense_amount);
            $stmt->bindParam(':CurrencyID', $currency_id);
            $stmt->bindParam(':amount_type', $amount_type);
            $stmt->bindParam(':expense_remark', $expense_remark);
            $stmt->bindParam(':time_creation', $time_creation);
            $stmt->bindParam(':accountID', $account_id);
            $stmt->bindParam(':expense_document', $expense_document);
            $stmt->bindParam(':original_name', $original_name);
            
            if ($stmt->execute()) {
                $pdo->commit();
                JWTHelper::sendResponse([
                    'success' => true,
                    'message' => 'Expense created successfully'
                ]);
            } else {
                $pdo->rollBack();
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'Failed to create expense'
                ]);
            }
        } catch (PDOException $e) {
            $pdo->rollBack();
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Get expenses with filters
    if ($action == 'getExpenses') {
        $searchTerm = $input['search_term'] ?? 'DateWise';
        $fromDate = $input['from_date'] ?? null;
        $toDate = $input['to_date'] ?? null;
        $employeeId = $input['employee_id'] ?? null;
        
        if ($searchTerm == 'DateAndEmpWise' && $fromDate && $toDate && $employeeId) {
            $sql = "SELECT `expense_id`, staff_name, expense_type.expense_type, `expense_amount`,
                    currencyName, `expense_remark`, `time_creation`, account_Name, expense_document, original_name 
                    FROM `expense` 
                    INNER JOIN staff ON staff.staff_id = expense.staff_id 
                    INNER JOIN expense_type ON expense_type.expense_type_id = expense.expense_type_id 
                    INNER JOIN accounts ON accounts.account_ID = expense.accountID 
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE expense.staff_id = :employee_id AND DATE(time_creation) BETWEEN :fromdate AND :todate 
                    ORDER BY expense_id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':fromdate', $fromDate);
            $stmt->bindParam(':todate', $toDate);
            $stmt->bindParam(':employee_id', $employeeId);
        } else if ($searchTerm == 'DateWise' && $fromDate && $toDate) {
            $sql = "SELECT `expense_id`, staff_name, expense_type.expense_type, `expense_amount`,
                    currencyName, `expense_remark`, `time_creation`, account_Name, expense_document, original_name 
                    FROM `expense`
                    INNER JOIN staff ON staff.staff_id = expense.staff_id 
                    INNER JOIN expense_type ON expense_type.expense_type_id = expense.expense_type_id 
                    INNER JOIN accounts ON accounts.account_ID = expense.accountID 
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE DATE(time_creation) BETWEEN :fromdate AND :todate 
                    ORDER BY expense_id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':fromdate', $fromDate);
            $stmt->bindParam(':todate', $toDate);
        } else if ($searchTerm == 'EmpWise' && $employeeId) {
            $sql = "SELECT `expense_id`, staff_name, expense_type.expense_type, `expense_amount`,
                    currencyName, `expense_remark`, `time_creation`, account_Name, expense_document, original_name 
                    FROM `expense` 
                    INNER JOIN staff ON staff.staff_id = expense.staff_id 
                    INNER JOIN expense_type ON expense_type.expense_type_id = expense.expense_type_id 
                    INNER JOIN accounts ON accounts.account_ID = expense.accountID 
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE expense.staff_id = :employee_id 
                    ORDER BY expense_id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':employee_id', $employeeId);
        } else {
            // Default: get all expenses
            $sql = "SELECT `expense_id`, staff_name, expense_type.expense_type, `expense_amount`,
                    currencyName, `expense_remark`, `time_creation`, account_Name, expense_document, original_name 
                    FROM `expense`
                    INNER JOIN staff ON staff.staff_id = expense.staff_id 
                    INNER JOIN expense_type ON expense_type.expense_type_id = expense.expense_type_id 
                    INNER JOIN accounts ON accounts.account_ID = expense.accountID 
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    ORDER BY expense_id DESC 
                    LIMIT 100";
            $stmt = $pdo->prepare($sql);
        }
        
        $stmt->execute();
        $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $expenses
        ]);
    }
    
    // Get expense totals
    if ($action == 'getExpenseTotals') {
        $searchTerm = $input['search_term'] ?? 'DateWise';
        $fromDate = $input['from_date'] ?? null;
        $toDate = $input['to_date'] ?? null;
        $employeeId = $input['employee_id'] ?? null;
        
        if ($searchTerm == 'DateAndEmpWise' && $fromDate && $toDate && $employeeId) {
            $sql = "SELECT SUM(expense_amount) AS amount, currency.currencyName 
                    FROM `expense`
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE expense.staff_id = :staff_id AND DATE(time_creation) BETWEEN :fromdate AND :todate 
                    GROUP BY currency.currencyName 
                    HAVING amount != 0";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':fromdate', $fromDate);
            $stmt->bindParam(':todate', $toDate);
            $stmt->bindParam(':staff_id', $employeeId);
        } else if ($searchTerm == 'DateWise' && $fromDate && $toDate) {
            $sql = "SELECT SUM(expense_amount) AS amount, currency.currencyName 
                    FROM `expense`
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE DATE(time_creation) BETWEEN :fromdate AND :todate 
                    GROUP BY currency.currencyName 
                    HAVING amount != 0";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':fromdate', $fromDate);
            $stmt->bindParam(':todate', $toDate);
        } else if ($searchTerm == 'EmpWise' && $employeeId) {
            $sql = "SELECT SUM(expense_amount) AS amount, currency.currencyName 
                    FROM `expense`
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    WHERE expense.staff_id = :staff_id 
                    GROUP BY currency.currencyName 
                    HAVING amount != 0";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':staff_id', $employeeId);
        } else {
            $sql = "SELECT SUM(expense_amount) AS amount, currency.currencyName 
                    FROM `expense`
                    INNER JOIN currency ON currency.currencyID = expense.CurrencyID 
                    GROUP BY currency.currencyName 
                    HAVING amount != 0";
            $stmt = $pdo->prepare($sql);
        }
        
        $stmt->execute();
        $totals = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $totals
        ]);
    }
    
    // Get employees for filter
    if ($action == 'getEmployees') {
        $stmt = $pdo->prepare("SELECT staff_id, staff_name FROM staff ORDER BY staff_name ASC");
        $stmt->execute();
        $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $employees
        ]);
    }
    
    // Update expense
    if ($action == 'updateExpense') {
        $expense_id = isset($input['expense_id']) ? intval($input['expense_id']) : null;
        $expense_type_id = isset($input['expense_type_id']) ? trim($input['expense_type_id']) : null;
        $expense_amount = isset($input['expense_amount']) ? trim($input['expense_amount']) : null;
        $currency_id = isset($input['currency_id']) ? trim($input['currency_id']) : null;
        $account_id = isset($input['account_id']) ? trim($input['account_id']) : null;
        $expense_remark = isset($input['expense_remark']) ? trim($input['expense_remark']) : '';
        
        if (!$expense_id || !$expense_type_id || !$expense_amount || !$currency_id || !$account_id || !$expense_remark) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'All fields are required'
            ]);
        }
        
        $staff_id = $user['staff_id'];
        
        try {
            $sql = "UPDATE `expense` SET expense_type_id = :expense_type_id, expense_amount = :expense_amount,
                    CurrencyID = :CurrencyID, expense_remark = :expense_remark, staff_id = :staff_id, accountID = :accountID 
                    WHERE expense_id = :expense_id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':expense_type_id', $expense_type_id);
            $stmt->bindParam(':expense_amount', $expense_amount);
            $stmt->bindParam(':CurrencyID', $currency_id);
            $stmt->bindParam(':expense_remark', $expense_remark);
            $stmt->bindParam(':staff_id', $staff_id);
            $stmt->bindParam(':accountID', $account_id);
            $stmt->bindParam(':expense_id', $expense_id);
            
            if ($stmt->execute()) {
                JWTHelper::sendResponse([
                    'success' => true,
                    'message' => 'Expense updated successfully'
                ]);
            } else {
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'Failed to update expense'
                ]);
            }
        } catch (PDOException $e) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    // Get expense by ID for update
    if ($action == 'getExpense') {
        $expense_id = isset($input['expense_id']) ? intval($input['expense_id']) : null;
        
        if (!$expense_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense ID is required'
            ]);
        }
        
        $stmt = $pdo->prepare("SELECT * FROM expense WHERE expense_id = :expense_id");
        $stmt->bindParam(':expense_id', $expense_id);
        $stmt->execute();
        $expense = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($expense) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $expense
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense not found'
            ]);
        }
    }
    
    // Delete expense
    if ($action == 'deleteExpense') {
        $expense_id = isset($input['expense_id']) ? intval($input['expense_id']) : null;
        
        if (!$expense_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Expense ID is required'
            ]);
        }
        
        // Get file path before deleting
        $stmt = $pdo->prepare("SELECT expense_document FROM expense WHERE expense_id = :expense_id");
        $stmt->bindParam(':expense_id', $expense_id);
        $stmt->execute();
        $expense = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $pdo->beginTransaction();
        
        try {
            $stmt = $pdo->prepare("DELETE FROM expense WHERE expense_id = :expense_id");
            $stmt->bindParam(':expense_id', $expense_id);
            
            if ($stmt->execute()) {
                // Delete file if exists
                if ($expense && !empty($expense['expense_document']) && file_exists($expense['expense_document'])) {
                    unlink($expense['expense_document']);
                }
                
                $pdo->commit();
                JWTHelper::sendResponse([
                    'success' => true,
                    'message' => 'Expense deleted successfully'
                ]);
            } else {
                $pdo->rollBack();
                JWTHelper::sendResponse([
                    'success' => false,
                    'message' => 'Failed to delete expense'
                ]);
            }
        } catch (PDOException $e) {
            $pdo->rollBack();
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

// File upload function
function uploadExpenseDocument($file) {
    $allowedExtensions = ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'ppt', 'zip'];
    $maxSize = 3145728; // 3MB
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['success' => false, 'message' => 'File upload error'];
    }
    
    if ($file['size'] > $maxSize) {
        return ['success' => false, 'message' => 'File size exceeds 3MB limit'];
    }
    
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($extension, $allowedExtensions)) {
        return ['success' => false, 'message' => 'Invalid file type. Allowed: ' . implode(', ', $allowedExtensions)];
    }
    
    $f_name = pathinfo($file['name'], PATHINFO_FILENAME);
    $newFileName = md5($f_name . '_' . date('YmdHis')) . '.' . $extension;
    $uploadDir = __DIR__ . '/../../expense_documents/';
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $filePath = $uploadDir . $newFileName;
    
    if (move_uploaded_file($file['tmp_name'], $filePath)) {
        return [
            'success' => true,
            'file_path' => 'expense_documents/' . $newFileName
        ];
    }
    
    return ['success' => false, 'message' => 'Failed to move uploaded file'];
}

