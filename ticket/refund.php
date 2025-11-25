<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['ticket_id'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket ID is required'
        ], 400);
    }
    
    // Get ticket details
    $ticketStmt = $pdo->prepare("SELECT supp_id, net_price FROM ticket WHERE ticket = :ticket_id");
    $ticketStmt->execute([':ticket_id' => $input['ticket_id']]);
    $ticket = $ticketStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$ticket) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Ticket not found'
        ], 404);
    }
    
    // Check if already refunded
    $checkStmt = $pdo->prepare("SELECT refund_id FROM refund_ticket WHERE ticket = :ticket_id");
    $checkStmt->execute([':ticket_id' => $input['ticket_id']]);
    
    if ($checkStmt->fetch()) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'This ticket has already been refunded'
        ], 400);
    }
    
    // Validate refund amounts
    if (!isset($input['refund_net_amount']) || !isset($input['refund_sale_amount'])) {
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Refund amounts are required'
        ], 400);
    }
    
    // Get staff branch ID
    $staffStmt = $pdo->prepare("SELECT staff_branchID FROM staff WHERE staff_id = :staff_id");
    $staffStmt->execute([':staff_id' => $user['staff_id']]);
    $staffData = $staffStmt->fetch(PDO::FETCH_ASSOC);
    $branchID = $staffData['staff_branchID'] ?? 1;
    
    // Begin transaction
    $pdo->beginTransaction();
    
    // Update ticket status to 3 (Refunded)
    $updateStatusSql = "UPDATE ticket SET status = 3 WHERE ticket = :ticket_id";
    $updateStmt = $pdo->prepare($updateStatusSql);
    $updateStmt->execute([':ticket_id' => $input['ticket_id']]);
    
    // Insert refund record
    $sql = "INSERT INTO refund_ticket (ticket, supplier_id, net_refund, return_refund) 
            VALUES (:ticket_id, :supplier_id, :net_refund, :return_refund)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':ticket_id' => $input['ticket_id'],
        ':supplier_id' => $ticket['supp_id'],
        ':net_refund' => $input['refund_net_amount'],
        ':return_refund' => $input['refund_sale_amount']
    ]);
    
    // Insert into datechange table for tracking (status = 2 for refund tracking)
    $dateSql = "INSERT INTO datechange (
        ticket_id, supplier, net_amount, netCurrencyID, 
        sale_amount, saleCurrencyID, remarks, extended_Date, 
        ticketStatus, branchID
    ) VALUES (
        :ticket_id, :supplier, :net_amount, :netCurrencyID,
        :sale_amount, :saleCurrencyID, :remarks, :extended_date,
        2, :branchID
    )";
    
    $dateStmt = $pdo->prepare($dateSql);
    $dateStmt->execute([
        ':ticket_id' => $input['ticket_id'],
        ':supplier' => $ticket['supp_id'],
        ':net_amount' => $input['refund_net_amount'],
        ':netCurrencyID' => $input['net_currency_id'] ?? 1,
        ':sale_amount' => $input['refund_sale_amount'],
        ':saleCurrencyID' => $input['sale_currency_id'] ?? 1,
        ':remarks' => $input['remarks'] ?? 'Refunded',
        ':extended_date' => date('Y-m-d'),
        ':branchID' => $branchID
    ]);
    
    // Commit transaction
    $pdo->commit();
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Ticket refunded successfully',
        'refund_id' => $pdo->lastInsertId()
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Database Error in ticket/refund.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Error in ticket/refund.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}

