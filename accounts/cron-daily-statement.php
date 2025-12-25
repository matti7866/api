<?php
/**
 * Daily Account Statement Cron Job
 * 
 * Generates and emails all account statements automatically
 * Run this via cron at end of day (e.g., 11:59 PM daily)
 * 
 * Cron example: 59 23 * * * /usr/bin/php /Applications/XAMPP/xamppfiles/htdocs/snt/api/accounts/cron-daily-statement.php
 */

// Disable output buffering for cron jobs
while (ob_get_level()) {
    ob_end_clean();
}
ob_implicit_flush(true);

date_default_timezone_set('Asia/Dubai');

echo "========================================\n";
echo "Daily Statement Email Cron Job\n";
echo "Started: " . date('Y-m-d H:i:s') . "\n";
echo "========================================\n\n";

try {
    require_once(__DIR__ . '/../../connection.php');
    require_once(__DIR__ . '/get-account-statement-data.php');
    
    if (!isset($mysqli) || $mysqli->connect_error) {
        throw new Exception('Database connection not available');
    }
    
    if (!isset($pdo)) {
        throw new Exception('PDO connection not available');
    }
    
    echo "✓ Database connected\n";
    
} catch (Exception $e) {
    echo "✗ Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Load PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if (file_exists(__DIR__ . '/../../vendor/autoload.php')) {
    require __DIR__ . '/../../vendor/autoload.php';
} else {
    echo "✗ PHPMailer not found. Please install: composer require phpmailer/phpmailer\n";
    exit(1);
}

echo "✓ PHPMailer loaded\n";

try {
    $resetDate = '2025-10-01';  // Permanent reset date
    $toDate = date('Y-m-d');     // Today
    $email = 'mattiullah.nadiry@gmail.com';
    
    echo "\nGenerating statement for: $resetDate to $toDate\n";
    echo "Email recipient: $email\n\n";

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
    
    echo "Found " . count($accounts) . " accounts\n";

    // Generate statement for each account
    $allStatements = [];
    $processedAccounts = 0;
    
    foreach ($accounts as $account) {
        $accountId = $account['account_ID'];
        
        echo "Processing: " . $account['account_Name'] . "... ";
        
        // Use comprehensive helper function
        $statementData = getComprehensiveAccountStatement($pdo, $accountId, $resetDate, $toDate);
        $credits = $statementData['credits'];
        $debits = $statementData['debits'];
        
        $totalCredits = array_sum(array_column($credits, 'amount'));
        $totalDebits = array_sum(array_column($debits, 'amount'));
        $balance = $totalCredits - $totalDebits;
        
        // Combine all transactions
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
        
        echo count($allTransactions) . " transactions\n";
        $processedAccounts++;
    }
    
    echo "\n✓ Processed $processedAccounts accounts\n\n";

    // Generate HTML
    $html = "<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Daily Account Statements - " . date('d M Y', strtotime($toDate)) . "</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; }
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
        td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        .credit { color: #059669; font-weight: bold; }
        .debit { color: #dc2626; font-weight: bold; }
        .no-transactions { padding: 20px; text-align: center; color: #6b7280; font-style: italic; }
    </style>
</head>
<body>
    <div class='container'>
    <div class='header'>
        <h1>📊 Daily Account Statements</h1>
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
            <h2>" . htmlspecialchars($account['account_Name'] ?? 'Unknown') . "</h2>
            <small>Account #: " . htmlspecialchars($account['accountNum'] ?? 'N/A') . " | Currency: " . htmlspecialchars($account['currencyName'] ?? 'AED') . "</small>
        </div>
        
        <div>
            <div class='summary-box credits'>
                <div class='label'>Total Credits</div>
                <div class='value'>" . number_format($credits, 2) . " " . htmlspecialchars($account['currencyName'] ?? 'AED') . "</div>
            </div>
            <div class='summary-box debits'>
                <div class='label'>Total Debits</div>
                <div class='value'>" . number_format($debits, 2) . " " . htmlspecialchars($account['currencyName'] ?? 'AED') . "</div>
            </div>
            <div class='summary-box balance'>
                <div class='label'>Balance</div>
                <div class='value'>" . number_format($balance, 2) . " " . htmlspecialchars($account['currencyName'] ?? 'AED') . "</div>
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
                $isCredit = in_array($trans['transaction_type'], ['Customer Payment', 'Deposit', 'Transfer In', 'Refund']);
                
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
        <p>SN Travels Portal - Automated Daily Statement</p>
        <p>Generated on " . date('d M Y H:i:s') . "</p>
    </div>
    </div>
</body>
</html>";

    // Save HTML file
    $filename = 'daily_statement_' . $toDate . '.html';
    $filepath = __DIR__ . '/../../statements/' . $filename;
    file_put_contents($filepath, $html);
    
    echo "✓ Statement file saved: $filename\n\n";

    // Send email using PHPMailer (same config as send-otp.php)
    $mail = new PHPMailer(true);
    
    echo "Sending email to $email...\n";
    
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'selabnadirydxb@gmail.com';
    $mail->Password = 'zdwefhpewgyqmdkl';  // Same as send-otp.php
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;
    
    $mail->Timeout = 30;
    $mail->SMTPKeepAlive = true;
    
    $mail->SMTPOptions = array(
        'ssl' => array(
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        )
    );
    
    $mail->setFrom('selabnadirydxb@gmail.com', 'SN Travels - Daily Statements');
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = '📊 Daily Account Statement - ' . date('d M Y', strtotime($toDate));
    
    // Attach the HTML statement file
    $mail->addAttachment($filepath, $filename);
    
    // Simple email body - statement is in attachment only
    $mail->Body = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 8px 8px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .attachment-box { background: #fef3c7; border: 2px dashed #f59e0b; padding: 20px; margin: 20px 0; border-radius: 6px; text-align: center; }
            .attachment-box h3 { margin: 0 0 10px 0; color: #92400e; font-size: 18px; }
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
            .stat { background: #f9fafb; padding: 15px; border-radius: 6px; text-align: center; border-left: 3px solid #3b82f6; }
            .stat-label { font-size: 11px; color: #6b7280; margin-bottom: 5px; text-transform: uppercase; }
            .stat-value { font-size: 18px; font-weight: bold; color: #1f2937; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>📊 Daily Account Statement</h1>
                <p style='margin: 10px 0 0 0; opacity: 0.9;'>" . date('l, d F Y', strtotime($toDate)) . "</p>
            </div>
            
            <p>Dear Team,</p>
            
            <p>Your automated daily account statement is attached to this email.</p>
            
            <div class='stats'>
                <div class='stat'>
                    <div class='stat-label'>Accounts</div>
                    <div class='stat-value'>" . count($allStatements) . "</div>
                </div>
                <div class='stat'>
                    <div class='stat-label'>Period</div>
                    <div class='stat-value'>" . date('M d', strtotime($resetDate)) . " - " . date('M d', strtotime($toDate)) . "</div>
                </div>
                <div class='stat'>
                    <div class='stat-label'>Time</div>
                    <div class='stat-value'>" . date('H:i') . "</div>
                </div>
            </div>
            
            <div class='attachment-box'>
                <h3>📎 Attached File</h3>
                <p style='margin: 10px 0 0 0; color: #92400e; font-size: 14px;'>
                    <strong style='font-size: 16px;'>$filename</strong><br>
                    <small>Complete statement with all account transactions, balances, and running totals</small>
                </p>
            </div>
            
            <p style='font-size: 13px; color: #6b7280; background: #f9fafb; padding: 15px; border-radius: 6px;'>
                <strong style='color: #374151;'>📋 Statement includes:</strong><br>
                • All " . count($allStatements) . " account balances<br>
                • Complete transaction history<br>
                • Credits and debits breakdown<br>
                • Running balance calculations<br>
                • Professional formatting for printing/archiving
            </p>
            
            <hr style='border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;'>
            
            <p style='font-size: 12px; color: #9ca3af; text-align: center; margin: 0;'>
                <strong>SN Travels Portal</strong> - Automated Daily Statement<br>
                Generated: " . date('d M Y H:i:s') . " (Dubai Time)
            </p>
        </div>
    </body>
    </html>
    ";
    
    $mail->AltBody = "Daily Account Statement - " . date('d M Y', strtotime($toDate)) . "\n\nPlease find the attached HTML file with complete account details.\n\nTotal Accounts: " . count($allStatements) . "\nPeriod: " . date('d M Y', strtotime($resetDate)) . " to " . date('d M Y', strtotime($toDate)) . "\nGenerated: " . date('d M Y H:i:s') . "\n\nSN Travels Portal";
    
    $mail->send();
    
    echo "✓ Email sent successfully to $email\n";
    echo "\n========================================\n";
    echo "Cron job completed successfully!\n";
    echo "Finished: " . date('Y-m-d H:i:s') . "\n";
    echo "========================================\n";
    
    // Log success
    $logEntry = date('Y-m-d H:i:s') . " - Daily statement emailed to $email - " . count($allStatements) . " accounts\n";
    @file_put_contents(__DIR__ . '/../../logs/cron_statements.log', $logEntry, FILE_APPEND);
    
} catch (Exception $e) {
    echo "✗ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    
    // Log error
    $logEntry = date('Y-m-d H:i:s') . " - ERROR: " . $e->getMessage() . "\n";
    @file_put_contents(__DIR__ . '/../../logs/cron_statements.log', $logEntry, FILE_APPEND);
    
    exit(1);
}
?>

