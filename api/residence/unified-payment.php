<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Unified Payment System for Residence
 * Handles both getting outstanding breakdown and processing unified payment
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

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get unified outstanding breakdown
    $residenceID = isset($_GET['residenceID']) ? (int)$_GET['residenceID'] : 0;
    
    if (!$residenceID) {
        JWTHelper::sendResponse(400, false, 'Residence ID is required');
    }
    
    try {
        // Get residence details
        $resQuery = $pdo->prepare("SELECT r.sale_price, r.saleCurID, r.customer_id, r.current_status,
                                           rch.tawjeeh_amount, rch.insurance_amount, rch.insurance_fine,
                                           rch.tawjeeh_included_in_sale, rch.insurance_included_in_sale,
                                           IFNULL(rcancel.cancellation_charges, 0) as cancellation_charges
                                    FROM residence r
                                    LEFT JOIN residence_charges rch ON r.residenceID = rch.residence_id
                                    LEFT JOIN residence_cancellation rcancel ON r.residenceID = rcancel.residence
                                    WHERE r.residenceID = :residence_id");
        $resQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $resQuery->execute();
        $residence = $resQuery->fetch(PDO::FETCH_ASSOC);
        
        if (!$residence) {
            JWTHelper::sendResponse(404, false, 'Residence not found');
        }
        
        // Calculate residence payment outstanding (only sale price payments, not special types)
        $residencePaymentQuery = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) AS total_paid
                                                FROM customer_payments
                                                WHERE PaymentFor = :residence_id 
                                                AND (payment_type IS NULL OR payment_type NOT IN ('insurance', 'insurance_fine', 'tawjeeh', 'cancellation'))");
        $residencePaymentQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $residencePaymentQuery->execute();
        $residencePaid = $residencePaymentQuery->fetch(PDO::FETCH_ASSOC);
        $residence_outstanding = max(0, floatval($residence['sale_price']) - floatval($residencePaid['total_paid']));
        
        // Calculate E-Visa fine outstanding
        $fineQuery = $pdo->prepare("SELECT IFNULL(SUM(fineAmount), 0) AS total_fine FROM residencefine WHERE residenceID = :residence_id");
        $fineQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $fineQuery->execute();
        $fineData = $fineQuery->fetch(PDO::FETCH_ASSOC);
        
        $finePaidQuery = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) AS fine_paid FROM customer_payments WHERE residenceFinePayment IN (SELECT residenceFineID FROM residencefine WHERE residenceID = :residence_id)");
        $finePaidQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $finePaidQuery->execute();
        $finePaidData = $finePaidQuery->fetch(PDO::FETCH_ASSOC);
        $fine_outstanding = max(0, floatval($fineData['total_fine']) - floatval($finePaidData['fine_paid']));
        
        // Calculate TAWJEEH outstanding
        $tawjeehQuery = $pdo->prepare("SELECT IFNULL(SUM(tawjeeh_payment_amount), 0) AS tawjeeh_paid
                                       FROM customer_payments
                                       WHERE PaymentFor = :residence_id AND is_tawjeeh_payment = 1");
        $tawjeehQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $tawjeehQuery->execute();
        $tawjeehPaid = $tawjeehQuery->fetch(PDO::FETCH_ASSOC);
        $tawjeeh_amount = floatval($residence['tawjeeh_amount'] ?? 150);
        $tawjeeh_included = intval($residence['tawjeeh_included_in_sale'] ?? 0);
        $tawjeeh_outstanding = ($tawjeeh_included == 0) ? max(0, $tawjeeh_amount - floatval($tawjeehPaid['tawjeeh_paid'])) : 0;
        
        // Calculate ILOE Insurance outstanding
        $iloeQuery = $pdo->prepare("SELECT 
                                    IFNULL(SUM(insurance_payment_amount), 0) AS insurance_paid,
                                    IFNULL(SUM(insurance_fine_payment_amount), 0) AS fine_paid
                                    FROM customer_payments
                                    WHERE PaymentFor = :residence_id AND (is_insurance_payment = 1 OR is_insurance_fine_payment = 1)");
        $iloeQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $iloeQuery->execute();
        $iloePaid = $iloeQuery->fetch(PDO::FETCH_ASSOC);
        
        $insurance_amount = floatval($residence['insurance_amount'] ?? 126);
        $insurance_included = intval($residence['insurance_included_in_sale'] ?? 0);
        $iloe_insurance_outstanding = ($insurance_included == 0) ? max(0, $insurance_amount - floatval($iloePaid['insurance_paid'])) : 0;
        
        $insurance_fine = floatval($residence['insurance_fine'] ?? 0);
        $iloe_fine_outstanding = max(0, $insurance_fine - floatval($iloePaid['fine_paid']));
        
        // Calculate Cancellation Fee outstanding (only for cancelled/replaced residences)
        $cancellation_outstanding = 0;
        if (strtolower($residence['current_status']) === 'cancelled' || 
            strtolower($residence['current_status']) === 'replaced' ||
            strtolower($residence['current_status']) === 'cancelled & replaced') {
            $cancellationPaidQuery = $pdo->prepare("SELECT IFNULL(SUM(payment_amount), 0) AS cancellation_paid
                                                    FROM customer_payments
                                                    WHERE PaymentFor = :residence_id AND payment_type = 'cancellation'");
            $cancellationPaidQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
            $cancellationPaidQuery->execute();
            $cancellationPaid = $cancellationPaidQuery->fetch(PDO::FETCH_ASSOC);
            $cancellation_outstanding = max(0, floatval($residence['cancellation_charges']) - floatval($cancellationPaid['cancellation_paid']));
        }
        
        // Calculate custom charges outstanding (if table exists)
        $custom_charges_outstanding = 0;
        try {
            $customChargesQuery = $pdo->prepare("SELECT IFNULL(SUM(sale_price), 0) AS custom_charges_total FROM residence_custom_charges WHERE residence_id = :residence_id");
            $customChargesQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
            $customChargesQuery->execute();
            $customChargesData = $customChargesQuery->fetch(PDO::FETCH_ASSOC);
            $custom_charges_outstanding = max(0, floatval($customChargesData['custom_charges_total']));
        } catch (Exception $customChargeError) {
            // Table doesn't exist yet, no custom charges
            $custom_charges_outstanding = 0;
        }
        
        // Calculate total outstanding
        $total_outstanding = $residence_outstanding + $fine_outstanding + $tawjeeh_outstanding + 
                           $iloe_insurance_outstanding + $iloe_fine_outstanding + $cancellation_outstanding + $custom_charges_outstanding;
        
        $breakdown = [
            'residence_outstanding' => $residence_outstanding,
            'fine_outstanding' => $fine_outstanding,
            'tawjeeh_outstanding' => $tawjeeh_outstanding,
            'iloe_insurance_outstanding' => $iloe_insurance_outstanding,
            'iloe_fine_outstanding' => $iloe_fine_outstanding,
            'cancellation_outstanding' => $cancellation_outstanding,
            'custom_charges_outstanding' => $custom_charges_outstanding,
            'total_outstanding' => $total_outstanding
        ];
        
        JWTHelper::sendResponse(200, true, 'Success', $breakdown);
        
    } catch (Exception $e) {
        JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
    }
    
} elseif ($method === 'POST') {
    // Process unified payment
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        JWTHelper::sendResponse(400, false, 'Invalid input data');
    }
    
    $residenceID = isset($input['residenceID']) ? (int)$input['residenceID'] : 0;
    $paymentAmount = isset($input['paymentAmount']) ? floatval($input['paymentAmount']) : 0;
    $accountID = isset($input['accountID']) ? (int)$input['accountID'] : 0;
    $remarks = isset($input['remarks']) ? trim($input['remarks']) : 'Unified payment for all outstanding charges';
    
    // Validation
    if (!$residenceID) {
        JWTHelper::sendResponse(400, false, 'Residence ID is required');
    }
    
    if ($paymentAmount <= 0) {
        JWTHelper::sendResponse(400, false, 'Payment amount must be greater than zero');
    }
    
    if (!$accountID) {
        JWTHelper::sendResponse(400, false, 'Payment account is required');
    }
    
    try {
        $pdo->beginTransaction();
        
        // Get residence details
        $resQuery = $pdo->prepare("SELECT customer_id, saleCurID, sale_price, current_status FROM residence WHERE residenceID = :residence_id");
        $resQuery->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        $resQuery->execute();
        $residence = $resQuery->fetch(PDO::FETCH_ASSOC);
        
        if (!$residence) {
            throw new Exception('Residence not found');
        }
        
        // Get staff_id from userData (JWT token contains staff_id, not user_id)
        $staff_id = isset($userData['staff_id']) ? (int)$userData['staff_id'] : null;
        
        if (!$staff_id) {
            throw new Exception('Staff ID is required. User not authenticated properly.');
        }
        
        // Insert a single unified payment record
        $paymentSQL = "INSERT INTO customer_payments 
                      (customer_id, payment_amount, currencyID, staff_id, accountID, PaymentFor, remarks) 
                      VALUES (:customer_id, :amount, :currency_id, :staff_id, :account_id, :residence_id, :remarks)";
        $stmt = $pdo->prepare($paymentSQL);
        $stmt->bindParam(':customer_id', $residence['customer_id']);
        $stmt->bindParam(':amount', $paymentAmount);
        $stmt->bindParam(':currency_id', $residence['saleCurID']);
        $stmt->bindParam(':staff_id', $staff_id, PDO::PARAM_INT);
        $stmt->bindParam(':account_id', $accountID, PDO::PARAM_INT);
        $stmt->bindParam(':residence_id', $residenceID, PDO::PARAM_INT);
        
        // Add [Unified Payment] prefix to remarks for identification
        $unifiedRemarks = '[Unified Payment] ' . $remarks;
        $stmt->bindParam(':remarks', $unifiedRemarks);
        $stmt->execute();
        
        $pdo->commit();
        
        JWTHelper::sendResponse(200, true, 'Unified payment processed successfully. Payment amount: ' . number_format($paymentAmount, 2) . ' AED');
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollback();
        }
        JWTHelper::sendResponse(500, false, 'Error processing payment: ' . $e->getMessage());
    }
} else {
    JWTHelper::sendResponse(405, false, 'Method not allowed');
}





