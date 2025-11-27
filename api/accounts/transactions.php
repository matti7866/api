<?php
/**
 * ============================================================================
 * ACCOUNTS TRANSACTIONS API - STANDALONE VERSION
 * ============================================================================
 * 
 * Modern RESTful endpoint for fetching detailed account transactions
 * Completely independent from accountsReportController.php
 * 
 * Endpoint: /api/accounts/transactions.php
 * Method: POST
 * Returns: JSON with all transaction types
 * 
 * Author: Extracted and modernized
 * Date: 2025-11-27
 */

// Include CORS headers FIRST
require_once __DIR__ . '/../cors-headers.php';

// Start output buffering
ob_start();

// Set timezone
date_default_timezone_set('Asia/Dubai');

// Start session
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once(__DIR__ . '/../../connection.php');
    require_once(__DIR__ . '/../auth/JWTHelper.php');
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// ============== AUTHENTICATION ==============
$user_id = null;
$role_id = null;

if (isset($_SESSION['user_id']) && isset($_SESSION['role_id'])) {
    $user_id = $_SESSION['user_id'];
    $role_id = $_SESSION['role_id'];
} else {
    // Try JWT token
    $authHeader = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    
    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        $decoded = JWTHelper::validateToken($token);
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

// ============== PERMISSION CHECK ==============
try {
    $stmt = $pdo->prepare("SELECT * FROM `permission` WHERE role_id = :role_id AND page_name = 'Accounts'");
    $stmt->bindParam(':role_id', $role_id);
    $stmt->execute();
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
    echo json_encode(['error' => 'Permission check failed: ' . $e->getMessage()]);
    exit;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get exchange rate from currency to AED
 */
function getExchangeRateToAED($currencyID, $pdo) {
    $currencyInfo = null;
    try {
        $stmt = $pdo->prepare("SELECT currencyName FROM currency WHERE currencyID = :currencyID");
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->execute();
        $currencyInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($currencyInfo && (strtoupper($currencyInfo['currencyName']) == 'AED' || 
                              strtoupper($currencyInfo['currencyName']) == 'DIRHAM' ||
                              $currencyID == 1)) {
            return 1.0;
        }
    } catch (Exception $e) {
        // Continue
    }
    
    try {
        $sql = "SELECT er.exchange_rate 
                FROM exchange_rates er
                WHERE er.from_currency_id = :currencyID 
                AND er.to_currency_id = 1
                AND er.is_active = 1
                ORDER BY er.effective_date DESC 
                LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':currencyID', $currencyID);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result && $result['exchange_rate'] > 0) {
            return floatval($result['exchange_rate']);
        }
        
        // Default rates
        $defaultRates = [
            'PKR' => 0.0135, 'PAKISTANI RUPEE' => 0.0135,
            'USD' => 3.67, 'DOLLAR' => 3.67,
            'EUR' => 4.0, 'EURO' => 4.0,
            'GBP' => 4.6, 'POUND' => 4.6,
            'INR' => 0.044, 'INDIAN RUPEE' => 0.044,
            'SAR' => 0.98, 'RIYAL' => 0.98
        ];
        
        if ($currencyInfo && $currencyInfo['currencyName']) {
            $currencyName = strtoupper($currencyInfo['currencyName']);
            if (isset($defaultRates[$currencyName])) {
                return $defaultRates[$currencyName];
            }
            foreach ($defaultRates as $key => $rate) {
                if (strpos($currencyName, $key) !== false || strpos($key, $currencyName) !== false) {
                    return $rate;
                }
            }
        }
        
        error_log("No exchange rate found for currency ID: $currencyID");
        return 1.0;
    } catch (Exception $e) {
        error_log("Error in getExchangeRateToAED: " . $e->getMessage());
        return 1.0;
    }
}

/**
 * Convert amount to AED
 */
function convertToAED($amount, $currencyID, $pdo) {
    if (!$amount || $amount <= 0) {
        return 0;
    }
    $exchangeRate = getExchangeRateToAED($currencyID, $pdo);
    return $amount * $exchangeRate;
}

// ============== MAIN EXECUTION ==============

try {
    // Get parameters
    $fromDate = $_POST['fromDate'] ?? $_GET['fromDate'] ?? date('Y-m-01');
    $toDate = $_POST['toDate'] ?? $_GET['toDate'] ?? date('Y-m-d');
    $accountFilter = $_POST['accountFilter'] ?? $_GET['accountFilter'] ?? '';
    $typeFilter = $_POST['typeFilter'] ?? $_GET['typeFilter'] ?? '';
    $resetDate = '2025-10-01'; // PERMANENT RESET DATE
    
    // ============== DEBUG LOGGING ==============
    error_log("========== ACCOUNTS TRANSACTIONS API (STANDALONE) ==========");
    error_log("Request Parameters:");
    error_log("  - From Date (Original): $fromDate");
    error_log("  - To Date: $toDate");
    error_log("  - Account Filter: " . ($accountFilter ?: 'ALL ACCOUNTS'));
    error_log("  - Type Filter: " . ($typeFilter ?: 'ALL TYPES'));
    error_log("  - Reset Date: $resetDate");
    error_log("  - User ID: $user_id");
    error_log("  - Role ID: $role_id");
    
    // Enforce reset date
    if ($resetDate && $resetDate > $fromDate) {
        $fromDate = $resetDate;
        error_log("  - Adjusted From Date (enforced): $fromDate");
    }
    
    // Initialize transactions array
    $transactions = [];
    
    // Get lookups for account and currency names
    $accounts = [];
    $result = $pdo->query("SELECT account_ID, account_Name FROM accounts");
    while($row = $result->fetch(PDO::FETCH_ASSOC)) {
        $accounts[$row['account_ID']] = $row['account_Name'];
    }
    
    $currencies = [];
    $result = $pdo->query("SELECT currencyID, currencyName FROM currency");
    while($row = $result->fetch(PDO::FETCH_ASSOC)) {
        $currencies[$row['currencyID']] = $row['currencyName'];
    }
    
    // Build account filter conditions
    $accountCondition = '';
    $accountCondition_refund = '';
    if($accountFilter) {
        $accountCondition = " AND accountID = :accountID";
        $accountCondition_refund = " AND ref.account_id = :accountID";
    }
    
    // Exclude account ID 25
    $excludeAccount25 = " AND accountID != 25";
    $excludeAccount25_service = " AND accoundID != 25";
    $excludeAccount25_salary = " AND sal.paymentType != 25";
    $excludeAccount25_amer = " AND a.account_id != 25";
    $excludeAccount25_tasheel = " AND tt.account_id != 25";
    $excludeAccount25_cheque = " AND c.account_id != 25";
    $excludeAccount25_refund = " AND ref.account_id != 25";
    
    // ============================================================================
    // CREDITS (Money Coming In)
    // ============================================================================
    
    // 1. CUSTOMER PAYMENTS - Regular (excluding categorized)
    if($typeFilter == '' || $typeFilter == 'credit') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Customer Payment' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.payment_amount as amount,
                    cp.currencyID,
                    cp.remarks,
                    cp.customer_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' (ID: ', cp.customer_id, ')') as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                AND (cp.is_tawjeeh_payment IS NULL OR cp.is_tawjeeh_payment = 0)
                AND (cp.is_insurance_payment IS NULL OR cp.is_insurance_payment = 0) 
                AND (cp.is_insurance_fine_payment IS NULL OR cp.is_insurance_fine_payment = 0)
                AND (cp.residenceFinePayment IS NULL OR cp.residenceFinePayment = 0)
                AND (cp.residenceCancelPayment IS NULL OR cp.residenceCancelPayment = 0)" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 2. TAWJEEH PAYMENTS
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'tawjeeh_payment') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Tawjeeh Payment' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.tawjeeh_payment_amount as amount,
                    cp.currencyID,
                    CONCAT('Tawjeeh - ', COALESCE(cp.remarks, '')) as remarks,
                    cp.PaymentFor as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Tawjeeh payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', cp.PaymentFor) as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.is_tawjeeh_payment = 1 
                AND cp.tawjeeh_payment_amount > 0
                AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 3. INSURANCE PAYMENTS (ILOE)
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'insurance_payment') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Insurance Payment (ILOE)' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.insurance_payment_amount as amount,
                    cp.currencyID,
                    CONCAT('Insurance - ', COALESCE(cp.remarks, '')) as remarks,
                    cp.PaymentFor as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Insurance payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', cp.PaymentFor) as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.is_insurance_payment = 1 
                AND cp.insurance_payment_amount > 0
                AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 4. INSURANCE FINE PAYMENTS
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'insurance_payment') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Insurance Fine Payment' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.insurance_fine_payment_amount as amount,
                    cp.currencyID,
                    CONCAT('Insurance Fine - ', COALESCE(cp.remarks, '')) as remarks,
                    cp.PaymentFor as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Insurance fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', cp.PaymentFor) as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.is_insurance_fine_payment = 1 
                AND cp.insurance_fine_payment_amount > 0
                AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 5. RESIDENCE FINE PAYMENTS
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'residence_fine') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Residence Fine Payment' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.payment_amount as amount,
                    cp.currencyID,
                    CONCAT('Residence Fine - ', COALESCE(cp.remarks, '')) as remarks,
                    cp.residenceFinePayment as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Residence fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Fine ID: ', cp.residenceFinePayment) as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.residenceFinePayment IS NOT NULL 
                AND cp.residenceFinePayment > 0
                AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 6. RESIDENCE CANCELLATION PAYMENTS
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'cancellation') {
        $sql = "SELECT 
                    cp.pay_id as id,
                    cp.datetime as transaction_date,
                    'Residence Cancellation Payment' as transaction_type,
                    'credit' as type_category,
                    cp.accountID,
                    cp.payment_amount as amount,
                    cp.currencyID,
                    CONCAT('Cancellation - ', COALESCE(cp.remarks, '')) as remarks,
                    cp.residenceCancelPayment as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Cancellation payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', cp.residenceCancelPayment) as description
                FROM customer_payments cp
                LEFT JOIN customer c ON cp.customer_id = c.customer_id
                LEFT JOIN staff s ON cp.staff_id = s.staff_id
                WHERE cp.residenceCancelPayment IS NOT NULL 
                AND cp.residenceCancelPayment > 0
                AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 7. DEPOSITS
    if($typeFilter == '' || $typeFilter == 'credit') {
        $sql = "SELECT 
                    d.deposit_ID as id,
                    d.datetime as transaction_date,
                    'Deposit' as transaction_type,
                    'credit' as type_category,
                    d.accountID,
                    d.deposit_amount as amount,
                    d.currencyID,
                    d.remarks,
                    d.depositBy as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Deposited by ', COALESCE(s.staff_name, 'Unknown Staff'), ' (ID: ', d.depositBy, ')') as description
                FROM deposits d
                LEFT JOIN staff s ON d.depositBy = s.staff_id
                WHERE DATE(d.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 8. REFUNDS
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'refund') {
        $sql = "SELECT 
                    ref.id as id,
                    ref.datetime_created as transaction_date,
                    'Refund' as transaction_type,
                    'credit' as type_category,
                    ref.account_id as accountID,
                    ref.amount,
                    1 as currencyID,
                    CONCAT('Refund Type: ', ref.refund_type, ' | Passenger: ', COALESCE(r.passenger_name, 'Unknown')) as remarks,
                    ref.residence_id as reference_id,
                    'System' as staff_name,
                    CONCAT('Refund (', ref.refund_type, ') - ', COALESCE(r.passenger_name, 'Unknown'), ' (Residence ID: ', ref.residence_id, ')') as description
                FROM refunds ref
                LEFT JOIN residence r ON ref.residence_id = r.residenceID
                WHERE DATE(ref.datetime_created) BETWEEN :fromDate AND :toDate" . $excludeAccount25_refund . $accountCondition_refund;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 9. RECEIVABLE CHEQUES
    if($typeFilter == '' || $typeFilter == 'credit' || $typeFilter == 'cheque') {
        $sql = "SELECT 
                    c.id,
                    c.date as transaction_date,
                    'Cheque Receivable' as transaction_type,
                    'credit' as type_category,
                    NULL as accountID,
                    c.amount,
                    1 as currencyID,
                    CONCAT('Bank: ', c.bank, ' - Status: ', COALESCE(c.cheque_status, 'pending')) as remarks,
                    c.number as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Receivable cheque from ', c.payee, ' - Bank: ', c.bank, ' (Cheque #', c.number, ')') as description
                FROM cheques c
                LEFT JOIN staff s ON c.created_by = s.staff_id
                WHERE c.type = 'receivable' 
                AND DATE(c.date) BETWEEN :fromDate AND :toDate";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============================================================================
    // DEBITS (Money Going Out)
    // ============================================================================
    
    // 10. LOANS
    if($typeFilter == '' || $typeFilter == 'debit') {
        $sql = "SELECT 
                    l.loan_id as id,
                    l.datetime as transaction_date,
                    'Loan' as transaction_type,
                    'debit' as type_category,
                    l.accountID,
                    l.amount,
                    l.currencyID,
                    l.remarks,
                    l.customer_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Loan to ', COALESCE(c.customer_name, 'Unknown Customer'), ' (ID: ', l.customer_id, ')') as description
                FROM loan l
                LEFT JOIN customer c ON l.customer_id = c.customer_id
                LEFT JOIN staff s ON l.staffID = s.staff_id
                WHERE DATE(l.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 11. EXPENSES
    if($typeFilter == '' || $typeFilter == 'debit') {
        $sql = "SELECT 
                    e.expense_id as id,
                    e.time_creation as transaction_date,
                    'Expense' as transaction_type,
                    'debit' as type_category,
                    e.accountID,
                    e.expense_amount as amount,
                    e.CurrencyID as currencyID,
                    e.expense_remark as remarks,
                    e.expense_type_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Expense: ', COALESCE(et.expense_type, 'Unknown Type'), ' (Type ID: ', e.expense_type_id, ')') as description
                FROM expense e
                LEFT JOIN expense_type et ON e.expense_type_id = et.expense_type_id
                LEFT JOIN staff s ON e.staff_id = s.staff_id
                WHERE DATE(e.time_creation) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 12. SUPPLIER PAYMENTS
    if($typeFilter == '' || $typeFilter == 'debit') {
        $sql = "SELECT 
                    p.payment_id as id,
                    p.time_creation as transaction_date,
                    'Supplier Payment' as transaction_type,
                    'debit' as type_category,
                    p.accountID,
                    p.payment_amount as amount,
                    p.currencyID,
                    p.payment_detail as remarks,
                    p.supp_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Payment to ', COALESCE(sp.supp_name, 'Unknown Supplier'), ' (ID: ', p.supp_id, ')') as description
                FROM payment p
                LEFT JOIN supplier sp ON p.supp_id = sp.supp_id
                LEFT JOIN staff s ON p.staff_id = s.staff_id
                WHERE DATE(p.time_creation) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 13. SERVICE PAYMENTS
    if($typeFilter == '' || $typeFilter == 'debit') {
        $sql = "SELECT 
                    sd.serviceDetailsID as id,
                    sd.service_date as transaction_date,
                    'Service Payment' as transaction_type,
                    'debit' as type_category,
                    sd.accoundID as accountID,
                    sd.salePrice as amount,
                    sd.saleCurrencyID as currencyID,
                    sd.service_details as remarks,
                    sd.customer_id as reference_id,
                    NULL as staff_name,
                    CONCAT('Service for ', COALESCE(sd.passenger_name, COALESCE(c.customer_name, 'Unknown Customer')), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM servicedetails sd
                LEFT JOIN customer c ON sd.customer_id = c.customer_id
                WHERE DATE(sd.service_date) BETWEEN :fromDate AND :toDate" . $excludeAccount25_service . str_replace('accountID', 'accoundID', str_replace(':accountID', ':serviceAccountID', $accountCondition));
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':serviceAccountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 14. WITHDRAWALS
    if($typeFilter == '' || $typeFilter == 'debit') {
        $sql = "SELECT 
                    w.withdrawal_ID as id,
                    w.datetime as transaction_date,
                    'Withdrawal' as transaction_type,
                    'debit' as type_category,
                    w.accountID,
                    w.withdrawal_amount as amount,
                    w.currencyID,
                    w.remarks,
                    w.withdrawalBy as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Withdrawal by ', COALESCE(s.staff_name, 'Unknown Staff'), ' (ID: ', w.withdrawalBy, ')') as description
                FROM withdrawals w
                LEFT JOIN staff s ON w.withdrawalBy = s.staff_id
                WHERE DATE(w.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25 . $accountCondition;
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':accountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 15. SALARIES
    if($typeFilter == '' || $typeFilter == 'debit' || $typeFilter == 'salary') {
        $sql = "SELECT 
                    sal.salary_id as id,
                    sal.datetime as transaction_date,
                    'Salary Payment' as transaction_type,
                    'debit' as type_category,
                    sal.paymentType as accountID,
                    sal.salary_amount as amount,
                    1 as currencyID,
                    'Salary payment' as remarks,
                    sal.employee_id as reference_id,
                    COALESCE(paidby.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Salary for ', COALESCE(emp.staff_name, 'Unknown Employee'), ' - Paid by ', COALESCE(paidby.staff_name, 'Unknown Staff')) as description
                FROM salaries sal
                LEFT JOIN staff emp ON sal.employee_id = emp.staff_id
                LEFT JOIN staff paidby ON sal.paid_by = paidby.staff_id
                WHERE DATE(sal.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25_salary . str_replace('accountID', 'sal.paymentType', str_replace(':accountID', ':salPaymentType', $accountCondition));
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':salPaymentType', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 16. PAYABLE CHEQUES
    if($typeFilter == '' || $typeFilter == 'debit' || $typeFilter == 'cheque') {
        $sql = "SELECT 
                    c.id,
                    c.paid_date as transaction_date,
                    'Cheque Payable' as transaction_type,
                    'debit' as type_category,
                    c.account_id as accountID,
                    c.amount,
                    1 as currencyID,
                    CONCAT('Paid on: ', DATE_FORMAT(c.paid_date, '%Y-%m-%d %H:%i'), ' - Cheque date: ', c.date) as remarks,
                    c.number as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Payable cheque to ', c.payee, ' (Cheque #', c.number, ' - Paid on ', DATE_FORMAT(c.paid_date, '%Y-%m-%d %H:%i'), ')') as description
                FROM cheques c
                LEFT JOIN staff s ON c.created_by = s.staff_id
                WHERE c.type = 'payable' 
                AND c.cheque_status = 'paid'
                AND c.paid_date IS NOT NULL
                AND DATE(c.paid_date) BETWEEN :fromDate AND :toDate" . $excludeAccount25_cheque . str_replace('accountID', 'c.account_id', str_replace(':accountID', ':chequeAccountID', $accountCondition));
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        if($accountFilter) {
            $stmt->bindParam(':chequeAccountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 17. AMER TRANSACTIONS
    if($typeFilter == '' || $typeFilter == 'debit' || $typeFilter == 'amer_transaction') {
        $sql = "SELECT 
                    a.id,
                    a.datetime as transaction_date,
                    'Amer Transaction' as transaction_type,
                    'debit' as type_category,
                    a.account_id as accountID,
                    a.cost_price as amount,
                    1 as currencyID,
                    CONCAT('Transaction #: ', a.transaction_number, ' - Application #: ', a.application_number) as remarks,
                    a.id as reference_id,
                    COALESCE(s.staff_name, 'Amer System') as staff_name,
                    CONCAT('Amer transaction for ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', COALESCE(at.name, 'Unknown Type'), ' (Cost: ', a.cost_price, ')') as description
                FROM amer a
                LEFT JOIN customer c ON a.customer_id = c.customer_id
                LEFT JOIN amer_types at ON a.type_id = at.id
                LEFT JOIN staff s ON a.created_by = s.staff_id
                WHERE DATE(a.datetime) >= :resetDate
                AND DATE(a.datetime) BETWEEN :fromDate AND :toDate" . $excludeAccount25_amer . str_replace('accountID', 'a.account_id', str_replace(':accountID', ':amerAccountID', $accountCondition));
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        if($accountFilter) {
            $stmt->bindParam(':amerAccountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 18. TASHEEL TRANSACTIONS
    if($typeFilter == '' || $typeFilter == 'debit' || $typeFilter == 'tasheel_transaction') {
        $sql = "SELECT 
                    tt.id,
                    tt.created_at as transaction_date,
                    'Tasheel Transaction' as transaction_type,
                    'debit' as type_category,
                    tt.account_id as accountID,
                    COALESCE(tt.cost, 0) as amount,
                    1 as currencyID,
                    CONCAT('Transaction #: ', tt.transaction_number, ' - Status: ', COALESCE(tt.mohrestatus, 'Pending')) as remarks,
                    tt.id as reference_id,
                    COALESCE(s.staff_name, 'Tasheel System') as staff_name,
                    CONCAT('Tasheel transaction for ', COALESCE(c.company_name, 'Unknown Company'), ' - ', COALESCE(t.name, 'Unknown Type'), ' (Cost: ', COALESCE(tt.cost, 0), ')') as description
                FROM tasheel_transactions tt
                LEFT JOIN company c ON tt.company_id = c.company_id
                LEFT JOIN transaction_type t ON tt.transaction_type_id = t.id
                LEFT JOIN staff s ON tt.created_by = s.staff_id
                WHERE DATE(tt.created_at) >= :resetDate
                AND DATE(tt.created_at) BETWEEN :fromDate AND :toDate" . $excludeAccount25_tasheel . str_replace('accountID', 'tt.account_id', str_replace(':accountID', ':tasheelAccountID', $accountCondition));
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        if($accountFilter) {
            $stmt->bindParam(':tasheelAccountID', $accountFilter);
        }
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============================================================================
    // TRANSFERS (Special - affects two accounts)
    // ============================================================================
    
    if($typeFilter == '' || $typeFilter == 'transfer') {
        $sql = "SELECT 
                    t.id,
                    t.datetime as transaction_date,
                    'Transfer Out' as transaction_type,
                    'transfer' as type_category,
                    t.from_account as accountID,
                    t.amount,
                    1 as currencyID,
                    t.remarks,
                    t.to_account as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Transfer to ', COALESCE(a_to.account_Name, 'Unknown Account'), ' (ID: ', t.to_account, ')') as description
                FROM transfers t
                LEFT JOIN accounts a_to ON t.to_account = a_to.account_ID
                LEFT JOIN staff s ON t.added_by = s.staff_id
                WHERE DATE(t.datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND (t.from_account = " . intval($accountFilter) . " OR t.to_account = " . intval($accountFilter) . ")";
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->execute();
        $transfersOut = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Create corresponding Transfer In records
        foreach($transfersOut as $transfer) {
            $transferIn = $transfer;
            $transferIn['transaction_type'] = 'Transfer In';
            $transferIn['accountID'] = $transfer['reference_id'];
            $transferIn['reference_id'] = $transfer['accountID'];
            $transferIn['staff_name'] = $transfer['staff_name'];
            $fromAccountName = isset($accounts[$transfer['accountID']]) ? $accounts[$transfer['accountID']] : 'Unknown Account';
            $transferIn['description'] = 'Transfer from ' . $fromAccountName . ' (ID: ' . $transfer['accountID'] . ')';
            $transactions[] = $transferIn;
        }
        
        $transactions = array_merge($transactions, $transfersOut);
    }
    
    // ============================================================================
    // RESIDENCE OPERATIONS (Debits)
    // ============================================================================
    
    // 19. TAWJEEH OPERATIONS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'tawjeeh_operation') {
        $sql = "SELECT 
                    tc.id as id,
                    tc.charge_date as transaction_date,
                    'Tawjeeh Operation' as transaction_type,
                    'debit' as type_category,
                    tc.account_id as accountID,
                    tc.amount,
                    tc.currency_id as currencyID,
                    tc.description as remarks,
                    tc.residence_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Tawjeeh performed for Residence ID: ', tc.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                FROM tawjeeh_charges tc
                LEFT JOIN residence r ON tc.residence_id = r.residenceID
                LEFT JOIN staff s ON tc.created_by = s.staff_id
                WHERE tc.status = 'paid'
                AND tc.account_id != 25
                AND DATE(tc.charge_date) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND tc.account_id = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 20. ILOE INSURANCE OPERATIONS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'iloe_operation') {
        $sql = "SELECT 
                    ic.id as id,
                    ic.charge_date as transaction_date,
                    'ILOE Insurance Operation' as transaction_type,
                    'debit' as type_category,
                    ic.account_id as accountID,
                    ic.amount,
                    ic.currency_id as currencyID,
                    ic.description as remarks,
                    ic.residence_id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('ILOE Insurance issued for Residence ID: ', ic.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                FROM iloe_charges ic
                LEFT JOIN residence r ON ic.residence_id = r.residenceID
                LEFT JOIN staff s ON ic.created_by = s.staff_id
                WHERE ic.charge_type = 'insurance' 
                AND ic.status = 'paid'
                AND ic.account_id != 25
                AND DATE(ic.charge_date) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND ic.account_id = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 21. EVISA CHARGES
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'evisa_charge') {
        $sql = "SELECT 
                    ec.id as id,
                    ec.charge_date as transaction_date,
                    'eVisa Charge' as transaction_type,
                    'debit' as type_category,
                    ec.account_id as accountID,
                    ec.amount,
                    ec.currency_id as currencyID,
                    ec.remarks,
                    ec.residence_id as reference_id,
                    'System' as staff_name,
                    CONCAT('eVisa application charge for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Residence ID: ', ec.residence_id, ')') as description
                FROM evisa_charges ec
                LEFT JOIN residence r ON ec.residence_id = r.residenceID
                WHERE ec.status = 'paid'
                AND ec.account_id != 25
                AND DATE(ec.charge_date) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND ec.account_id = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============================================================================
    // RESIDENCE TABLE - Multiple Step Costs
    // ============================================================================
    
    // 22. OFFER LETTER COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.offerLetterDate as transaction_date,
                    'Residence - Offer Letter' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.offerLetterAccount, 0) as accountID,
                    r.offerLetterCost as amount,
                    r.offerLetterCostCur as currencyID,
                    CONCAT('MB#: ', IFNULL(r.mb_number, 'N/A')) as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Offer Letter for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.offerLetterSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.offerLetterAccount IS NOT NULL OR r.offerLetterSupplier IS NOT NULL)
                AND r.offerLetterCost > 0
                AND r.offerLetterDate IS NOT NULL
                AND (r.offerLetterAccount IS NULL OR r.offerLetterAccount != 25)
                AND DATE(r.offerLetterDate) >= :resetDate
                AND DATE(r.offerLetterDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.offerLetterAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 23. INSURANCE COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.insuranceDate as transaction_date,
                    'Residence - Insurance' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.insuranceAccount, 0) as accountID,
                    r.insuranceCost as amount,
                    r.insuranceCur as currencyID,
                    CASE 
                        WHEN r.insuranceSupplier IS NOT NULL THEN 'Charged to Supplier'
                        ELSE 'Insurance charge'
                    END as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Insurance for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.insuranceSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.insuranceAccount IS NOT NULL OR r.insuranceSupplier IS NOT NULL)
                AND r.insuranceCost > 0
                AND r.insuranceDate IS NOT NULL
                AND (r.insuranceAccount IS NULL OR r.insuranceAccount != 25)
                AND DATE(r.insuranceDate) >= :resetDate
                AND DATE(r.insuranceDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.insuranceAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 24. LABOUR CARD COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.laborCardDate as transaction_date,
                    'Residence - Labour Card' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.laborCardAccount, 0) as accountID,
                    r.laborCardFee as amount,
                    r.laborCardCur as currencyID,
                    CONCAT('Labour Card ID: ', IFNULL(r.laborCardID, 'N/A'),
                           CASE 
                               WHEN r.laborCardSupplier IS NOT NULL THEN ' [Supplier charged]'
                               ELSE ''
                           END) as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Labour Card for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.laborCardSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.laborCardAccount IS NOT NULL OR r.laborCardSupplier IS NOT NULL)
                AND r.laborCardFee > 0
                AND r.laborCardDate IS NOT NULL
                AND (r.laborCardAccount IS NULL OR r.laborCardAccount != 25)
                AND DATE(r.laborCardDate) >= :resetDate
                AND DATE(r.laborCardDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.laborCardAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 25. E-VISA COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.eVisaDate as transaction_date,
                    'Residence - E-Visa' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.eVisaAccount, 0) as accountID,
                    r.eVisaCost as amount,
                    r.eVisaCur as currencyID,
                    CASE 
                        WHEN r.eVisaSupplier IS NOT NULL THEN 'Charged to Supplier'
                        ELSE 'E-Visa processing'
                    END as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('E-Visa for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.eVisaSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.eVisaAccount IS NOT NULL OR r.eVisaSupplier IS NOT NULL)
                AND r.eVisaCost > 0
                AND r.eVisaDate IS NOT NULL
                AND (r.eVisaAccount IS NULL OR r.eVisaAccount != 25)
                AND DATE(r.eVisaDate) >= :resetDate
                AND DATE(r.eVisaDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.eVisaAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 26. CHANGE STATUS COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.changeStatusDate as transaction_date,
                    'Residence - Change Status' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.changeStatusAccount, 0) as accountID,
                    r.changeStatusCost as amount,
                    r.changeStatusCur as currencyID,
                    CASE 
                        WHEN r.changeStatusSupplier IS NOT NULL THEN 'Charged to Supplier'
                        ELSE 'Status change processing'
                    END as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Change Status for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.changeStatusSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.changeStatusAccount IS NOT NULL OR r.changeStatusSupplier IS NOT NULL)
                AND r.changeStatusCost > 0
                AND r.changeStatusDate IS NOT NULL
                AND (r.changeStatusAccount IS NULL OR r.changeStatusAccount != 25)
                AND DATE(r.changeStatusDate) >= :resetDate
                AND DATE(r.changeStatusDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.changeStatusAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 27. MEDICAL COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.medicalDate as transaction_date,
                    'Residence - Medical' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.medicalAccount, 0) as accountID,
                    r.medicalTCost as amount,
                    r.medicalTCur as currencyID,
                    CASE 
                        WHEN r.medicalAccount IS NOT NULL THEN CONCAT('Account charged - Medical test')
                        WHEN r.medicalSupplier IS NOT NULL THEN CONCAT('Supplier charged - Medical test')
                        ELSE 'Medical test processing'
                    END as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Medical for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.medicalSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.medicalAccount IS NOT NULL OR r.medicalSupplier IS NOT NULL)
                AND r.medicalTCost > 0
                AND r.medicalDate IS NOT NULL
                AND (r.medicalAccount IS NULL OR r.medicalAccount != 25)
                AND DATE(r.medicalDate) >= :resetDate
                AND DATE(r.medicalDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.medicalAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 28. EMIRATES ID COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.emiratesIDDate as transaction_date,
                    'Residence - Emirates ID' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.emiratesIDAccount, 0) as accountID,
                    r.emiratesIDCost as amount,
                    r.emiratesIDCur as currencyID,
                    CONCAT('Emirates ID: ', IFNULL(r.EmiratesIDNumber, 'N/A'),
                           CASE 
                               WHEN r.emiratesIDSupplier IS NOT NULL THEN ' [Supplier charged]'
                               ELSE ''
                           END) as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Emirates ID for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.emiratesIDSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.emiratesIDAccount IS NOT NULL OR r.emiratesIDSupplier IS NOT NULL)
                AND r.emiratesIDCost > 0
                AND r.emiratesIDDate IS NOT NULL
                AND (r.emiratesIDAccount IS NULL OR r.emiratesIDAccount != 25)
                AND DATE(r.emiratesIDDate) >= :resetDate
                AND DATE(r.emiratesIDDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.emiratesIDAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 29. VISA STAMPING COSTS (including supplier-charged)
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    r.residenceID as id,
                    r.visaStampingDate as transaction_date,
                    'Residence - Visa Stamping' as transaction_type,
                    'debit' as type_category,
                    COALESCE(r.visaStampingAccount, 0) as accountID,
                    r.visaStampingCost as amount,
                    r.visaStampingCur as currencyID,
                    CONCAT('Expiry: ', IFNULL(r.expiry_date, 'N/A'),
                           CASE 
                               WHEN r.visaStampingSupplier IS NOT NULL THEN ' [Supplier charged]'
                               ELSE ''
                           END) as remarks,
                    r.residenceID as reference_id,
                    NULL as staff_name,
                    CONCAT('Visa Stamping for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                           CASE 
                               WHEN r.visaStampingSupplier IS NOT NULL THEN ' [Charged to Supplier]'
                               ELSE ''
                           END) as description
                FROM residence r
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                WHERE (r.visaStampingAccount IS NOT NULL OR r.visaStampingSupplier IS NOT NULL)
                AND r.visaStampingCost > 0
                AND r.visaStampingDate IS NOT NULL
                AND (r.visaStampingAccount IS NULL OR r.visaStampingAccount != 25)
                AND DATE(r.visaStampingDate) >= :resetDate
                AND DATE(r.visaStampingDate) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND r.visaStampingAccount = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 30. RESIDENCE FINES
    if ($typeFilter === '' || $typeFilter === 'debit') {
        $sql = "SELECT 
                    rf.residenceFineID as id,
                    rf.datetime as transaction_date,
                    'Residence - Fine' as transaction_type,
                    'debit' as type_category,
                    rf.accountID,
                    rf.fineAmount as amount,
                    rf.fineCurrencyID as currencyID,
                    'Residence fine imposed' as remarks,
                    rf.residenceFineID as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Fine for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM residencefine rf
                LEFT JOIN residence r ON rf.residenceID = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON rf.imposedBy = s.staff_id
                WHERE rf.accountID != 25
                AND DATE(rf.datetime) >= :resetDate
                AND DATE(rf.datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND rf.accountID = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============================================================================
    // FAMILY RESIDENCE (DEPENDENTS) - All Steps
    // ============================================================================
    
    // 31. FAMILY - E-VISA COSTS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'family_residence') {
        $sql = "SELECT 
                    fr.id as id,
                    fr.evisa_datetime as transaction_date,
                    'Dependent - E-Visa' as transaction_type,
                    'debit' as type_category,
                    fr.evisa_account as accountID,
                    fr.evisa_cost as amount,
                    1 as currencyID,
                    CONCAT('Dependent: ', fr.passenger_name, ' (', fr.relation_type, ')') as remarks,
                    fr.id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Dependent E-Visa for ', fr.passenger_name, ' - Main Passenger: ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM family_residence fr
                LEFT JOIN residence r ON fr.residence_id = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON fr.evisa_submitter = s.staff_id
                WHERE fr.evisa_account IS NOT NULL 
                AND fr.evisa_account != 25
                AND fr.evisa_cost > 0
                AND fr.evisa_datetime IS NOT NULL
                AND DATE(fr.evisa_datetime) >= :resetDate
                AND DATE(fr.evisa_datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND fr.evisa_account = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 32. FAMILY - CHANGE STATUS COSTS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'family_residence') {
        $sql = "SELECT 
                    fr.id as id,
                    fr.change_status_datetime as transaction_date,
                    'Dependent - Change Status' as transaction_type,
                    'debit' as type_category,
                    fr.change_status_account as accountID,
                    fr.change_status_cost as amount,
                    1 as currencyID,
                    CONCAT('Dependent: ', fr.passenger_name, ' (', fr.relation_type, ')') as remarks,
                    fr.id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Dependent Change Status for ', fr.passenger_name, ' - Main Passenger: ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM family_residence fr
                LEFT JOIN residence r ON fr.residence_id = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON fr.change_status_submitter = s.staff_id
                WHERE fr.change_status_account IS NOT NULL 
                AND fr.change_status_account != 25
                AND fr.change_status_cost > 0
                AND fr.change_status_datetime IS NOT NULL
                AND DATE(fr.change_status_datetime) >= :resetDate
                AND DATE(fr.change_status_datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND fr.change_status_account = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 33. FAMILY - MEDICAL COSTS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'family_residence') {
        $sql = "SELECT 
                    fr.id as id,
                    fr.medical_datetime as transaction_date,
                    'Dependent - Medical' as transaction_type,
                    'debit' as type_category,
                    fr.medical_account as accountID,
                    fr.medical_cost as amount,
                    1 as currencyID,
                    CONCAT('Dependent: ', fr.passenger_name, ' (', fr.relation_type, ')') as remarks,
                    fr.id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Dependent Medical for ', fr.passenger_name, ' - Main Passenger: ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM family_residence fr
                LEFT JOIN residence r ON fr.residence_id = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON fr.medical_submitter = s.staff_id
                WHERE fr.medical_account IS NOT NULL 
                AND fr.medical_account != 25
                AND fr.medical_cost > 0
                AND fr.medical_datetime IS NOT NULL
                AND DATE(fr.medical_datetime) >= :resetDate
                AND DATE(fr.medical_datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND fr.medical_account = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 34. FAMILY - EMIRATES ID COSTS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'family_residence') {
        $sql = "SELECT 
                    fr.id as id,
                    fr.eid_datetime as transaction_date,
                    'Dependent - Emirates ID' as transaction_type,
                    'debit' as type_category,
                    fr.eid_account as accountID,
                    fr.eid_cost as amount,
                    1 as currencyID,
                    CONCAT('Dependent: ', fr.passenger_name, ' (', fr.relation_type, ')') as remarks,
                    fr.id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Dependent Emirates ID for ', fr.passenger_name, ' - Main Passenger: ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM family_residence fr
                LEFT JOIN residence r ON fr.residence_id = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON fr.eid_submitter = s.staff_id
                WHERE fr.eid_account IS NOT NULL 
                AND fr.eid_account != 25
                AND fr.eid_cost > 0
                AND fr.eid_datetime IS NOT NULL
                AND DATE(fr.eid_datetime) >= :resetDate
                AND DATE(fr.eid_datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND fr.eid_account = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // 35. FAMILY - VISA STAMPING COSTS
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'family_residence') {
        $sql = "SELECT 
                    fr.id as id,
                    fr.visa_stamping_datetime as transaction_date,
                    'Dependent - Visa Stamping' as transaction_type,
                    'debit' as type_category,
                    fr.visa_stamping_account as accountID,
                    fr.visa_stamping_cost as amount,
                    1 as currencyID,
                    CONCAT('Dependent: ', fr.passenger_name, ' (', fr.relation_type, ')') as remarks,
                    fr.id as reference_id,
                    COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                    CONCAT('Dependent Visa Stamping for ', fr.passenger_name, ' - Main Passenger: ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                FROM family_residence fr
                LEFT JOIN residence r ON fr.residence_id = r.residenceID
                LEFT JOIN customer c ON r.customer_id = c.customer_id
                LEFT JOIN staff s ON fr.visa_stamping_submitter = s.staff_id
                WHERE fr.visa_stamping_account IS NOT NULL 
                AND fr.visa_stamping_account != 25
                AND fr.visa_stamping_cost > 0
                AND fr.visa_stamping_datetime IS NOT NULL
                AND DATE(fr.visa_stamping_datetime) >= :resetDate
                AND DATE(fr.visa_stamping_datetime) BETWEEN :fromDate AND :toDate";
        
        if($accountFilter) {
            $sql .= " AND fr.visa_stamping_account = " . intval($accountFilter);
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':fromDate', $fromDate);
        $stmt->bindParam(':toDate', $toDate);
        $stmt->bindParam(':resetDate', $resetDate);
        $stmt->execute();
        $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============================================================================
    // SPECIAL/CONDITIONAL TABLES
    // ============================================================================
    
    // 36. RESIDENCE CUSTOM CHARGES (if table exists)
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'residence_extra') {
        try {
            $tableExists = true;
            try {
                $pdo->query("SELECT 1 FROM residence_custom_charges LIMIT 1");
            } catch (Exception $e) {
                $tableExists = false;
                error_log("WARNING: residence_custom_charges table does not exist - skipping");
            }
            
            if ($tableExists) {
                $sql = "SELECT 
                            rcc.id,
                            rcc.created_at as transaction_date,
                            'Residence - Extra Charge' as transaction_type,
                            'debit' as type_category,
                            rcc.account_id as accountID,
                            rcc.net_cost as amount,
                            rcc.currency_id as currencyID,
                            COALESCE(rcc.remarks, '') as remarks,
                            rcc.residence_id as reference_id,
                            'System' as staff_name,
                            CONCAT('Extra Charge for ', r.passenger_name, ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM residence_custom_charges rcc
                        LEFT JOIN residence r ON rcc.residence_id = r.residenceID
                        LEFT JOIN customer c ON r.customer_id = c.customer_id
                        WHERE rcc.account_id != 25
                        AND rcc.net_cost > 0
                        AND DATE(rcc.created_at) >= :resetDate
                        AND DATE(rcc.created_at) BETWEEN :fromDate AND :toDate";
                
                if($accountFilter) {
                    $sql .= " AND rcc.account_id = " . intval($accountFilter);
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':fromDate', $fromDate);
                $stmt->bindParam(':toDate', $toDate);
                $stmt->bindParam(':resetDate', $resetDate);
                $stmt->execute();
                $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
            }
        } catch (Exception $e) {
            error_log("Error in residence_custom_charges: " . $e->getMessage());
        }
    }
    
    // 37. CANCELLATION TRANSACTIONS (if columns exist)
    if ($typeFilter === '' || $typeFilter === 'debit' || $typeFilter === 'cancellation_transaction') {
        try {
            $columnsExist = true;
            try {
                $pdo->query("SELECT internal_processed FROM residence_cancellation LIMIT 1");
            } catch (Exception $e) {
                $columnsExist = false;
                error_log("WARNING: residence_cancellation.internal_processed column does not exist - skipping");
            }
            
            if ($columnsExist) {
                $sql = "SELECT 
                            CONCAT('RC_', rc.residence) as id,
                            rc.internal_processed_at as transaction_date,
                            'Cancellation Transaction' as transaction_type,
                            'debit' as type_category,
                            rc.internal_account_id as accountID,
                            rc.internal_net_cost as amount,
                            1 as currencyID,
                            'Internal cancellation processing' as remarks,
                            rc.residence as reference_id,
                            COALESCE(s.staff_name, 'Unknown Staff') as staff_name,
                            CONCAT('Internal cancellation processing for ', COALESCE(r.passenger_name, 'Unknown'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM residence_cancellation rc
                        LEFT JOIN residence r ON rc.residence = r.residenceID
                        LEFT JOIN customer c ON r.customer_id = c.customer_id
                        LEFT JOIN staff s ON rc.internal_processed_by = s.staff_id
                        WHERE rc.internal_processed = 1 
                        AND rc.internal_net_cost > 0
                        AND rc.internal_account_id IS NOT NULL
                        AND rc.internal_account_id != 25
                        AND rc.internal_processed_at IS NOT NULL
                        AND DATE(rc.internal_processed_at) >= :resetDate
                        AND DATE(rc.internal_processed_at) BETWEEN :fromDate AND :toDate";
                
                if($accountFilter) {
                    $sql .= " AND rc.internal_account_id = " . intval($accountFilter);
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':fromDate', $fromDate);
                $stmt->bindParam(':toDate', $toDate);
                $stmt->bindParam(':resetDate', $resetDate);
                $stmt->execute();
                $transactions = array_merge($transactions, $stmt->fetchAll(PDO::FETCH_ASSOC));
            }
        } catch (Exception $e) {
            error_log("Error in cancellation transactions: " . $e->getMessage());
        }
    }
    
    // ============================================================================
    // SORT AND CALCULATE TOTALS
    // ============================================================================
    
    // Sort by date (newest first)
    usort($transactions, function($a, $b) {
        return strtotime($b['transaction_date']) - strtotime($a['transaction_date']);
    });
    
    // Debug: Log transaction types
    $transactionTypes = [];
    foreach($transactions as $t) {
        $type = $t['transaction_type'];
        if (!isset($transactionTypes[$type])) {
            $transactionTypes[$type] = 0;
        }
        $transactionTypes[$type]++;
    }
    
    error_log("Transaction Types Found:");
    foreach($transactionTypes as $type => $count) {
        error_log("  - $type: $count transactions");
    }
    error_log("Total Transactions Before Processing: " . count($transactions));
    
    // Calculate totals (convert all to AED)
    $totalCredits = 0;
    $totalDebits = 0;
    $totalTransfers = 0;
    
    foreach($transactions as $transaction) {
        $amountInAED = convertToAED($transaction['amount'], $transaction['currencyID'], $pdo);
        
        if($transaction['type_category'] == 'credit') {
            $totalCredits += $amountInAED;
        } elseif($transaction['type_category'] == 'debit') {
            $totalDebits += $amountInAED;
        } elseif($transaction['type_category'] == 'transfer') {
            $totalTransfers += $amountInAED;
        }
    }
    
    $netBalance = $totalCredits - $totalDebits;
    
    // Prepare response array for React
    $transactionsArray = [];
    foreach($transactions as $transaction) {
        $accountName = isset($accounts[$transaction['accountID']]) ? $accounts[$transaction['accountID']] : 'Unknown Account';
        $currencyName = isset($currencies[$transaction['currencyID']]) ? $currencies[$transaction['currencyID']] : 'N/A';
        $amountInAED = convertToAED($transaction['amount'], $transaction['currencyID'], $pdo);
        
        $creditAmount = 0;
        $debitAmount = 0;
        
        if($transaction['type_category'] == 'credit') {
            $creditAmount = $amountInAED;
        } elseif($transaction['type_category'] == 'debit') {
            $debitAmount = $amountInAED;
        } elseif($transaction['type_category'] == 'transfer') {
            if($transaction['transaction_type'] == 'Transfer In') {
                $creditAmount = $amountInAED;
            } else {
                $debitAmount = $amountInAED;
            }
        }
        
        $transactionsArray[] = [
            'date' => $transaction['transaction_date'],
            'transaction_type' => $transaction['transaction_type'],
            'type_category' => $transaction['type_category'] ?? ($creditAmount > 0 ? 'credit' : 'debit'),
            'account' => $accountName,
            'description' => $transaction['description'] ?? '',
            'reference' => $transaction['reference_id'] ?? '',
            'credit' => $creditAmount,
            'debit' => $debitAmount,
            'currency_info' => 'AED' . ($transaction['currencyID'] != 1 ? ' (from ' . $currencyName . ')' : ''),
            'staff_name' => $transaction['staff_name'] ?? '',
            'remarks' => $transaction['remarks'] ?? ''
        ];
    }
    
    // Final response
    $response = [
        'success' => true,
        'transactions' => $transactionsArray,
        'summary' => [
            'totalCredits' => number_format($totalCredits, 2) . ' AED',
            'totalDebits' => number_format($totalDebits, 2) . ' AED',
            'totalTransfers' => number_format($totalTransfers, 2) . ' AED',
            'netBalance' => number_format($netBalance, 2) . ' AED'
        ],
        'meta' => [
            'fromDate' => $fromDate,
            'toDate' => $toDate,
            'accountFilter' => $accountFilter ?: 'all',
            'typeFilter' => $typeFilter ?: 'all',
            'resetDate' => $resetDate,
            'totalCount' => count($transactionsArray),
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ];
    
    // Final debug log
    error_log("Response Summary:");
    error_log("  - Total Credits: " . number_format($totalCredits, 2) . " AED");
    error_log("  - Total Debits: " . number_format($totalDebits, 2) . " AED");
    error_log("  - Total Transfers: " . number_format($totalTransfers, 2) . " AED");
    error_log("  - Net Balance: " . number_format($netBalance, 2) . " AED");
    error_log("  - Transactions in Response: " . count($transactionsArray));
    error_log("==========================================================");
    
    // Send response
    ob_clean();
    header('Content-Type: application/json');
    echo json_encode($response);
    
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    error_log("CRITICAL ERROR in transactions API: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch transactions',
        'message' => $e->getMessage()
    ]);
}
?>

