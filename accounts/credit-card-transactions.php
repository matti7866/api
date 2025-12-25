<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once(__DIR__ . '/../../connection.php');
    require_once(__DIR__ . '/../auth/JWTHelper.php');
    
    // Check authentication
    $user_id = null;
    $role_id = null;
    
    if (isset($_SESSION['user_id'])) {
        $user_id = $_SESSION['user_id'];
        $role_id = $_SESSION['role_id'] ?? null;
    } else {
        $authHeader = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
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
    
    if (!$user_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];
    
    // GET transactions for a credit card (includes both manual transactions and residence charges)
    if ($method === 'GET' || isset($_POST['GetTransactions'])) {
        $accountId = $_POST['account_id'] ?? $_GET['account_id'] ?? null;
        
        if (!$accountId) {
            http_response_code(400);
            echo json_encode(['error' => 'account_id is required']);
            exit;
        }
        
        $startDate = $_POST['start_date'] ?? null;
        $endDate = $_POST['end_date'] ?? null;
        $limit = isset($_POST['limit']) ? (int)$_POST['limit'] : 100;
        
        // Get manual transactions from credit_card_transactions table
        $query1 = "SELECT 
            t.transaction_id,
            t.account_id,
            t.transaction_date,
            t.transaction_type,
            t.amount,
            t.currency_id,
            cur.currencyName,
            t.category,
            t.merchant,
            t.description,
            t.reference,
            t.notes,
            t.created_by,
            s.staff_name as created_by_name,
            'manual' as source
        FROM credit_card_transactions t
        LEFT JOIN currency cur ON t.currency_id = cur.currencyID
        LEFT JOIN staff s ON t.created_by = s.staff_id
        WHERE t.account_id = ?";
        
        // Get residence transactions where this credit card was used
        $query2 = "SELECT 
            NULL as transaction_id,
            ? as account_id,
            COALESCE(offerLetterDate, datetime) as transaction_date,
            'debit' as transaction_type,
            offerLetterCost as amount,
            offerLetterCostCur as currency_id,
            c.currencyName,
            'visa_processing' as category,
            NULL as merchant,
            CONCAT('Offer Letter - Residence #', residenceID, ' - ', passenger_name) as description,
            CONCAT('RES', residenceID) as reference,
            NULL as notes,
            StepOneUploader as created_by,
            s.staff_name as created_by_name,
            'residence' as source
        FROM residence r
        LEFT JOIN currency c ON r.offerLetterCostCur = c.currencyID
        LEFT JOIN staff s ON r.StepOneUploader = s.staff_id
        WHERE offerLetterAccount = ? AND offerLetterCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(insuranceDate, datetime),
            'debit',
            insuranceCost,
            insuranceCur,
            c.currencyName,
            'insurance',
            NULL,
            CONCAT('Insurance - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepThreeUploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.insuranceCur = c.currencyID
        LEFT JOIN staff s ON r.stepThreeUploader = s.staff_id
        WHERE insuranceAccount = ? AND insuranceCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(laborCardDate, datetime),
            'debit',
            laborCardFee,
            laborCardCur,
            c.currencyName,
            'visa_processing',
            NULL,
            CONCAT('Labour Card - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepfourUploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.laborCardCur = c.currencyID
        LEFT JOIN staff s ON r.stepfourUploader = s.staff_id
        WHERE laborCardAccount = ? AND laborCardFee > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(eVisaDate, datetime),
            'debit',
            eVisaCost,
            eVisaCur,
            c.currencyName,
            'visa_processing',
            NULL,
            CONCAT('E-Visa - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepfiveUploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.eVisaCur = c.currencyID
        LEFT JOIN staff s ON r.stepfiveUploader = s.staff_id
        WHERE eVisaAccount = ? AND eVisaCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(changeStatusDate, datetime),
            'debit',
            changeStatusCost,
            changeStatusCur,
            c.currencyName,
            'visa_processing',
            NULL,
            CONCAT('Change Status - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepsixUploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.changeStatusCur = c.currencyID
        LEFT JOIN staff s ON r.stepsixUploader = s.staff_id
        WHERE changeStatusAccount = ? AND changeStatusCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(medicalDate, datetime),
            'debit',
            medicalTCost,
            medicalTCur,
            c.currencyName,
            'medical',
            NULL,
            CONCAT('Medical - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepsevenUpploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.medicalTCur = c.currencyID
        LEFT JOIN staff s ON r.stepsevenUpploader = s.staff_id
        WHERE medicalAccount = ? AND medicalTCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(emiratesIDDate, datetime),
            'debit',
            emiratesIDCost,
            emiratesIDCur,
            c.currencyName,
            'visa_processing',
            NULL,
            CONCAT('Emirates ID - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepEightUploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.emiratesIDCur = c.currencyID
        LEFT JOIN staff s ON r.stepEightUploader = s.staff_id
        WHERE emiratesIDAccount = ? AND emiratesIDCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(visaStampingDate, datetime),
            'debit',
            visaStampingCost,
            visaStampingCur,
            c.currencyName,
            'visa_processing',
            NULL,
            CONCAT('Visa Stamping - Residence #', residenceID, ' - ', passenger_name),
            CONCAT('RES', residenceID),
            NULL,
            stepNineUpploader,
            s.staff_name,
            'residence'
        FROM residence r
        LEFT JOIN currency c ON r.visaStampingCur = c.currencyID
        LEFT JOIN staff s ON r.stepNineUpploader = s.staff_id
        WHERE visaStampingAccount = ? AND visaStampingCost > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            COALESCE(service_payment_date, service_date),
            'debit',
            netPrice,
            netCurrencyID,
            c.currencyName,
            'service',
            NULL,
            CONCAT('Service: ', s.serviceName, ' - ', sd.passenger_name, ' (Customer: ', cust.customer_name, ')'),
            CONCAT('SRV', serviceDetailsID),
            service_details,
            uploadedBy,
            st.staff_name,
            'service'
        FROM servicedetails sd
        LEFT JOIN service s ON sd.serviceID = s.serviceID
        LEFT JOIN customer cust ON sd.customer_id = cust.customer_id
        LEFT JOIN currency c ON sd.netCurrencyID = c.currencyID
        LEFT JOIN staff st ON sd.uploadedBy = st.staff_id
        WHERE sd.accoundID = ? AND sd.netPrice > 0
        
        UNION ALL
        
        SELECT 
            NULL,
            ?,
            e.time_creation,
            'debit',
            e.expense_amount,
            e.CurrencyID,
            c.currencyName,
            CONCAT('expense_', et.expense_type),
            NULL,
            CONCAT('Expense: ', et.expense_type, ' - ', e.expense_remark),
            CONCAT('EXP', e.expense_id),
            e.expense_remark,
            e.staff_id,
            st.staff_name,
            'expense'
        FROM expense e
        LEFT JOIN expense_type et ON e.expense_type_id = et.expense_type_id
        LEFT JOIN currency c ON e.CurrencyID = c.currencyID
        LEFT JOIN staff st ON e.staff_id = st.staff_id
        WHERE e.accountID = ? AND e.expense_amount > 0";
        
        // Combine both queries
        $finalQuery = "($query1) UNION ALL ($query2) ORDER BY transaction_date DESC LIMIT " . (int)$limit;
        
        $stmt = $pdo->prepare($finalQuery);
        // Bind parameters: 1 for manual transactions, then 9*2 for all sources (account_id twice per UNION)
        $stmt->execute([
            $accountId, // manual transactions
            $accountId, $accountId, // offer letter
            $accountId, $accountId, // insurance
            $accountId, $accountId, // labour card
            $accountId, $accountId, // evisa
            $accountId, $accountId, // change status
            $accountId, $accountId, // medical
            $accountId, $accountId, // emirates id
            $accountId, $accountId, // visa stamping
            $accountId, $accountId, // services
            $accountId, $accountId  // expenses
        ]);
        
        $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate running balance (need to process in chronological order, then reverse for display)
        // First, reverse the array to get oldest first
        $transactionsReversed = array_reverse($transactions);
        
        $balance = 0;
        foreach ($transactionsReversed as &$transaction) {
            if ($transaction['transaction_type'] === 'debit' || $transaction['transaction_type'] === 'fee' || $transaction['transaction_type'] === 'interest') {
                $balance += (float)$transaction['amount'];
            } else {
                $balance -= (float)$transaction['amount'];
            }
            $transaction['running_balance'] = $balance;
        }
        
        // Reverse back to newest first for display
        $transactions = array_reverse($transactionsReversed);
        
        echo json_encode($transactions);
        exit;
    }
    
    // ADD transaction (Debit/Credit)
    if ($method === 'POST' && isset($_POST['AddTransaction'])) {
        $accountId = $_POST['account_id'];
        $transactionType = $_POST['transaction_type']; // debit, credit, payment, refund, fee, interest
        $amount = (float)$_POST['amount'];
        $currencyId = isset($_POST['currency_id']) ? (int)$_POST['currency_id'] : null;
        $category = $_POST['category'] ?? null;
        $merchant = $_POST['merchant'] ?? null;
        $description = $_POST['description'] ?? null;
        $reference = $_POST['reference'] ?? null;
        $notes = $_POST['notes'] ?? null;
        $transactionDate = $_POST['transaction_date'] ?? date('Y-m-d H:i:s');
        
        // Validate
        if (!$accountId || !$transactionType || $amount <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid transaction data']);
            exit;
        }
        
        // Verify account is a credit card
        $checkQuery = "SELECT account_ID FROM accounts WHERE account_ID = ? AND accountType = 4";
        $stmt = $pdo->prepare($checkQuery);
        $stmt->execute([$accountId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Credit card not found']);
            exit;
        }
        
        // Insert transaction
        $query = "INSERT INTO credit_card_transactions (
            account_id,
            transaction_date,
            transaction_type,
            amount,
            currency_id,
            category,
            merchant,
            description,
            reference,
            notes,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($query);
        $result = $stmt->execute([
            $accountId,
            $transactionDate,
            $transactionType,
            $amount,
            $currencyId,
            $category,
            $merchant,
            $description,
            $reference,
            $notes,
            $user_id
        ]);
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Transaction added successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to add transaction']);
        }
        exit;
    }
    
    // DELETE transaction
    if (($method === 'DELETE' || isset($_POST['DeleteTransaction'])) && isset($_POST['transaction_id'])) {
        $transactionId = $_POST['transaction_id'];
        
        $query = "DELETE FROM credit_card_transactions WHERE transaction_id = ?";
        $stmt = $pdo->prepare($query);
        $result = $stmt->execute([$transactionId]);
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Transaction deleted successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete transaction']);
        }
        exit;
    }
    
    // GET balance for a credit card
    if (isset($_POST['GetBalance']) && isset($_POST['account_id'])) {
        $accountId = $_POST['account_id'];
        
        $query = "SELECT 
            SUM(CASE 
                WHEN transaction_type IN ('debit', 'fee', 'interest') THEN amount
                WHEN transaction_type IN ('credit', 'payment', 'refund') THEN -amount
                ELSE 0
            END) as current_balance
        FROM credit_card_transactions
        WHERE account_id = ?";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$accountId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $balance = (float)($result['current_balance'] ?? 0);
        
        // Get credit limit
        $limitQuery = "SELECT credit_limit FROM accounts WHERE account_ID = ?";
        $stmt = $pdo->prepare($limitQuery);
        $stmt->execute([$accountId]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        $creditLimit = (float)($account['credit_limit'] ?? 0);
        
        echo json_encode([
            'current_balance' => $balance,
            'credit_limit' => $creditLimit,
            'available_credit' => $creditLimit - $balance
        ]);
        exit;
    }
    
    // GET transaction categories
    if (isset($_POST['GetCategories'])) {
        $categories = [
            'food' => 'Food & Dining',
            'travel' => 'Travel',
            'office_supplies' => 'Office Supplies',
            'utilities' => 'Utilities',
            'fuel' => 'Fuel',
            'maintenance' => 'Maintenance',
            'visa_processing' => 'Visa Processing',
            'residence_processing' => 'Residence Processing',
            'insurance' => 'Insurance',
            'medical' => 'Medical',
            'entertainment' => 'Entertainment',
            'software' => 'Software/Subscriptions',
            'hardware' => 'Hardware/Equipment',
            'marketing' => 'Marketing',
            'rent' => 'Rent',
            'salary' => 'Salary',
            'commission' => 'Commission',
            'other' => 'Other'
        ];
        
        echo json_encode($categories);
        exit;
    }
    
    // If no action matched
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

unset($pdo);
?>

