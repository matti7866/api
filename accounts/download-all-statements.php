<?php
/**
 * Download All Account Statements
 * Uses the same comprehensive query as statement.php for each account
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
    require_once(__DIR__ . '/get-account-statement-data.php');
    
    if (!isset($mysqli) || $mysqli->connect_error) {
        throw new Exception('Database connection not available');
    }
    
    if (!isset($pdo)) {
        throw new Exception('PDO connection not available');
    }
} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Authentication
$user_id = null;
if (isset($_SESSION['user_id'])) {
    $user_id = $_SESSION['user_id'];
} else {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!empty($authHeader) && strpos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
        $decoded = JWTHelper::verifyToken($token);
        if ($decoded && isset($decoded['user_id'])) {
            $user_id = $decoded['user_id'];
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
    $fromDate = $_GET['fromDate'] ?? '2025-10-01';
    $toDate = $_GET['toDate'] ?? date('Y-m-d');
    $resetDate = $_GET['resetDate'] ?? '2025-10-01';

    // Get all accounts
    $stmt = $mysqli->prepare("
        SELECT 
            a.account_ID,
            a.account_Name,
            a.accountNum,
            c.currencyName
        FROM accounts a
        LEFT JOIN currency c ON a.curID = c.currencyID
        ORDER BY a.account_Name
    ");
    
    $stmt->execute();
    $result = $stmt->get_result();
    $accounts = [];
    
    while ($row = $result->fetch_assoc()) {
        $accounts[] = $row;
    }

    // For each account, call the statement.php logic
    $allStatements = [];
    
    foreach ($accounts as $account) {
        $accountId = $account['account_ID'];
        
        // Use comprehensive helper function
        $statementData = getComprehensiveAccountStatement($pdo, $accountId, $resetDate, $toDate);
        $credits = $statementData['credits'];
        $debits = $statementData['debits'];
        
        // Calculate totals
        $totalCredits = array_sum(array_column($credits, 'amount'));
        $totalDebits = array_sum(array_column($debits, 'amount'));
        $balance = $totalCredits - $totalDebits;
        
        // Combine and sort all transactions
        $allTransactions = array_merge($credits, $debits);
        usort($allTransactions, function($a, $b) {
            return strtotime($a['date']) - strtotime($b['date']);
        });
        
        $allStatements[] = [
            'account' => $account,
            'transactions' => $allTransactions,
            'totalCredits' => $totalCredits,
            'totalDebits' => $totalDebits,
            'balance' => $balance
        ];
    }

    // Generate HTML
    $html = "<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>All Account Statements - " . date('d M Y', strtotime($toDate)) . "</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; padding: 20px; background: #1f2937; color: white; border-radius: 8px; }
        .header h1 { margin: 0 0 10px 0; font-size: 24px; }
        .account-section { margin-bottom: 40px; page-break-inside: avoid; border: 2px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb; }
        .account-header { background: #374151; color: white; padding: 15px; margin: -15px -15px 15px -15px; border-radius: 6px 6px 0 0; }
        .account-header h2 { margin: 0; font-size: 18px; }
        .summary-box { display: inline-block; padding: 10px 15px; margin: 10px 10px 0 0; border-radius: 6px; background: white; }
        .summary-box.credits { border-left: 4px solid #10b981; }
        .summary-box.debits { border-left: 4px solid #ef4444; }
        .summary-box.balance { border-left: 4px solid #3b82f6; }
        .summary-box .label { font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .summary-box .value { font-size: 16px; font-weight: bold; color: #1f2937; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; }
        th { background: #f3f4f6; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; font-size: 11px; }
        td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
        .credit { color: #059669; font-weight: bold; }
        .debit { color: #dc2626; font-weight: bold; }
        .no-transactions { padding: 20px; text-align: center; color: #6b7280; font-style: italic; }
    </style>
</head>
<body>
    <div class='header'>
        <h1>📊 All Account Statements</h1>
        <p><strong>Period:</strong> " . date('d M Y', strtotime($resetDate)) . " to " . date('d M Y', strtotime($toDate)) . "</p>
        <p><strong>Generated:</strong> " . date('d M Y H:i:s') . "</p>
        <p><strong>Total Accounts:</strong> " . count($allStatements) . "</p>
    </div>";

    foreach ($allStatements as $statement) {
        $account = $statement['account'];
        $transactions = $statement['transactions'];
        $credits = $statement['totalCredits'];
        $debits = $statement['totalDebits'];
        $balance = $statement['balance'];
        
        $html .= "
    <div class='account-section'>
        <div class='account-header'>
            <h2>" . htmlspecialchars($account['account_Name']) . "</h2>
            <small>Account #: " . htmlspecialchars($account['accountNum'] ?? 'N/A') . " | Currency: " . htmlspecialchars($account['currencyName']) . "</small>
        </div>
        
        <div>
            <div class='summary-box credits'>
                <div class='label'>Total Credits</div>
                <div class='value'>" . number_format($credits, 2) . " " . htmlspecialchars($account['currencyName']) . "</div>
            </div>
            <div class='summary-box debits'>
                <div class='label'>Total Debits</div>
                <div class='value'>" . number_format($debits, 2) . " " . htmlspecialchars($account['currencyName']) . "</div>
            </div>
            <div class='summary-box balance'>
                <div class='label'>Balance</div>
                <div class='value'>" . number_format($balance, 2) . " " . htmlspecialchars($account['currencyName']) . "</div>
            </div>
        </div>";
        
        if (count($transactions) > 0) {
            $html .= "
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th style='text-align: right;'>Credit</th>
                    <th style='text-align: right;'>Debit</th>
                    <th style='text-align: right;'>Balance</th>
                </tr>
            </thead>
            <tbody>";
            
            $runningBalance = 0;
            foreach ($transactions as $trans) {
                $isCredit = in_array($trans['transaction_type'], ['Customer Payment', 'Deposit', 'Transfer In']);
                
                if ($isCredit) {
                    $runningBalance += $trans['amount'];
                    $creditAmount = number_format($trans['amount'], 2);
                    $debitAmount = '-';
                } else {
                    $runningBalance -= $trans['amount'];
                    $creditAmount = '-';
                    $debitAmount = number_format($trans['amount'], 2);
                }
                
                $html .= "
                <tr>
                    <td>" . date('d M Y', strtotime($trans['date'])) . "</td>
                    <td>" . htmlspecialchars($trans['transaction_type']) . "</td>
                    <td>" . htmlspecialchars($trans['description']) . "</td>
                    <td style='text-align: right;' class='credit'>" . $creditAmount . "</td>
                    <td style='text-align: right;' class='debit'>" . $debitAmount . "</td>
                    <td style='text-align: right; font-weight: bold;'>" . number_format($runningBalance, 2) . "</td>
                </tr>";
            }
            
            $html .= "
            </tbody>
        </table>";
        } else {
            $html .= "<div class='no-transactions'>No transactions found for this period</div>";
        }
        
        $html .= "
    </div>";
    }

    $html .= "
    <div style='margin-top: 30px; text-align: center; font-size: 10px; color: #6b7280; padding-top: 20px; border-top: 1px solid #e5e7eb;'>
        <p>SN Travels Portal - All Account Statements</p>
        <p>Generated on " . date('d M Y H:i:s') . "</p>
    </div>
</body>
</html>";

    // Save to file
    $filename = 'all_statements_' . $toDate . '_' . time() . '.html';
    $filepath = __DIR__ . '/../../statements/' . $filename;
    
    file_put_contents($filepath, $html);
    
    // Determine URL
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
        $baseHost = preg_replace('/:\d+$/', '', $host);
        $fileUrl = $protocol . '://' . $baseHost . '/snt/statements/' . $filename;
    } else {
        $fileUrl = 'https://app.sntrips.com/statements/' . $filename;
    }
    
    ob_clean();
    echo json_encode([
        'success' => true,
        'message' => 'All statements generated successfully',
        'data' => [
            'filename' => $filename,
            'url' => $fileUrl,
            'totalAccounts' => count($allStatements),
            'fromDate' => $resetDate,
            'toDate' => $toDate
        ]
    ]);

} catch (Exception $e) {
    error_log("Download All Statements Error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

ob_end_flush();
?>
