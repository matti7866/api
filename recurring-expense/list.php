<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ], 401);
}

try {
    // Get filter parameters
    $category = isset($_GET['category']) ? $_GET['category'] : null;
    $isActive = isset($_GET['is_active']) ? intval($_GET['is_active']) : null;
    $startYear = isset($_GET['start_year']) ? intval($_GET['start_year']) : null;
    
    // Build query
    $sql = "SELECT 
                re.*,
                c.currencyName,
                s.staff_name as created_by
            FROM recurring_expenses re
            LEFT JOIN currency c ON c.currencyID = re.currency_id
            LEFT JOIN staff s ON s.staff_id = re.staff_id
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if ($category) {
        $sql .= " AND re.category = :category";
        $params[':category'] = $category;
    }
    
    if ($isActive !== null) {
        $sql .= " AND re.is_active = :is_active";
        $params[':is_active'] = $isActive;
    }
    
    if ($startYear) {
        $sql .= " AND YEAR(re.start_date) = :start_year";
        $params[':start_year'] = $startYear;
    }
    
    $sql .= " ORDER BY re.is_active DESC, re.category ASC, re.expense_name ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate yearly totals by category
    $yearlyTotals = [];
    $currentYear = date('Y');
    
    foreach ($expenses as &$expense) {
        // Calculate yearly amount based on frequency
        $monthlyAmount = floatval($expense['amount']);
        $yearlyAmount = 0;
        
        switch ($expense['frequency']) {
            case 'monthly':
                $yearlyAmount = $monthlyAmount * 12;
                break;
            case 'quarterly':
                $yearlyAmount = $monthlyAmount * 4;
                break;
            case 'yearly':
                $yearlyAmount = $monthlyAmount;
                break;
        }
        
        $expense['yearly_amount'] = $yearlyAmount;
        
        // Add to category totals (only active expenses)
        if ($expense['is_active']) {
            $category = $expense['category'];
            if (!isset($yearlyTotals[$category])) {
                $yearlyTotals[$category] = 0;
            }
            $yearlyTotals[$category] += $yearlyAmount;
        }
    }
    
    // Calculate grand total
    $grandTotal = array_sum($yearlyTotals);
    
    JWTHelper::sendResponse([
        'success' => true,
        'data' => $expenses,
        'summary' => [
            'yearly_totals_by_category' => $yearlyTotals,
            'grand_total_yearly' => $grandTotal,
            'year' => $currentYear
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in recurring-expense/list.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in recurring-expense/list.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ], 500);
}

