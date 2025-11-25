<?php
/**
 * Cheques Management API
 * Endpoint: /api/cheque/manage.php
 * Handles add, update, delete, get, and pay operations
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check authentication
$user_id = null;
$role_id = null;

if (isset($_SESSION['user_id'])) {
    $user_id = $_SESSION['user_id'];
    $role_id = $_SESSION['role_id'] ?? null;
} else {
    $user = JWTHelper::verifyRequest();
    if ($user) {
        $user_id = $user['staff_id'] ?? null;
        $role_id = $user['role_id'] ?? null;
        
        if ($user_id) {
            $_SESSION['user_id'] = $user_id;
            $_SESSION['role_id'] = $role_id;
        }
    }
}

if (!$user_id) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

function filterInput($name) {
    return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : '')));
}

try {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    if (!in_array($action, ['addCheque', 'updateCheque', 'deleteCheque', 'getCheque', 'payCheque'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'status' => 'error',
            'message' => 'Invalid action'
        ], 400);
    }

    // Get Cheque
    if ($action == 'getCheque') {
        $id = (int)filterInput('id');

        $stmt = $pdo->prepare("SELECT * FROM cheques WHERE id = :id");
        $stmt->bindParam(":id", $id);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$result) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Cheque not found'
            ], 404);
        }

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Pay Cheque
    if ($action == 'payCheque') {
        $id = (int)filterInput('id');

        // Verify the cheque exists and is payable
        $stmt = $pdo->prepare("SELECT * FROM cheques WHERE id = :id AND type = 'payable'");
        $stmt->bindParam(":id", $id);
        $stmt->execute();
        $cheque = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cheque) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Cheque not found or not payable'
            ], 404);
        }

        // Check if already paid
        $currentStatus = isset($cheque['cheque_status']) ? $cheque['cheque_status'] : 'pending';
        if ($currentStatus == 'paid') {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Cheque is already marked as paid'
            ], 400);
        }

        // Update the cheque status to paid and set paid_date
        $today = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("UPDATE cheques SET cheque_status = 'paid', paid_date = :paid_date WHERE id = :id");
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":paid_date", $today);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Cheque marked as paid successfully'
        ]);
    }

    // Add Cheque
    if ($action == 'addCheque') {
        $date = filterInput('dateAdd');
        $number = filterInput('numberAdd');
        $type = filterInput('typeAdd');
        $amount = filterInput('amountAdd');
        $account_id = (int)filterInput('accountIDAdd');
        $bank = filterInput('bankAdd');
        $payee = filterInput('payeeAdd');
        $amountConfirm = filterInput('amountConfirmAdd');
        $filename = isset($_FILES['filename']) ? $_FILES['filename'] : null;

        $errors = [];
        
        if ($date == '') {
            $errors['dateAdd'] = 'Date is required';
        }
        if ($number == '') {
            $errors['numberAdd'] = 'Number is required';
        }
        if ($type == '') {
            $errors['typeAdd'] = 'Select type';
        } elseif (!in_array($type, ['payable', 'receivable'])) {
            $errors['typeAdd'] = 'Invalid type';
        } else {
            if ($type == 'payable' && $account_id == 0) {
                $errors['accountIDAdd'] = 'Account is required';
            } elseif ($type === 'receivable' && $bank == '') {
                $errors['bankAdd'] = 'Bank is required';
            }
        }

        if ($payee == '') {
            $errors['payeeAdd'] = 'Payee is required';
        }
        if ($amount == '') {
            $errors['amountAdd'] = 'Amount is required';
        } elseif ($amount != $amountConfirm) {
            $errors['amountConfirmAdd'] = 'Amounts do not match';
        }

        if (!$filename || $filename['name'] == '') {
            $errors['filename'] = 'Attachment is required';
        }

        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'form_errors',
                'errors' => $errors
            ], 400);
        }

        // Check if cheque number already exists
        $stmt = $pdo->prepare("SELECT * FROM cheques WHERE number = :number");
        $stmt->bindParam(":number", $number);
        $stmt->execute();
        
        if ($stmt->rowCount() > 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'form_errors',
                'errors' => ['numberAdd' => 'Check number already exists']
            ], 400);
        }

        // Upload attachment
        $tempFilename = time() . '_' . $filename['name'];
        $uploadDir = __DIR__ . '/../../attachment/cheques/';
        
        // Create directory if it doesn't exist
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        if (!move_uploaded_file($filename['tmp_name'], $uploadDir . $tempFilename)) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Failed to upload attachment'
            ], 500);
        }

        // Insert cheque
        $stmt = $pdo->prepare("
            INSERT INTO cheques (`type`, `number`, `date`, payee, amount, bank, account_id, filename, created_by) 
            VALUES (:type, :number, :date, :payee, :amount, :bank, :account_id, :filename, :created_by)
        ");
        $stmt->bindParam(":date", $date);
        $stmt->bindParam(":number", $number);
        $stmt->bindParam(":type", $type);
        $stmt->bindParam(":amount", $amount);
        $stmt->bindParam(":account_id", $account_id);
        $stmt->bindParam(":bank", $bank);
        $stmt->bindParam(":payee", $payee);
        $stmt->bindParam(":filename", $tempFilename);
        $stmt->bindParam(":created_by", $user_id);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Cheque added successfully'
        ]);
    }

    // Update Cheque
    if ($action == 'updateCheque') {
        $id = (int)filterInput('idEdit');
        $date = filterInput('dateEdit');
        $number = filterInput('numberEdit');
        $type = filterInput('typeEdit');
        $amount = filterInput('amountEdit');
        $account_id = (int)filterInput('accountIDEdit');
        $bank = filterInput('bankEdit');
        $payee = filterInput('payeeEdit');
        $amountConfirm = filterInput('amountConfirmEdit');
        $filename = isset($_FILES['filename']) ? $_FILES['filename'] : null;

        $errors = [];
        
        if ($date == '') {
            $errors['dateEdit'] = 'Date is required';
        }
        if ($number == '') {
            $errors['numberEdit'] = 'Number is required';
        }
        if ($type == '') {
            $errors['typeEdit'] = 'Select type';
        } elseif (!in_array($type, ['payable', 'receivable'])) {
            $errors['typeEdit'] = 'Invalid type';
        } else {
            if ($type == 'payable' && $account_id == 0) {
                $errors['accountIDEdit'] = 'Account is required';
            } elseif ($type === 'receivable' && $bank == '') {
                $errors['bankEdit'] = 'Bank is required';
            }
        }

        if ($payee == '') {
            $errors['payeeEdit'] = 'Payee is required';
        }
        if ($amount == '') {
            $errors['amountEdit'] = 'Amount is required';
        } elseif ($amount != $amountConfirm) {
            $errors['amountConfirmEdit'] = 'Amounts do not match';
        }

        // Load existing cheque
        $stmt = $pdo->prepare("SELECT * FROM cheques WHERE id = :id");
        $stmt->bindParam(":id", $id);
        $stmt->execute();
        $cheque = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$cheque) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'Cheque not found'
            ], 404);
        }

        // Check if cheque number already exists (excluding current)
        $stmt = $pdo->prepare("SELECT * FROM cheques WHERE number = :number AND id != :id");
        $stmt->bindParam(":number", $number);
        $stmt->bindParam(":id", $id);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $errors['numberEdit'] = 'Check number already exists';
        }

        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'success' => false,
                'status' => 'error',
                'message' => 'form_errors',
                'errors' => $errors
            ], 400);
        }

        // Handle file upload if provided
        $tempFilename = $cheque['filename'];
        if ($filename && $filename['name'] != '') {
            $tempFilename = time() . '_' . $filename['name'];
            $uploadDir = __DIR__ . '/../../attachment/cheques/';
            
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            
            if (!move_uploaded_file($filename['tmp_name'], $uploadDir . $tempFilename)) {
                JWTHelper::sendResponse([
                    'success' => false,
                    'status' => 'error',
                    'message' => 'Failed to upload attachment'
                ], 500);
            }
        }

        // Update cheque
        $stmt = $pdo->prepare("
            UPDATE cheques 
            SET `type` = :type, 
                `number` = :number,
                `date` = :date,	
                payee = :payee,	
                amount = :amount,	
                bank = :bank,	
                account_id = :account_id,
                filename = :filename
            WHERE id = :id
        ");
        $stmt->bindParam(":id", $id);
        $stmt->bindParam(":date", $date);
        $stmt->bindParam(":number", $number);
        $stmt->bindParam(":type", $type);
        $stmt->bindParam(":amount", $amount);
        $stmt->bindParam(":account_id", $account_id);
        $stmt->bindParam(":bank", $bank);
        $stmt->bindParam(":payee", $payee);
        $stmt->bindParam(":filename", $tempFilename);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Cheque updated successfully'
        ]);
    }

    // Delete Cheque
    if ($action == 'deleteCheque') {
        $id = (int)filterInput('id');

        $stmt = $pdo->prepare("DELETE FROM cheques WHERE id = :id");
        $stmt->bindParam(":id", $id);
        $stmt->execute();

        JWTHelper::sendResponse([
            'success' => true,
            'status' => 'success',
            'message' => 'Cheque deleted successfully'
        ]);
    }

} catch (Exception $e) {
    JWTHelper::sendResponse([
        'success' => false,
        'status' => 'error',
        'message' => 'Server Error: ' . $e->getMessage()
    ], 500);
}


