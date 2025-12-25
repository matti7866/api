<?php
/**
 * Visa Expiry API
 * Endpoint: /api/residence/visa-expiry.php
 * Returns residences filtered by expiry status (upcoming or expired)
 */

// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
    $sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['select'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

$status = isset($_GET['status']) ? (string)$_GET['status'] : 'upcoming';
$company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

try {
    // Build WHERE clause based on status
    $where = '';
    $params = [];
    
    $today = date('Y-m-d');
    
    if ($status === 'expired') {
        // Expired: expiry_date < today
        $where = " AND expiry_date < :today ";
        $params[':today'] = $today;
    } else {
        // Upcoming: expiry_date >= today
        $where = " AND expiry_date >= :today ";
        $params[':today'] = $today;
    }

    if ($company_id > 0) {
        $where .= " AND residence.company = :company_id ";
        $params[':company_id'] = $company_id;
    }

    if ($search != '') {
        $where .= " AND (passenger_name LIKE :search1 OR passportNumber LIKE :search2 OR uid LIKE :search3) ";
        $params[':search1'] = '%' . $search . '%';
        $params[':search2'] = '%' . $search . '%';
        $params[':search3'] = '%' . $search . '%';
    }

    // Get residences
    $sql = "
        SELECT 
            residence.residenceID,
            residence.datetime,
            residence.passenger_name,
            residence.customer_id,
            residence.passportNumber,
            residence.passportExpiryDate,
            residence.uid,
            residence.completedStep,
            residence.sale_price,
            residence.expiry_date,
            customer.customer_name,
            airports.countryName,
            airports.countryCode,
            company.company_name,
            (SELECT IFNULL(SUM(payment_amount),0) FROM customer_payments 
             WHERE PaymentFor = residence.residenceID 
             AND (payment_type IS NULL OR payment_type NOT IN ('insurance', 'insurance_fine', 'tawjeeh', 'cancellation'))
             AND (is_tawjeeh_payment IS NULL OR is_tawjeeh_payment = 0)
             AND (is_insurance_payment IS NULL OR is_insurance_payment = 0)
             AND (is_insurance_fine_payment IS NULL OR is_insurance_fine_payment = 0)
             AND (residenceCancelPayment IS NULL OR residenceCancelPayment = 0)) as paid_amount
        FROM residence 
        LEFT JOIN customer ON customer.customer_id = residence.customer_id
        LEFT JOIN airports ON airports.airport_id = residence.Nationality
        LEFT JOIN company ON company.company_id = residence.company
        WHERE residence.current_status = 'Active' 
        AND residence.expiry_date IS NOT NULL
        {$where}
        ORDER BY 
            CASE 
                WHEN :status = 'expired' THEN DATEDIFF(CURDATE(), residence.expiry_date)
                ELSE DATEDIFF(residence.expiry_date, CURDATE())
            END ASC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':status', $status);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    
    if (!$stmt->execute()) {
        $errorInfo = $stmt->errorInfo();
        throw new Exception('SQL Error: ' . $errorInfo[2]);
    }
    
    $residences = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Ensure array is sent properly (not merged into response object)
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => 'Visa expiry data loaded successfully',
        'data' => $residences
    ]);
    exit;
} catch (Exception $e) {
    error_log('Visa Expiry API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    
    $errorMessage = 'Error loading visa expiry data: ' . $e->getMessage();
    
    JWTHelper::sendResponse(500, false, $errorMessage);
}

