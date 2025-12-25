<?php
/**
 * ============================================================================
 * ACCOUNT BALANCES API - STANDALONE VERSION
 * ============================================================================
 * 
 * Modern RESTful endpoint for fetching account balances
 * Endpoint: /api/accounts/balances.php
 * Method: POST/GET
 * Returns: JSON with all account balances
 */

require_once __DIR__ . '/../cors-headers.php';
ob_start();
date_default_timezone_set('Asia/Dubai');

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once(__DIR__ . '/../../connection.php');
    require_once(__DIR__ . '/../auth/JWTHelper.php');
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Authentication
$user_id = null;
$role_id = null;

if (isset($_SESSION['user_id']) && isset($_SESSION['role_id'])) {
    $user_id = $_SESSION['user_id'];
    $role_id = $_SESSION['role_id'];
} else {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$authHeader && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $decoded = JWTHelper::validateToken($matches[1]);
        if ($decoded && isset($decoded->data)) {
            $user_id = $decoded->data->staff_id ?? null;
            $role_id = $decoded->data->role_id ?? null;
            $_SESSION['user_id'] = $user_id;
            $_SESSION['role_id'] = $role_id;
        }
    }
}

if (!$user_id || !$role_id) {
    ob_clean();
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

// Permission check
try {
    $stmt = $pdo->prepare("SELECT * FROM `permission` WHERE role_id = :role_id AND page_name = 'Accounts'");
    $stmt->execute([':role_id' => $role_id]);
    $permission = $stmt->fetch(\PDO::FETCH_ASSOC);

    if (!$permission || $permission['select'] != 1) {
        ob_clean();
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
    }
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Permission check failed']);
    exit;
}

// ============== MAIN EXECUTION ==============

try {
    $resetDate = '2025-10-01'; // PERMANENT RESET DATE
    $toDate = date('Y-m-d');
    
    error_log("========== ACCOUNT BALANCES API (STANDALONE) ==========");
    error_log("Reset Date: $resetDate");
    error_log("To Date: $toDate");
    
    // Get all accounts (excluding ID 25)
    $accountsStmt = $pdo->query("SELECT account_ID, account_Name FROM accounts WHERE account_ID != 25 ORDER BY account_Name");
    $accounts = $accountsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $balancesArray = [];
    
    foreach ($accounts as $account) {
        $accountId = $account['account_ID'];
        
        // Calculate credits
        $totalCredits = 0;
        
        // Customer payments (regular)
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND DATE(datetime) BETWEEN ? AND ?
                               AND (is_tawjeeh_payment IS NULL OR is_tawjeeh_payment = 0)
                               AND (is_insurance_payment IS NULL OR is_insurance_payment = 0)
                               AND (is_insurance_fine_payment IS NULL OR is_insurance_fine_payment = 0)
                               AND (residenceFinePayment IS NULL OR residenceFinePayment = 0)
                               AND (residenceCancelPayment IS NULL OR residenceCancelPayment = 0)");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Tawjeeh payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(tawjeeh_payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND is_tawjeeh_payment = 1 
                               AND tawjeeh_payment_amount > 0 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Insurance payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(insurance_payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND is_insurance_payment = 1 
                               AND insurance_payment_amount > 0 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Insurance fine payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(insurance_fine_payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND is_insurance_fine_payment = 1 
                               AND insurance_fine_payment_amount > 0 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Residence fine payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND residenceFinePayment IS NOT NULL 
                               AND residenceFinePayment > 0 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Cancellation payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(payment_amount), 0) as total FROM customer_payments 
                               WHERE accountID = ? AND accountID != 25 AND residenceCancelPayment IS NOT NULL 
                               AND residenceCancelPayment > 0 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Deposits
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(deposit_amount), 0) as total FROM deposits 
                               WHERE accountID = ? AND accountID != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Transfer In
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transfers 
                               WHERE to_account = ? AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Refunds
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refunds 
                               WHERE account_id = ? AND account_id != 25 AND DATE(datetime_created) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalCredits += floatval($stmt->fetchColumn());
        
        // Calculate debits
        $totalDebits = 0;
        
        // Expenses
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(expense_amount), 0) as total FROM expense 
                               WHERE accountID = ? AND accountID != 25 AND DATE(time_creation) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Withdrawals
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(withdrawal_amount), 0) as total FROM withdrawals 
                               WHERE accountID = ? AND accountID != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Supplier payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(payment_amount), 0) as total FROM payment 
                               WHERE accountID = ? AND accountID != 25 AND DATE(time_creation) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Loans
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM loan 
                               WHERE accountID = ? AND accountID != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Service payments
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(salePrice), 0) as total FROM servicedetails 
                               WHERE accoundID = ? AND accoundID != 25 AND DATE(service_date) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Salaries
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(salary_amount), 0) as total FROM salaries 
                               WHERE paymentType = ? AND paymentType != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Transfer Out
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transfers 
                               WHERE from_account = ? AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Payable cheques
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM cheques 
                               WHERE account_id = ? AND account_id != 25 AND type = 'payable' 
                               AND cheque_status = 'paid' AND paid_date IS NOT NULL 
                               AND DATE(paid_date) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Amer transactions
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(cost_price), 0) as total FROM amer 
                               WHERE account_id = ? AND account_id != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Tasheel transactions
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(cost), 0) as total FROM tasheel_transactions 
                               WHERE account_id = ? AND account_id != 25 AND cost > 0 
                               AND DATE(created_at) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Tawjeeh operations
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM tawjeeh_charges 
                               WHERE account_id = ? AND account_id != 25 AND status = 'paid' 
                               AND DATE(charge_date) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // ILOE operations
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM iloe_charges 
                               WHERE account_id = ? AND account_id != 25 AND charge_type = 'insurance' 
                               AND status = 'paid' AND DATE(charge_date) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // eVisa charges
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM evisa_charges 
                               WHERE account_id = ? AND account_id != 25 AND status = 'paid' 
                               AND DATE(charge_date) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Residence steps (8 steps) - INCLUDING SUPPLIER-CHARGED
        $residenceSteps = [
            ['account' => 'offerLetterAccount', 'supplier' => 'offerLetterSupplier', 'cost' => 'offerLetterCost', 'date' => 'offerLetterDate'],
            ['account' => 'insuranceAccount', 'supplier' => 'insuranceSupplier', 'cost' => 'insuranceCost', 'date' => 'insuranceDate'],
            ['account' => 'laborCardAccount', 'supplier' => 'laborCardSupplier', 'cost' => 'laborCardFee', 'date' => 'laborCardDate'],
            ['account' => 'eVisaAccount', 'supplier' => 'eVisaSupplier', 'cost' => 'eVisaCost', 'date' => 'eVisaDate'],
            ['account' => 'changeStatusAccount', 'supplier' => 'changeStatusSupplier', 'cost' => 'changeStatusCost', 'date' => 'changeStatusDate'],
            ['account' => 'medicalAccount', 'supplier' => 'medicalSupplier', 'cost' => 'medicalTCost', 'date' => 'medicalDate'],
            ['account' => 'emiratesIDAccount', 'supplier' => 'emiratesIDSupplier', 'cost' => 'emiratesIDCost', 'date' => 'emiratesIDDate'],
            ['account' => 'visaStampingAccount', 'supplier' => 'visaStampingSupplier', 'cost' => 'visaStampingCost', 'date' => 'visaStampingDate']
        ];
        
        foreach ($residenceSteps as $step) {
            // Include items charged to either account OR supplier, but only for THIS account
            $stmt = $pdo->prepare("SELECT COALESCE(SUM({$step['cost']}), 0) as total FROM residence 
                                   WHERE (({$step['account']} = ? AND {$step['account']} != 25) 
                                          OR ({$step['supplier']} IS NOT NULL AND {$step['account']} IS NULL AND ? = ?))
                                   AND {$step['cost']} > 0 AND {$step['date']} IS NOT NULL 
                                   AND DATE({$step['date']}) BETWEEN ? AND ?");
            // Note: For supplier-charged items without account, they won't contribute to any specific account's balance
            // So we pass accountId twice in the query, but it won't match NULL
            $stmt->execute([$accountId, $accountId, 0, $resetDate, $toDate]);
            $totalDebits += floatval($stmt->fetchColumn());
        }
        
        // Residence fines
        $stmt = $pdo->prepare("SELECT COALESCE(SUM(fineAmount), 0) as total FROM residencefine 
                               WHERE accountID = ? AND accountID != 25 AND DATE(datetime) BETWEEN ? AND ?");
        $stmt->execute([$accountId, $resetDate, $toDate]);
        $totalDebits += floatval($stmt->fetchColumn());
        
        // Family residence steps (5 steps)
        $familySteps = [
            ['account' => 'evisa_account', 'cost' => 'evisa_cost', 'date' => 'evisa_datetime'],
            ['account' => 'change_status_account', 'cost' => 'change_status_cost', 'date' => 'change_status_datetime'],
            ['account' => 'medical_account', 'cost' => 'medical_cost', 'date' => 'medical_datetime'],
            ['account' => 'eid_account', 'cost' => 'eid_cost', 'date' => 'eid_datetime'],
            ['account' => 'visa_stamping_account', 'cost' => 'visa_stamping_cost', 'date' => 'visa_stamping_datetime']
        ];
        
        foreach ($familySteps as $step) {
            $stmt = $pdo->prepare("SELECT COALESCE(SUM({$step['cost']}), 0) as total FROM family_residence 
                                   WHERE {$step['account']} = ? AND {$step['account']} != 25 
                                   AND {$step['cost']} > 0 AND {$step['date']} IS NOT NULL 
                                   AND DATE({$step['date']}) BETWEEN ? AND ?");
            $stmt->execute([$accountId, $resetDate, $toDate]);
            $totalDebits += floatval($stmt->fetchColumn());
        }
        
        // Residence custom charges (if exists)
        try {
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(net_cost), 0) as total FROM residence_custom_charges 
                                   WHERE account_id = ? AND account_id != 25 AND net_cost > 0 
                                   AND DATE(created_at) BETWEEN ? AND ?");
            $stmt->execute([$accountId, $resetDate, $toDate]);
            $totalDebits += floatval($stmt->fetchColumn());
        } catch (Exception $e) {
            // Table doesn't exist
        }
        
        // Cancellation transactions (if columns exist)
        try {
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(internal_net_cost), 0) as total FROM residence_cancellation 
                                   WHERE internal_account_id = ? AND internal_account_id != 25 
                                   AND internal_processed = 1 AND internal_net_cost > 0 
                                   AND internal_processed_at IS NOT NULL 
                                   AND DATE(internal_processed_at) BETWEEN ? AND ?");
            $stmt->execute([$accountId, $resetDate, $toDate]);
            $totalDebits += floatval($stmt->fetchColumn());
        } catch (Exception $e) {
            // Columns don't exist
        }
        
        // Calculate balance
        $balance = $totalCredits - $totalDebits;
        
        // Only include accounts with activity
        if ($totalCredits > 0 || $totalDebits > 0) {
            $statusText = $balance > 0 ? 'Positive' : ($balance < 0 ? 'Negative' : 'Zero');
            
            $balancesArray[] = [
                'account_ID' => (int)$account['account_ID'],
                'account_Name' => $account['account_Name'],
                'total_credits' => (float)$totalCredits,
                'total_debits' => (float)$totalDebits,
                'balance' => (float)$balance,
                'currency' => 'AED',
                'status' => $statusText
            ];
        }
    }
    
    error_log("Total Accounts with Activity: " . count($balancesArray));
    error_log("====================================================");
    
    // Send response
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'balances' => $balancesArray,
        'count' => count($balancesArray),
        'reset_date' => $resetDate,
        'to_date' => $toDate
    ]);
    
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    error_log("Error in balances API: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => 'Failed to calculate balances',
        'message' => $e->getMessage()
    ]);
}
?>

