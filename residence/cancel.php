<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Cancel Residence
 * Endpoint: /api/residence/cancel.php
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../wallet/WalletHelper.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['residenceID']) || !isset($data['cancellation_charges'])) {
    JWTHelper::sendResponse(400, false, 'Missing required fields');
}

try {
    $pdo->beginTransaction();
    
    // Get residence details first
    $stmt = $pdo->prepare("SELECT customer_id, cancelled FROM residence WHERE residenceID = :id");
    $stmt->bindParam(':id', $data['residenceID']);
    $stmt->execute();
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$residence) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    if ($residence['cancelled'] == 1) {
        JWTHelper::sendResponse(400, false, 'Residence already cancelled');
    }
    
    // Update residence
    $sql = "UPDATE residence SET 
                cancelled = 1,
                current_status = 'Cancelled',
                cancelDate = NOW(),
                cancelRemarks = :remarks,
                canceledBy = :canceledBy,
                cancellation_cost = :charges
            WHERE residenceID = :residenceID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $data['residenceID']);
    $stmt->bindParam(':remarks', $data['remarks']);
    // Get staff_id from userData (JWT token contains staff_id, not user_id)
    $staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
    if (!$staff_id) {
        JWTHelper::sendResponse(400, false, 'Staff ID is required. User not authenticated properly.');
    }
    $stmt->bindParam(':canceledBy', $staff_id, PDO::PARAM_INT);
    $stmt->bindParam(':charges', $data['cancellation_charges']);
    $stmt->execute();
    
    // Insert into residence_cancellation table
    $sql = "INSERT INTO residence_cancellation (
        residence, customer_id, cancellation_charges, remarks, datetime
    ) VALUES (
        :residence, :customer_id, :charges, :remarks, NOW()
    )";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residence', $data['residenceID']);
    $stmt->bindParam(':customer_id', $residence['customer_id']);
    $stmt->bindParam(':charges', $data['cancellation_charges']);
    $stmt->bindParam(':remarks', $data['remarks']);
    $stmt->execute();
    
    // Calculate total payments made for this residence (only residence payments, not tawjeeh/insurance)
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(payment_amount), 0) as total_paid
        FROM customer_payments
        WHERE PaymentFor = :residenceID 
        AND (payment_type = 'residence' OR payment_type IS NULL)
    ");
    $stmt->bindParam(':residenceID', $data['residenceID']);
    $stmt->execute();
    $paymentInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    $totalPaid = (float)$paymentInfo['total_paid'];
    
    // Calculate refund amount = total paid - cancellation charges
    $refundAmount = $totalPaid - (float)$data['cancellation_charges'];
    
    // If refund amount is positive, add to customer wallet
    if ($refundAmount > 0) {
        // Get current wallet balance
        $stmt = $pdo->prepare("SELECT wallet_balance, wallet_account_number FROM customer WHERE customer_id = :customerID");
        $stmt->bindParam(':customerID', $residence['customer_id']);
        $stmt->execute();
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $currentBalance = (float)($customer['wallet_balance'] ?? 0);
        $newBalance = $currentBalance + $refundAmount;
        
        // Ensure wallet account number exists
        $walletAccountNumber = $customer['wallet_account_number'] ?? null;
        if (empty($walletAccountNumber)) {
            $walletAccountNumber = WalletHelper::generateWalletAccountNumber($pdo, $residence['customer_id']);
        }
        
        // Update wallet balance
        $stmt = $pdo->prepare("UPDATE customer SET wallet_balance = :newBalance WHERE customer_id = :customerID");
        $stmt->bindParam(':newBalance', $newBalance);
        $stmt->bindParam(':customerID', $residence['customer_id']);
        $stmt->execute();
        
        // Record wallet transaction
        $stmt = $pdo->prepare("
            INSERT INTO customer_wallet_transactions 
            (customer_id, transaction_type, amount, currency_id, balance_before, balance_after, staff_id, reference_type, reference_id, remarks)
            VALUES 
            (:customerID, 'refund', :amount, 1, :balanceBefore, :balanceAfter, :staffID, 'residence', :residenceID, :remarks)
        ");
        
        $refundRemarks = "Automatic refund from cancelled Residence #" . $data['residenceID'] . " - " . $data['remarks'];
        
        $stmt->bindParam(':customerID', $residence['customer_id']);
        $stmt->bindParam(':amount', $refundAmount);
        $stmt->bindParam(':balanceBefore', $currentBalance);
        $stmt->bindParam(':balanceAfter', $newBalance);
        $stmt->bindParam(':staffID', $staff_id);
        $stmt->bindParam(':residenceID', $data['residenceID']);
        $stmt->bindParam(':remarks', $refundRemarks);
        $stmt->execute();
    }
    
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Residence cancelled successfully');
    
} catch (Exception $e) {
    $pdo->rollBack();
    JWTHelper::sendResponse(500, false, 'Error cancelling residence: ' . $e->getMessage());
}


