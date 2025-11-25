<?php
// Include CORS headers
require_once __DIR__ . '/cors-headers.php';

header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Debug: Show all request headers and session data
$debug = [
    'timestamp' => date('Y-m-d H:i:s'),
    'session_id' => session_id(),
    'session_data' => $_SESSION,
    'authorization_methods' => []
];

// Method 1: $_SERVER['HTTP_AUTHORIZATION']
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $debug['authorization_methods']['SERVER_HTTP_AUTHORIZATION'] = substr($_SERVER['HTTP_AUTHORIZATION'], 0, 50) . '...';
}

// Method 2: apache_request_headers()
if (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $debug['authorization_methods']['apache_request_headers'] = isset($headers['Authorization']) ? substr($headers['Authorization'], 0, 50) . '...' : 'not found';
}

// Method 3: getallheaders()
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    $debug['authorization_methods']['getallheaders'] = isset($headers['Authorization']) ? substr($headers['Authorization'], 0, 50) . '...' : 'not found';
}

// Check all $_SERVER keys for Authorization
foreach ($_SERVER as $key => $value) {
    if (stripos($key, 'auth') !== false || stripos($key, 'bearer') !== false) {
        $debug['server_vars'][$key] = is_string($value) ? substr($value, 0, 100) : $value;
    }
}

// Check if JWT token would work
require_once(__DIR__ . '/auth/JWTHelper.php');
$authHeader = '';

if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
} elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}

if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $token = $matches[1];
    $debug['jwt_token_found'] = 'YES - Token: ' . substr($token, 0, 20) . '...';
    
    try {
        $decoded = JWTHelper::validateToken($token);
        if ($decoded && isset($decoded->data)) {
            $debug['jwt_valid'] = 'YES';
            $debug['jwt_data'] = [
                'staff_id' => $decoded->data->staff_id ?? 'not set',
                'role_id' => $decoded->data->role_id ?? 'not set',
                'staff_name' => $decoded->data->staff_name ?? 'not set'
            ];
        } else {
            $debug['jwt_valid'] = 'NO - Invalid or expired';
        }
    } catch (Exception $e) {
        $debug['jwt_error'] = $e->getMessage();
    }
} else {
    $debug['jwt_token_found'] = 'NO';
}

echo json_encode($debug, JSON_PRETTY_PRINT);
?>

