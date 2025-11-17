<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Payment History for a Residence
 * Endpoint: /api/residence/payment-history.php
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Get residence ID
$residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : 0;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    // Get payment history from customer_payments table
    $sql = "SELECT 
                p.pay_id as payment_id,
                p.payment_amount as amount,
                p.datetime as payment_date,
                p.payment_type,
                p.remarks,
                curr.currencyName as currency_name,
                acc.account_Name as account_name,
                s.staff_name
            FROM customer_payments p
            LEFT JOIN currency curr ON p.currencyID = curr.currencyID
            LEFT JOIN accounts acc ON p.accountID = acc.account_ID
            LEFT JOIN staff s ON p.staff_id = s.staff_id
            WHERE p.PaymentFor = :residenceID
            ORDER BY p.datetime DESC, p.pay_id DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID, PDO::PARAM_INT);
    $stmt->execute();
    $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format payment data
    foreach ($payments as &$payment) {
        $payment['amount'] = (float)$payment['amount'];
        $payment['payment_date'] = $payment['payment_date'] ?? date('Y-m-d');
        $payment['payment_type'] = $payment['payment_type'] ?? 'residence';
        $payment['remarks'] = $payment['remarks'] ?? '';
        $payment['currency_name'] = $payment['currency_name'] ?? 'AED';
        $payment['account_name'] = $payment['account_name'] ?? 'N/A';
        $payment['staff_name'] = $payment['staff_name'] ?? 'System';
    }
    
    // Wrap in data key to ensure proper response structure
    JWTHelper::sendResponse(200, true, 'Success', ['data' => $payments]);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}


