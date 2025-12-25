<?php
// Include CORS headers (handles OPTIONS and sets CORS headers)
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once(__DIR__ . '/../../connection.php');
    require_once(__DIR__ . '/../auth/JWTHelper.php');
    
    // Check authentication - try session first, then JWT token
    $user_id = null;
    $role_id = null;
    
    if (isset($_SESSION['user_id'])) {
        // Use PHP session
        $user_id = $_SESSION['user_id'];
        $role_id = $_SESSION['role_id'] ?? null;
    } else {
        // Try JWT token from Authorization header
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
                
                // Create session from JWT token for future requests
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

    // Get request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Handle different operations
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    // GET all credit cards
    if ($method === 'GET' || isset($_POST['GetCreditCards'])) {
        $query = "SELECT 
            a.account_ID,
            a.account_Name,
            a.accountNum,
            a.card_holder_name,
            a.card_type,
            a.bank_name,
            a.credit_limit,
            a.billing_cycle_day,
            a.payment_due_day,
            a.interest_rate,
            a.expiry_date,
            a.is_active,
            a.notes,
            a.accountType,
            a.curID,
            c.currencyName,
            COALESCE((
                SELECT SUM(CASE 
                    WHEN transaction_type IN ('debit', 'fee', 'interest') THEN amount
                    WHEN transaction_type IN ('credit', 'payment', 'refund') THEN -amount
                    ELSE 0
                END)
                FROM credit_card_transactions 
                WHERE account_id = a.account_ID
            ), 0) + 
            COALESCE((
                SELECT 
                    COALESCE(SUM(CASE WHEN offerLetterAccount = a.account_ID THEN offerLetterCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN insuranceAccount = a.account_ID THEN insuranceCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN laborCardAccount = a.account_ID THEN laborCardFee ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN eVisaAccount = a.account_ID THEN eVisaCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN changeStatusAccount = a.account_ID THEN changeStatusCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN medicalAccount = a.account_ID THEN medicalTCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN emiratesIDAccount = a.account_ID THEN emiratesIDCost ELSE 0 END), 0) +
                    COALESCE(SUM(CASE WHEN visaStampingAccount = a.account_ID THEN visaStampingCost ELSE 0 END), 0)
                FROM residence r
            ), 0) + 
            COALESCE((
                SELECT SUM(netPrice)
                FROM servicedetails sd
                WHERE sd.accoundID = a.account_ID AND sd.netPrice > 0
            ), 0) + 
            COALESCE((
                SELECT SUM(expense_amount)
                FROM expense e
                WHERE e.accountID = a.account_ID AND e.expense_amount > 0
            ), 0) as current_balance,
            CONCAT(
                COALESCE(a.card_holder_name, 'Unknown'),
                CASE WHEN a.bank_name IS NOT NULL AND a.bank_name != '' THEN CONCAT(' - ', a.bank_name) ELSE '' END,
                CASE WHEN a.accountNum IS NOT NULL AND a.accountNum != '' THEN CONCAT(' - ****', a.accountNum) ELSE '' END
            ) as display_name
        FROM accounts a
        LEFT JOIN currency c ON a.curID = c.currencyID
        WHERE a.accountType = 4
        ORDER BY a.card_holder_name, a.bank_name ASC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $creditCards = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate available credit for each card
        foreach ($creditCards as &$card) {
            $card['current_balance'] = (float)$card['current_balance'];
            $card['credit_limit'] = (float)$card['credit_limit'];
            $card['available_credit'] = $card['credit_limit'] - $card['current_balance'];
            $card['is_active'] = (bool)$card['is_active'];
        }
        
        echo json_encode($creditCards);
        exit;
    }
    
    // GET single credit card
    if (($method === 'GET' && isset($_GET['id'])) || isset($_POST['GetSingleCreditCard'])) {
        $accountID = $_GET['id'] ?? $_POST['accountID'];
        
        $query = "SELECT 
            a.*,
            c.currencyName,
            COALESCE((
                SELECT SUM(CASE 
                    WHEN transaction_type IN ('debit', 'fee', 'interest') THEN amount
                    WHEN transaction_type IN ('credit', 'payment', 'refund') THEN -amount
                    ELSE 0
                END)
                FROM credit_card_transactions 
                WHERE account_id = a.account_ID
            ), 0) + 
            COALESCE((
                SELECT 
                    COALESCE(SUM(offerLetterCost), 0) +
                    COALESCE(SUM(insuranceCost), 0) +
                    COALESCE(SUM(laborCardFee), 0) +
                    COALESCE(SUM(eVisaCost), 0) +
                    COALESCE(SUM(changeStatusCost), 0) +
                    COALESCE(SUM(medicalTCost), 0) +
                    COALESCE(SUM(emiratesIDCost), 0) +
                    COALESCE(SUM(visaStampingCost), 0)
                FROM residence r
                WHERE r.offerLetterAccount = a.account_ID
                   OR r.insuranceAccount = a.account_ID
                   OR r.laborCardAccount = a.account_ID
                   OR r.eVisaAccount = a.account_ID
                   OR r.changeStatusAccount = a.account_ID
                   OR r.medicalAccount = a.account_ID
                   OR r.emiratesIDAccount = a.account_ID
                   OR r.visaStampingAccount = a.account_ID
            ), 0) + 
            COALESCE((
                SELECT SUM(netPrice)
                FROM servicedetails sd
                WHERE sd.accoundID = a.account_ID AND sd.netPrice > 0
            ), 0) + 
            COALESCE((
                SELECT SUM(expense_amount)
                FROM expense e
                WHERE e.accountID = a.account_ID AND e.expense_amount > 0
            ), 0) as current_balance
        FROM accounts a
        LEFT JOIN currency c ON a.curID = c.currencyID
        WHERE a.account_ID = ? AND a.accountType = 4";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$accountID]);
        $card = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($card) {
            $card['current_balance'] = (float)$card['current_balance'];
            $card['credit_limit'] = (float)$card['credit_limit'];
            $card['available_credit'] = $card['credit_limit'] - $card['current_balance'];
            $card['is_active'] = (bool)$card['is_active'];
            echo json_encode($card);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Credit card not found']);
        }
        exit;
    }
    
    // CREATE new credit card (POST)
    if ($method === 'POST' && isset($_POST['SaveCreditCard'])) {
        $account_name = $_POST['account_name'] ?? '';
        $account_number = $_POST['account_number'] ?? '';
        $card_holder_name = $_POST['card_holder_name'] ?? '';
        $card_type = $_POST['card_type'] ?? 'Visa';
        $bank_name = $_POST['bank_name'] ?? '';
        $credit_limit = $_POST['credit_limit'] ?? 0;
        $billing_cycle_day = $_POST['billing_cycle_day'] ?? 1;
        $payment_due_day = $_POST['payment_due_day'] ?? 21;
        $interest_rate = $_POST['interest_rate'] ?? 0;
        $currency_type = $_POST['currency_type'];
        $expiry_date = $_POST['expiry_date'] ?? '';
        $notes = $_POST['notes'] ?? '';
        $accountType = 4; // Credit Card
        
        // Validate required fields
        if (empty($account_name) || empty($card_holder_name) || empty($currency_type)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        // Add "Credit Card" prefix to account name
        $account_name = "Credit Card - " . $account_name;
        
        $query = "INSERT INTO accounts (
            account_Name, 
            accountNum, 
            card_holder_name,
            card_type,
            bank_name,
            credit_limit,
            billing_cycle_day,
            payment_due_day,
            interest_rate,
            expiry_date,
            notes,
            accountType, 
            curID,
            is_active,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())";
        
        $stmt = $pdo->prepare($query);
        $result = $stmt->execute([
            $account_name,
            $account_number,
            $card_holder_name,
            $card_type,
            $bank_name,
            $credit_limit,
            $billing_cycle_day,
            $payment_due_day,
            $interest_rate,
            $expiry_date,
            $notes,
            $accountType,
            $currency_type
        ]);
        
        if ($result) {
            echo "Success";
        } else {
            http_response_code(500);
            echo "Failed to create credit card";
        }
        exit;
    }
    
    // UPDATE credit card (PUT or POST)
    if (($method === 'PUT' || $method === 'POST') && isset($_POST['UpdateCreditCard'])) {
        $accountID = $_POST['accountID'];
        $updates = [];
        $params = [];
        
        if (isset($_POST['updaccount_name'])) {
            $updates[] = "account_Name = ?";
            $params[] = $_POST['updaccount_name'];
        }
        if (isset($_POST['updaccount_number'])) {
            $updates[] = "accountNum = ?";
            $params[] = $_POST['updaccount_number'];
        }
        if (isset($_POST['card_holder_name'])) {
            $updates[] = "card_holder_name = ?";
            $params[] = $_POST['card_holder_name'];
        }
        if (isset($_POST['card_type'])) {
            $updates[] = "card_type = ?";
            $params[] = $_POST['card_type'];
        }
        if (isset($_POST['bank_name'])) {
            $updates[] = "bank_name = ?";
            $params[] = $_POST['bank_name'];
        }
        if (isset($_POST['credit_limit'])) {
            $updates[] = "credit_limit = ?";
            $params[] = $_POST['credit_limit'];
        }
        if (isset($_POST['billing_cycle_day'])) {
            $updates[] = "billing_cycle_day = ?";
            $params[] = $_POST['billing_cycle_day'];
        }
        if (isset($_POST['payment_due_day'])) {
            $updates[] = "payment_due_day = ?";
            $params[] = $_POST['payment_due_day'];
        }
        if (isset($_POST['interest_rate'])) {
            $updates[] = "interest_rate = ?";
            $params[] = $_POST['interest_rate'];
        }
        if (isset($_POST['updcurrency_type'])) {
            $updates[] = "curID = ?";
            $params[] = $_POST['updcurrency_type'];
        }
        if (isset($_POST['expiry_date'])) {
            $updates[] = "expiry_date = ?";
            $params[] = $_POST['expiry_date'];
        }
        if (isset($_POST['is_active'])) {
            $updates[] = "is_active = ?";
            $params[] = $_POST['is_active'];
        }
        if (isset($_POST['notes'])) {
            $updates[] = "notes = ?";
            $params[] = $_POST['notes'];
        }
        
        if (empty($updates)) {
            echo "No fields to update";
            exit;
        }
        
        $updates[] = "updated_at = NOW()";
        $params[] = $accountID;
        
        $query = "UPDATE accounts SET " . implode(", ", $updates) . " WHERE account_ID = ? AND accountType = 4";
        
        $stmt = $pdo->prepare($query);
        $result = $stmt->execute($params);
        
        if ($result) {
            echo "Success";
        } else {
            http_response_code(500);
            echo "Failed to update credit card";
        }
        exit;
    }
    
    // DELETE credit card
    if (($method === 'DELETE' || isset($_POST['DeleteCreditCard'])) && isset($_POST['accountID'])) {
        $accountID = $_POST['accountID'];
        
        // Check if there are transactions
        $checkQuery = "SELECT COUNT(*) as count FROM account_transactions WHERE account_id = ?";
        $stmt = $pdo->prepare($checkQuery);
        $stmt->execute([$accountID]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['count'] > 0) {
            http_response_code(400);
            echo "Cannot delete credit card with existing transactions. Please deactivate it instead.";
            exit;
        }
        
        $query = "DELETE FROM accounts WHERE account_ID = ? AND accountType = 4";
        $stmt = $pdo->prepare($query);
        $result = $stmt->execute([$accountID]);
        
        if ($result) {
            echo "Success";
        } else {
            http_response_code(500);
            echo "Failed to delete credit card";
        }
        exit;
    }
    
    // GET credit card transactions
    if (isset($_POST['GetCreditCardTransactions'])) {
        $accountID = $_POST['accountID'];
        $startDate = $_POST['start_date'] ?? null;
        $endDate = $_POST['end_date'] ?? null;
        
        // Check if account_transactions table exists
        try {
            $query = "SELECT * FROM account_transactions WHERE account_id = ?";
            $params = [$accountID];
            
            if ($startDate) {
                $query .= " AND transaction_date >= ?";
                $params[] = $startDate;
            }
            if ($endDate) {
                $query .= " AND transaction_date <= ?";
                $params[] = $endDate;
            }
            
            $query .= " ORDER BY transaction_date DESC";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode($transactions);
        } catch (PDOException $e) {
            // Table doesn't exist yet, return empty array
            echo json_encode([]);
        }
        exit;
    }
    
    // GET currencies for dropdown
    if (isset($_POST['GetCurrencies'])) {
        $query = "SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC";
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $currencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($currencies);
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

// Close connection
unset($pdo);
?>

