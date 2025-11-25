<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once __DIR__ . '/../../connection.php';
require_once __DIR__ . '/../auth/JWTHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Method not allowed'
    ], 405);
}

// Verify JWT token
$user = JWTHelper::verifyRequest();

try {
    // Get filters from query parameters
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $customerId = $_GET['customerId'] ?? null;
    $passportNum = $_GET['passportNum'] ?? null;
    $passengerName = $_GET['passengerName'] ?? null;
    $countryId = $_GET['countryId'] ?? null;
    
    // Build query
    $sql = "SELECT 
                v.visa_id,
                v.customer_id,
                v.passenger_name,
                v.datetime,
                v.supp_id,
                v.country_id,
                v.staff_id,
                v.net_price,
                v.netCurrencyID,
                v.sale,
                v.saleCurrencyID,
                v.gaurantee,
                v.address,
                v.pendingvisa,
                v.visaCopy,
                v.branchID,
                v.PassportNum,
                v.nationalityID,
                c.customer_name,
                c.customer_phone,
                s.supp_name as supplier_name,
                cn.country_names as country_name,
                netCurr.currencyName as net_currency_name,
                saleCurr.currencyName as sale_currency_name,
                st.staff_name,
                nat.nationality
            FROM visa v
            LEFT JOIN customer c ON c.customer_id = v.customer_id
            LEFT JOIN supplier s ON s.supp_id = v.supp_id
            LEFT JOIN country_name cn ON cn.country_id = v.country_id
            LEFT JOIN currency netCurr ON netCurr.currencyID = v.netCurrencyID
            LEFT JOIN currency saleCurr ON saleCurr.currencyID = v.saleCurrencyID
            LEFT JOIN staff st ON st.staff_id = v.staff_id
            LEFT JOIN nationalities nat ON nat.nationalityID = v.nationalityID
            WHERE 1=1";
    
    $params = [];
    
    // Apply filters
    if ($startDate) {
        $sql .= " AND DATE(v.datetime) >= :startDate";
        $params[':startDate'] = $startDate;
    }
    
    if ($endDate) {
        $sql .= " AND DATE(v.datetime) <= :endDate";
        $params[':endDate'] = $endDate;
    }
    
    if ($customerId) {
        $sql .= " AND v.customer_id = :customerId";
        $params[':customerId'] = $customerId;
    }
    
    if ($passportNum) {
        $sql .= " AND v.PassportNum LIKE :passportNum";
        $params[':passportNum'] = "%$passportNum%";
    }
    
    if ($passengerName) {
        $sql .= " AND v.passenger_name LIKE :passengerName";
        $params[':passengerName'] = "%$passengerName%";
    }
    
    if ($countryId) {
        $sql .= " AND v.country_id = :countryId";
        $params[':countryId'] = $countryId;
    }
    
    // Order by most recent first
    $sql .= " ORDER BY v.datetime DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $visas = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse([
        'success' => true,
        'message' => 'Success',
        'data' => $visas
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error in visa/list.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    error_log("Error in visa/list.php: " . $e->getMessage());
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'An error occurred'
    ], 500);
}













