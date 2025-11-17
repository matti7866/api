<?php
/**
 * Common CORS Headers File
 * Include this file at the top of all API endpoints to handle CORS properly
 */

// Handle preflight OPTIONS requests FIRST - before any output
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $allowedOrigins = [
        'http://localhost:5174', 
        'http://127.0.0.1:5174',
        'https://ssn.sntrips.com',
        'http://ssn.sntrips.com',
        'https://app.sntrips.com',
        'http://app.sntrips.com'
    ];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 86400'); // 24 hours
    http_response_code(200);
    exit;
}

// Set CORS headers for actual requests
$allowedOrigins = [
    'http://localhost:5174', 
    'http://127.0.0.1:5174',
    'https://ssn.sntrips.com',
    'http://ssn.sntrips.com',
    'https://app.sntrips.com',
    'http://app.sntrips.com'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');


