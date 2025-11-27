<?php
/**
 * ============================================================================
 * ACCOUNT STATEMENT API - STANDALONE VERSION
 * ============================================================================
 * 
 * Endpoint: /api/accounts/statement.php
 * Method: POST/GET
 * Returns: JSON with account statement (all transactions for single account)
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
    $accountId = intval($_POST['accountId'] ?? $_GET['accountId'] ?? 0);
    $permanentResetDate = '2025-10-01'; // PERMANENT - ALWAYS use this
    $fromDate = $permanentResetDate; // FORCE to permanent reset date
    $toDate = $_POST['toDate'] ?? $_GET['toDate'] ?? date('Y-m-d');
    
    error_log("========== ACCOUNT STATEMENT API (STANDALONE) ==========");
    error_log("Account ID: $accountId");
    error_log("From Date (FORCED): $fromDate");
    error_log("To Date: $toDate");
    
    if (!$accountId) {
        ob_clean();
        http_response_code(400);
        echo json_encode(['error' => true, 'message' => 'Invalid account ID']);
        exit;
    }
    
    // ============== GET ALL CREDITS ==============
    $credits = [];
    
    // 1. Customer Payments (Regular)
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Customer Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(cp.remarks, 'General payment')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND (cp.is_tawjeeh_payment IS NULL OR cp.is_tawjeeh_payment = 0)
                        AND (cp.is_insurance_payment IS NULL OR cp.is_insurance_payment = 0)
                        AND (cp.is_insurance_fine_payment IS NULL OR cp.is_insurance_fine_payment = 0)
                        AND (cp.residenceFinePayment IS NULL OR cp.residenceFinePayment = 0)
                        AND (cp.residenceCancelPayment IS NULL OR cp.residenceCancelPayment = 0)
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 2. Tawjeeh Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Tawjeeh Payment' as transaction_type,
                            cp.tawjeeh_payment_amount as amount,
                            CONCAT('Tawjeeh payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_tawjeeh_payment = 1 
                        AND cp.tawjeeh_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 3. Insurance Payments (ILOE)
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Insurance Payment (ILOE)' as transaction_type,
                            cp.insurance_payment_amount as amount,
                            CONCAT('Insurance payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_insurance_payment = 1 
                        AND cp.insurance_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 4. Insurance Fine Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Insurance Fine Payment' as transaction_type,
                            cp.insurance_fine_payment_amount as amount,
                            CONCAT('Insurance fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_insurance_fine_payment = 1 
                        AND cp.insurance_fine_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 5. Residence Fine Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Residence Fine Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Residence fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Fine ID: ', IFNULL(cp.residenceFinePayment, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.residenceFinePayment IS NOT NULL 
                        AND cp.residenceFinePayment > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 6. Residence Cancellation Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Residence Cancellation Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Residence cancellation payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.residenceCancelPayment, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.residenceCancelPayment IS NOT NULL 
                        AND cp.residenceCancelPayment > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 7. Deposits
    $stmt = $pdo->prepare("SELECT 
                            d.datetime as date,
                            'Deposit' as transaction_type,
                            d.deposit_amount as amount,
                            CONCAT('Deposit - ', IFNULL(d.remarks, 'No remarks')) as description
                        FROM deposits d
                        WHERE d.accountID = :accountId 
                        AND d.accountID != 25
                        AND DATE(d.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY d.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 8. Transfer In
    $stmt = $pdo->prepare("SELECT 
                            t.datetime as date,
                            'Transfer In' as transaction_type,
                            t.amount as amount,
                            CONCAT('Transfer from Account ', t.from_account, ' - ', IFNULL(t.remarks, 'Transfer')) as description
                        FROM transfers t
                        WHERE t.to_account = :accountId 
                        AND DATE(t.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY t.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 9. Refunds
    $stmt = $pdo->prepare("SELECT 
                            r.datetime_created as date,
                            'Refund' as transaction_type,
                            r.amount as amount,
                            CONCAT('Refund - ', IFNULL(r.refund_type, 'No reason provided')) as description
                        FROM refunds r
                        WHERE r.account_id = :accountId 
                        AND DATE(r.datetime_created) BETWEEN :fromDate AND :toDate
                        ORDER BY r.datetime_created ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 10. Receivable Cheques
    $stmt = $pdo->prepare("SELECT 
                            c.date as date,
                            'Receivable Cheque' as transaction_type,
                            c.amount as amount,
                            CONCAT('Cheque from ', IFNULL(c.payee, 'Unknown'), ' - ', IFNULL(c.number, 'No number')) as description
                        FROM cheques c
                        WHERE c.account_id = :accountId 
                        AND c.type = 'receivable'
                        AND DATE(c.date) BETWEEN :fromDate AND :toDate
                        ORDER BY c.date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // ============== GET ALL DEBITS ==============
    $debits = [];
    
    // 1. Expenses
    $stmt = $pdo->prepare("SELECT 
                            e.time_creation as date,
                            'Expense' as transaction_type,
                            e.expense_amount as amount,
                            CONCAT('Expense: ', COALESCE(et.expense_type, 'Unknown Type'), ' - ', COALESCE(e.expense_remark, 'No remarks')) as description
                        FROM expense e
                        LEFT JOIN expense_type et ON e.expense_type_id = et.expense_type_id
                        WHERE e.accountID = :accountId 
                        AND e.accountID != 25
                        AND DATE(e.time_creation) BETWEEN :fromDate AND :toDate
                        ORDER BY e.time_creation ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 2. Withdrawals
    $stmt = $pdo->prepare("SELECT 
                            w.datetime as date,
                            'Withdrawal' as transaction_type,
                            w.withdrawal_amount as amount,
                            CONCAT('Withdrawal - ', IFNULL(w.remarks, 'No remarks')) as description
                        FROM withdrawals w
                        WHERE w.accountID = :accountId 
                        AND w.accountID != 25
                        AND DATE(w.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY w.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 3. Transfer Out
    $stmt = $pdo->prepare("SELECT 
                            t.datetime as date,
                            'Transfer Out' as transaction_type,
                            t.amount as amount,
                            CONCAT('Transfer to Account ', t.to_account, ' - ', IFNULL(t.remarks, 'Transfer')) as description
                        FROM transfers t
                        WHERE t.from_account = :accountId 
                        AND DATE(t.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY t.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 4. Supplier Payments
    $stmt = $pdo->prepare("SELECT 
                            p.time_creation as date,
                            'Supplier Payment' as transaction_type,
                            p.payment_amount as amount,
                            CONCAT('Payment to ', COALESCE(s.supp_name, 'Unknown Supplier'), ' - ', IFNULL(p.payment_detail, 'No remarks')) as description
                        FROM payment p
                        LEFT JOIN supplier s ON p.supp_id = s.supp_id
                        WHERE p.accountID = :accountId 
                        AND p.accountID != 25
                        AND DATE(p.time_creation) BETWEEN :fromDate AND :toDate
                        ORDER BY p.time_creation ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 5. Loans
    $stmt = $pdo->prepare("SELECT 
                            l.datetime as date,
                            'Loan' as transaction_type,
                            l.amount as amount,
                            CONCAT('Loan to ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(l.remarks, 'No remarks')) as description
                        FROM loan l
                        LEFT JOIN customer c ON l.customer_id = c.customer_id
                        WHERE l.accountID = :accountId 
                        AND l.accountID != 25
                        AND DATE(l.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY l.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 6. Salaries
    $stmt = $pdo->prepare("SELECT 
                            sal.datetime as date,
                            'Salary Payment' as transaction_type,
                            sal.salary_amount as amount,
                            CONCAT('Salary to ', COALESCE(s.staff_name, 'Unknown Staff'), ' - Account: ', sal.paymentType) as description
                        FROM salaries sal
                        LEFT JOIN staff s ON sal.employee_id = s.staff_id
                        WHERE sal.paymentType = :accountId 
                        AND sal.paymentType != 25
                        AND DATE(sal.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY sal.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 7. Payable Cheques
    $stmt = $pdo->prepare("SELECT 
                            c.paid_date as date,
                            'Payable Cheque' as transaction_type,
                            c.amount as amount,
                            CONCAT('Cheque to ', IFNULL(c.payee, 'Unknown'), ' - ', IFNULL(c.number, 'No number')) as description
                        FROM cheques c
                        WHERE c.account_id = :accountId 
                        AND c.type = 'payable'
                        AND c.paid_date IS NOT NULL
                        AND DATE(c.paid_date) BETWEEN :fromDate AND :toDate
                        ORDER BY c.paid_date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 8. Amer Transactions
    $stmt = $pdo->prepare("SELECT 
                            a.datetime as date,
                            'Amer Transaction' as transaction_type,
                            a.cost_price as amount,
                            CONCAT('Amer transaction for ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(a.passenger_name, 'No remarks')) as description
                        FROM amer a
                        LEFT JOIN customer c ON a.customer_id = c.customer_id
                        WHERE a.account_id = :accountId 
                        AND DATE(a.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY a.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 9. Tasheel Transactions
    $stmt = $pdo->prepare("SELECT 
                            tt.created_at as date,
                            'Tasheel Transaction' as transaction_type,
                            tt.cost as amount,
                            CONCAT('Tasheel transaction - ', IFNULL(tt.transaction_number, 'No remarks')) as description
                        FROM tasheel_transactions tt
                        WHERE tt.account_id = :accountId 
                        AND DATE(tt.created_at) BETWEEN :fromDate AND :toDate
                        ORDER BY tt.created_at ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 10. Service Payments
    $stmt = $pdo->prepare("SELECT 
                            sd.service_date as date,
                            'Service Payment' as transaction_type,
                            sd.salePrice as amount,
                            CONCAT('Service for ', COALESCE(sd.passenger_name, 'Unknown'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM servicedetails sd
                        LEFT JOIN customer c ON sd.customer_id = c.customer_id
                        WHERE sd.accoundID = :accountId 
                        AND sd.accoundID != 25
                        AND DATE(sd.service_date) BETWEEN :fromDate AND :toDate
                        ORDER BY sd.service_date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // ============== RESIDENCE COSTS (All 8 Steps) - INCLUDING SUPPLIER-CHARGED ==============
    $residenceSteps = [
        ['account' => 'offerLetterAccount', 'supplier' => 'offerLetterSupplier', 'cost' => 'offerLetterCost', 'date' => 'offerLetterDate', 'name' => 'Offer Letter'],
        ['account' => 'insuranceAccount', 'supplier' => 'insuranceSupplier', 'cost' => 'insuranceCost', 'date' => 'insuranceDate', 'name' => 'Insurance'],
        ['account' => 'laborCardAccount', 'supplier' => 'laborCardSupplier', 'cost' => 'laborCardFee', 'date' => 'laborCardDate', 'name' => 'Labor Card'],
        ['account' => 'eVisaAccount', 'supplier' => 'eVisaSupplier', 'cost' => 'eVisaCost', 'date' => 'eVisaDate', 'name' => 'E-Visa'],
        ['account' => 'changeStatusAccount', 'supplier' => 'changeStatusSupplier', 'cost' => 'changeStatusCost', 'date' => 'changeStatusDate', 'name' => 'Change Status'],
        ['account' => 'medicalAccount', 'supplier' => 'medicalSupplier', 'cost' => 'medicalTCost', 'date' => 'medicalDate', 'name' => 'Medical'],
        ['account' => 'emiratesIDAccount', 'supplier' => 'emiratesIDSupplier', 'cost' => 'emiratesIDCost', 'date' => 'emiratesIDDate', 'name' => 'Emirates ID'],
        ['account' => 'visaStampingAccount', 'supplier' => 'visaStampingSupplier', 'cost' => 'visaStampingCost', 'date' => 'visaStampingDate', 'name' => 'Visa Stamping']
    ];
    
    foreach ($residenceSteps as $step) {
        $stmt = $pdo->prepare("SELECT 
                                {$step['date']} as date,
                                'Residence - {$step['name']}' as transaction_type,
                                {$step['cost']} as amount,
                                CONCAT('Residence {$step['name']} for ', COALESCE(r.passenger_name, 'Unknown'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                                       CASE 
                                           WHEN r.{$step['supplier']} IS NOT NULL THEN ' [Charged to Supplier]'
                                           ELSE ''
                                       END) as description
                            FROM residence r
                            LEFT JOIN customer c ON r.customer_id = c.customer_id
                            WHERE ((r.{$step['account']} = :accountId AND r.{$step['account']} != 25) 
                                   OR (r.{$step['supplier']} IS NOT NULL AND r.{$step['account']} IS NULL))
                            AND r.{$step['cost']} > 0
                            AND r.{$step['date']} IS NOT NULL
                            AND DATE(r.{$step['date']}) BETWEEN :fromDate AND :toDate
                            ORDER BY r.{$step['date']} ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============== FAMILY RESIDENCE COSTS (5 Steps) ==============
    $familySteps = [
        ['account' => 'evisa_account', 'cost' => 'evisa_cost', 'date' => 'evisa_datetime', 'name' => 'E-Visa'],
        ['account' => 'change_status_account', 'cost' => 'change_status_cost', 'date' => 'change_status_datetime', 'name' => 'Change Status'],
        ['account' => 'medical_account', 'cost' => 'medical_cost', 'date' => 'medical_datetime', 'name' => 'Medical'],
        ['account' => 'eid_account', 'cost' => 'eid_cost', 'date' => 'eid_datetime', 'name' => 'Emirates ID'],
        ['account' => 'visa_stamping_account', 'cost' => 'visa_stamping_cost', 'date' => 'visa_stamping_datetime', 'name' => 'Visa Stamping']
    ];
    
    foreach ($familySteps as $step) {
        $stmt = $pdo->prepare("SELECT 
                                {$step['date']} as date,
                                'Dependent - {$step['name']}' as transaction_type,
                                {$step['cost']} as amount,
                                CONCAT('Dependent {$step['name']} for ', fr.passenger_name, ' (', fr.relation_type, ')') as description
                            FROM family_residence fr
                            WHERE fr.{$step['account']} = :accountId 
                            AND fr.{$step['account']} IS NOT NULL
                            AND fr.{$step['account']} != 25
                            AND fr.{$step['cost']} > 0
                            AND fr.{$step['date']} IS NOT NULL
                            AND DATE(fr.{$step['date']}) BETWEEN :fromDate AND :toDate
                            ORDER BY fr.{$step['date']} ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============== SPECIAL CHARGES ==============
    
    // Residence Fines
    $stmt = $pdo->prepare("SELECT 
                            rf.datetime as date,
                            'Residence - Fine' as transaction_type,
                            rf.fineAmount as amount,
                            CONCAT('Fine for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM residencefine rf
                        LEFT JOIN residence r ON rf.residenceID = r.residenceID
                        LEFT JOIN customer c ON r.customer_id = c.customer_id
                        WHERE rf.accountID = :accountId 
                        AND rf.accountID != 25
                        AND DATE(rf.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY rf.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // Tawjeeh Operations
    try {
        $stmt = $pdo->prepare("SELECT 
                                tc.charge_date as date,
                                'Tawjeeh Operation' as transaction_type,
                                tc.amount,
                                CONCAT('Tawjeeh performed for Residence ID: ', tc.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                            FROM tawjeeh_charges tc
                            LEFT JOIN residence r ON tc.residence_id = r.residenceID
                            WHERE tc.account_id = :accountId 
                            AND tc.account_id != 25
                            AND tc.status = 'paid'
                            AND DATE(tc.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY tc.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Tawjeeh charges query error: " . $e->getMessage());
    }
    
    // ILOE Insurance Operations
    try {
        $stmt = $pdo->prepare("SELECT 
                                ic.charge_date as date,
                                'ILOE Insurance Operation' as transaction_type,
                                ic.amount,
                                CONCAT('ILOE Insurance issued for Residence ID: ', ic.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                            FROM iloe_charges ic
                            LEFT JOIN residence r ON ic.residence_id = r.residenceID
                            WHERE ic.account_id = :accountId 
                            AND ic.account_id != 25
                            AND ic.charge_type = 'insurance'
                            AND ic.status = 'paid'
                            AND DATE(ic.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY ic.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("ILOE charges query error: " . $e->getMessage());
    }
    
    // eVisa Charges
    try {
        $stmt = $pdo->prepare("SELECT 
                                ec.charge_date as date,
                                'eVisa Charge' as transaction_type,
                                ec.amount,
                                CONCAT('eVisa application charge for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Residence ID: ', ec.residence_id, ')') as description
                            FROM evisa_charges ec
                            LEFT JOIN residence r ON ec.residence_id = r.residenceID
                            WHERE ec.account_id = :accountId 
                            AND ec.account_id != 25
                            AND ec.status = 'paid'
                            AND DATE(ec.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY ec.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("eVisa charges query error: " . $e->getMessage());
    }
    
    // Residence Custom Charges
    try {
        $stmt = $pdo->prepare("SELECT 
                                rcc.created_at as date,
                                'Residence - Extra Charge' as transaction_type,
                                rcc.net_cost as amount,
                                CONCAT('Extra Charge for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                            FROM residence_custom_charges rcc
                            LEFT JOIN residence r ON rcc.residence_id = r.residenceID
                            LEFT JOIN customer c ON r.customer_id = c.customer_id
                            WHERE rcc.account_id = :accountId 
                            AND rcc.account_id != 25
                            AND rcc.net_cost > 0
                            AND DATE(rcc.created_at) BETWEEN :fromDate AND :toDate
                            ORDER BY rcc.created_at ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Custom charges query error: " . $e->getMessage());
    }
    
    // Cancellation Transactions
    try {
        $stmt = $pdo->prepare("SELECT 
                                rc.internal_processed_at as date,
                                'Cancellation Transaction' as transaction_type,
                                rc.internal_net_cost as amount,
                                CONCAT('Internal cancellation processing for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                            FROM residence_cancellation rc
                            LEFT JOIN residence r ON rc.residence = r.residenceID
                            LEFT JOIN customer c ON rc.customer_id = c.customer_id
                            WHERE rc.internal_account_id = :accountId 
                            AND rc.internal_account_id != 25
                            AND rc.internal_processed = 1
                            AND rc.internal_net_cost > 0
                            AND rc.internal_processed_at IS NOT NULL
                            AND DATE(rc.internal_processed_at) BETWEEN :fromDate AND :toDate
                            ORDER BY rc.internal_processed_at ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Cancellation query error: " . $e->getMessage());
    }
    
    // ============== COMBINE AND PROCESS ==============
    $transactions = [];
    
    foreach ($credits as $c) {
        $transactions[] = [
            'date' => $c['date'],
            'type' => 'credit',
            'transaction_type' => $c['transaction_type'],
            'description' => $c['description'],
            'credit' => floatval($c['amount']),
            'debit' => 0
        ];
    }
    
    foreach ($debits as $d) {
        $transactions[] = [
            'date' => $d['date'],
            'type' => 'debit',
            'transaction_type' => $d['transaction_type'],
            'description' => $d['description'],
            'credit' => 0,
            'debit' => floatval($d['amount'])
        ];
    }
    
    // Sort by date (OLDEST FIRST for correct balance calculation)
    usort($transactions, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });
    
    // Calculate totals
    $totalCredits = array_sum(array_column($credits, 'amount'));
    $totalDebits = array_sum(array_column($debits, 'amount'));
    $balance = $totalCredits - $totalDebits;
    
    // Calculate running balance
    $runningBalance = 0;
    foreach ($transactions as &$transaction) {
        $runningBalance += ($transaction['credit'] - $transaction['debit']);
        $transaction['running_balance'] = round($runningBalance, 2);
    }
    
    // Sort by newest first for display
    usort($transactions, function($a, $b) {
        return strtotime($b['date']) - strtotime($a['date']);
    });
    
    error_log("Statement Results:");
    error_log("  - Total Credits: " . round($totalCredits, 2));
    error_log("  - Total Debits: " . round($totalDebits, 2));
    error_log("  - Balance: " . round($balance, 2));
    error_log("  - Transactions: " . count($transactions));
    error_log("====================================================");
    
    // Send response
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'transactions' => $transactions,
        'totalCredits' => round($totalCredits, 2),
        'totalDebits' => round($totalDebits, 2),
        'balance' => round($balance, 2),
        'currency' => 'AED'
    ]);
    
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    error_log("Error in statement API: " . $e->getMessage());
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage()
    ]);
}
?>

