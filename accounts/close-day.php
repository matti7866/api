<?php
/**
 * ============================================================================
 * CLOSE DAY & EMAIL STATEMENT API
 * ============================================================================
 * 
 * Closes daily account balances and emails statement
 * 
 * Endpoint: /api/accounts/close-day.php
 * Method: POST
 * Returns: JSON with success status
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
    
    // Use mysqli connection (global $mysqli from connection.php)
    if (!isset($mysqli) || $mysqli->connect_error) {
        throw new Exception('Database connection not available');
    }
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
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
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (!empty($authHeader) && strpos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
        $decoded = JWTHelper::verifyToken($token);
        
        if ($decoded && isset($decoded['user_id'])) {
            $user_id = $decoded['user_id'];
            $role_id = $decoded['role_id'] ?? null;
        }
    }
}

if (!$user_id) {
    ob_clean();
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    // Log request for debugging
    error_log("Close Day Request - POST data: " . print_r($_POST, true));
    
    $date = $_POST['date'] ?? date('Y-m-d');
    $resetDate = $_POST['resetDate'] ?? '2025-10-01';
    $email = $_POST['email'] ?? '';

    error_log("Close Day - Date: $date, Reset: $resetDate, Email: $email");

    if (empty($email)) {
        throw new Exception('Email address is required');
    }

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email address');
    }
    
    error_log("Close Day - Starting balance calculation...");

    // Get all account balances
    $stmt = $mysqli->prepare("
        SELECT 
            a.account_ID,
            a.account_Name,
            a.accountNum,
            c.currencyName,
            c.currencyID,
            COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credits,
            COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) AS total_debits,
            COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) - 
            COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) AS balance
        FROM accounts a
        LEFT JOIN currency c ON a.curID = c.currencyID
        LEFT JOIN (
            -- All credit transactions
            SELECT accountID AS account_id, SUM(payment_amount) AS amount, 'credit' AS type
            FROM customer_payments
            WHERE DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY accountID
            
            UNION ALL
            
            SELECT accountID AS account_id, SUM(deposit_amount) AS amount, 'credit' AS type
            FROM deposits
            WHERE DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY accountID
            
            UNION ALL
            
            SELECT to_account AS account_id, SUM(amount) AS amount, 'credit' AS type
            FROM transfers
            WHERE DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY to_account
            
            UNION ALL
            
            SELECT account_id, SUM(amount) AS amount, 'credit' AS type
            FROM customer_wallet_transactions
            WHERE transaction_type IN ('deposit', 'refund')
            AND account_id IS NOT NULL
            AND DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY account_id
            
            UNION ALL
            
            -- All debit transactions
            SELECT accountID AS account_id, SUM(expense_amount) AS amount, 'debit' AS type
            FROM expense
            WHERE DATE(time_creation) >= ? AND DATE(time_creation) <= ?
            GROUP BY accountID
            
            UNION ALL
            
            SELECT accountID AS account_id, SUM(withdrawal_amount) AS amount, 'debit' AS type
            FROM withdrawals
            WHERE DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY accountID
            
            UNION ALL
            
            SELECT accountID AS account_id, SUM(payment_amount) AS amount, 'debit' AS type
            FROM payment
            WHERE DATE(time_creation) >= ? AND DATE(time_creation) <= ?
            GROUP BY accountID
            
            UNION ALL
            
            SELECT from_account AS account_id, SUM(amount) AS amount, 'debit' AS type
            FROM transfers
            WHERE DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY from_account
            
            UNION ALL
            
            SELECT account_id, SUM(amount) AS amount, 'debit' AS type
            FROM customer_wallet_transactions
            WHERE transaction_type = 'withdrawal'
            AND account_id IS NOT NULL
            AND DATE(datetime) >= ? AND DATE(datetime) <= ?
            GROUP BY account_id
            
        ) t ON a.account_ID = t.account_id
        GROUP BY a.account_ID, a.account_Name, a.accountNum, c.currencyName
        ORDER BY a.account_Name
    ");
    
    // Bind parameters (9 pairs of resetDate and date = 18 parameters)
    $stmt->bind_param(
        'ssssssssssssssssss',
        $resetDate, $date,  // customer_payments
        $resetDate, $date,  // deposits
        $resetDate, $date,  // transfers (credit)
        $resetDate, $date,  // wallet deposits/refunds (credit)
        $resetDate, $date,  // expense
        $resetDate, $date,  // withdrawals
        $resetDate, $date,  // payment
        $resetDate, $date,  // transfers (debit)
        $resetDate, $date   // wallet withdrawals (debit)
    );
    
    $stmt->execute();
    $result = $stmt->get_result();
    $accounts = [];
    
    while ($row = $result->fetch_assoc()) {
        $accounts[] = [
            'account_ID' => $row['account_ID'],
            'account_Name' => $row['account_Name'],
            'account_Number' => $row['accountNum'] ?? '',
            'currency' => $row['currencyName'] ?? 'AED',
            'total_credits' => number_format((float)$row['total_credits'], 2, '.', ''),
            'total_debits' => number_format((float)$row['total_debits'], 2, '.', ''),
            'balance' => number_format((float)$row['balance'], 2, '.', ''),
            'status' => (float)$row['balance'] >= 0 ? 'Positive' : 'Negative'
        ];
    }
    
    error_log("Close Day - Fetched " . count($accounts) . " accounts");

    // Store the closing record
    $storeStmt = $mysqli->prepare("
        INSERT INTO account_day_closures (closure_date, created_at, created_by, total_accounts, statement_data, email_sent_to, email_sent_at)
        VALUES (?, NOW(), ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            created_at = NOW(),
            created_by = VALUES(created_by),
            total_accounts = VALUES(total_accounts),
            statement_data = VALUES(statement_data),
            email_sent_to = VALUES(email_sent_to),
            email_sent_at = NOW()
    ");
    
    $totalAccounts = count($accounts);
    $statementJson = json_encode($accounts);
    $userId = $user_id;
    
    $storeStmt->bind_param('siiss', $date, $userId, $totalAccounts, $statementJson, $email);
    $storeStmt->execute();

    // Prepare email content
    $emailSubject = "Daily Account Statement - " . date('d M Y', strtotime($date));
    $emailBody = "<html><head><style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
        .summary { background: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #374151; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
        .positive { color: #10b981; font-weight: bold; }
        .negative { color: #ef4444; font-weight: bold; }
        .footer { background: #f9fafb; padding: 15px; text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    </style></head><body>
        <div class='header'>
            <h1>📊 Daily Account Statement</h1>
            <p>Date: " . date('l, d F Y', strtotime($date)) . "</p>
            <p>Period: " . date('d M Y', strtotime($resetDate)) . " to " . date('d M Y', strtotime($date)) . "</p>
        </div>
        
        <div class='summary'>
            <h3>Summary</h3>
            <p><strong>Total Accounts:</strong> " . $totalAccounts . "</p>
            <p><strong>Closing Date:</strong> " . date('d M Y', strtotime($date)) . "</p>
            <p><strong>Generated At:</strong> " . date('d M Y H:i:s') . "</p>
        </div>
        
        <h3>Account Balances</h3>
        <table>
            <thead>
                <tr>
                    <th>Account ID</th>
                    <th>Account Name</th>
                    <th>Account Number</th>
                    <th>Total Credits</th>
                    <th>Total Debits</th>
                    <th>Balance</th>
                    <th>Currency</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>";
    
    foreach ($accounts as $account) {
        $balanceClass = (float)$account['balance'] >= 0 ? 'positive' : 'negative';
        $emailBody .= "<tr>
            <td>" . htmlspecialchars($account['account_ID']) . "</td>
            <td>" . htmlspecialchars($account['account_Name']) . "</td>
            <td>" . htmlspecialchars($account['account_Number']) . "</td>
            <td>" . htmlspecialchars($account['total_credits']) . "</td>
            <td>" . htmlspecialchars($account['total_debits']) . "</td>
            <td class='" . $balanceClass . "'>" . htmlspecialchars($account['balance']) . "</td>
            <td>" . htmlspecialchars($account['currency']) . "</td>
            <td>" . htmlspecialchars($account['status']) . "</td>
        </tr>";
    }
    
    $emailBody .= "</tbody></table>
        
        <div class='footer'>
            <p>This is an automated statement from SN Travels Portal</p>
            <p>Generated on " . date('d M Y H:i:s') . "</p>
        </div>
    </body></html>";

    // Try to send email using PHP mail() function
    $mailSent = false;
    $emailError = '';
    
    try {
        // Check if running on localhost - email usually doesn't work on localhost
        $isLocalhost = (
            isset($_SERVER['HTTP_HOST']) && 
            (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || 
             strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false)
        );
        
        if ($isLocalhost) {
            // On localhost, don't try to send email as it rarely works
            throw new Exception('Email sending disabled on localhost. Mail server (localhost:25) is not properly configured. Please configure a real SMTP server (Gmail, SendGrid, etc.) or deploy to production server.');
        }
        
        // Check if mail function is available
        if (!function_exists('mail')) {
            throw new Exception('PHP mail() function is not available on this server');
        }
        
        // Check if sendmail or mail server is configured
        $mailConfigured = false;
        if (ini_get('SMTP') && ini_get('smtp_port')) {
            // Windows configuration
            $mailConfigured = true;
            error_log("Mail configured - SMTP: " . ini_get('SMTP') . ":" . ini_get('smtp_port'));
        } elseif (ini_get('sendmail_path')) {
            // Unix/Linux configuration
            $mailConfigured = true;
            error_log("Mail configured - Sendmail path: " . ini_get('sendmail_path'));
        }
        
        if (!$mailConfigured) {
            throw new Exception('Mail server is not configured in php.ini. Please configure SMTP settings or sendmail_path.');
        }
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: SN Travels <noreply@sntrips.com>" . "\r\n";
        $headers .= "Reply-To: noreply@sntrips.com" . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        
        // Try to send the email
        $mailResult = mail($email, $emailSubject, $emailBody, $headers);
        
        if ($mailResult) {
            $mailSent = true;
            error_log("Email sent successfully to: " . $email);
        } else {
            // Get the last error from error_get_last()
            $lastError = error_get_last();
            $errorMessage = $lastError ? $lastError['message'] : 'Unknown error';
            throw new Exception('mail() function returned false. Error: ' . $errorMessage);
        }
    } catch (Exception $e) {
        error_log("Email sending failed: " . $e->getMessage());
        $emailError = $e->getMessage();
        $mailSent = false;
    }

    // Also save statement as a downloadable HTML file
    $filename = 'statement_' . $date . '_' . time() . '.html';
    $filepath = __DIR__ . '/../../statements/' . $filename;
    
    // Create statements directory if it doesn't exist
    if (!is_dir(__DIR__ . '/../../statements/')) {
        mkdir(__DIR__ . '/../../statements/', 0755, true);
    }
    
    file_put_contents($filepath, $emailBody);
    
    // Determine the correct base URL based on the current request
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    // For local development (XAMPP), use the appropriate localhost URL
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
        // Extract just the base URL without port
        $baseHost = preg_replace('/:\d+$/', '', $host);
        $statementUrl = $protocol . '://' . $baseHost . '/snt/statements/' . $filename;
    } else {
        // For production, use the production domain
        $statementUrl = 'https://app.sntrips.com/statements/' . $filename;
    }
    
    ob_clean();
    echo json_encode([
        'success' => true,
        'message' => $mailSent 
            ? 'Day closed successfully. Statement has been emailed to ' . $email 
            : 'Day closed successfully. Email could not be sent: ' . $emailError . '. Download the statement below.',
        'statement' => [
            'totalAccounts' => $totalAccounts,
            'date' => $date,
            'resetDate' => $resetDate,
            'emailSent' => $mailSent,
            'emailError' => $emailError,
            'statementUrl' => $statementUrl,
            'accounts' => $accounts
        ]
    ]);

} catch (Exception $e) {
    error_log("Close Day Error: " . $e->getMessage());
    error_log("Close Day Error Stack: " . $e->getTraceAsString());
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'debug' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
    ob_end_flush();
    exit;
}

// Clean output buffer and send response
ob_end_flush();
?>


