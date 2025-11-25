<?php
// Include CORS headers (handles OPTIONS and sets CORS headers)
require_once __DIR__ . '/cors-headers.php';

header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    require_once(__DIR__ . '/../connection.php');
    require_once(__DIR__ . '/auth/JWTHelper.php');
    
    // Check authentication - try session first, then JWT token
    $user_id = null;
    $role_id = null;
    
    if (isset($_SESSION['user_id'])) {
        // Use PHP session
        $user_id = $_SESSION['user_id'];
        $role_id = $_SESSION['role_id'] ?? null;
    } else {
        // Try JWT token from Authorization header
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            $decoded = JWTHelper::validateToken($token);
            if ($decoded && isset($decoded->data)) {
                $user_id = $decoded->data->staff_id ?? null;
                $role_id = $decoded->data->role_id ?? null;
                
                // Create session from JWT token for future requests
                $_SESSION['user_id'] = $user_id;
                $_SESSION['role_id'] = $role_id;
                $_SESSION['staff_name'] = $decoded->data->staff_name ?? '';
                $_SESSION['staff_email'] = $decoded->data->staff_email ?? '';
            }
        }
    }
    
    if (!$user_id || !$role_id) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    
    // Check permissions - Currency page or Accounts page
    try {
            // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
$sql = "SELECT permission.select FROM `permission` WHERE role_id = :role_id AND (page_name = 'Currency' OR page_name = 'Accounts')";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':role_id', $role_id);
        $stmt->execute();
        $permission = $stmt->fetch(\PDO::FETCH_ASSOC);
        
        if (!$permission || $permission['select'] == 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            exit;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Permission check failed: ' . $e->getMessage()]);
        exit;
    }
    
    // Fetch all currencies
    $query = $pdo->prepare("SELECT currencyID, currencyName FROM currency ORDER BY currencyName ASC");
    $query->execute();
    $currencies = $query->fetchAll(\PDO::FETCH_ASSOC);
    
    echo json_encode($currencies);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>

