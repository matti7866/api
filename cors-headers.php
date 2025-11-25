<?php
/**
 * Common CORS Headers File
 * Include this file at the top of all API endpoints to handle CORS properly
 */

// Prevent any output before headers
@ob_clean();

// Handle preflight OPTIONS requests FIRST - before any output
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    $allowedOrigins = [
        'http://localhost:5174', 
        'http://127.0.0.1:5174',
        'http://localhost:5176', 
        'http://127.0.0.1:5176',
        'https://ssn.sntrips.com',
        'http://ssn.sntrips.com',
        'https://app.sntrips.com',
        'http://app.sntrips.com'
    ];
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';
    
    // Always set CORS headers for OPTIONS - be permissive
    if ($origin) {
        // Check if origin is in allowed list
        if (in_array($origin, $allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        } elseif (strpos($origin, 'sntrips.com') !== false || strpos($origin, 'localhost') !== false) {
            // Allow any sntrips.com subdomain or localhost
            header('Access-Control-Allow-Origin: ' . $origin);
        } else {
            // For development - allow the origin anyway
            header('Access-Control-Allow-Origin: ' . $origin);
        }
        header('Access-Control-Allow-Credentials: true');
    } else {
        // No origin header - allow all (for same-origin requests)
        header('Access-Control-Allow-Origin: *');
    }
    
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
    header('Access-Control-Max-Age: 86400'); // 24 hours
    
    // Ensure no output
    if (ob_get_level()) {
        @ob_end_clean();
    }
    
    http_response_code(200);
    exit;
}

// Set CORS headers for actual requests (non-OPTIONS)
$allowedOrigins = [
    'http://localhost:5174', 
    'http://127.0.0.1:5174',
    'http://localhost:5176', 
    'http://127.0.0.1:5176',
    'https://ssn.sntrips.com',
    'http://ssn.sntrips.com',
    'https://app.sntrips.com',
    'http://app.sntrips.com'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';

// Always set CORS headers if origin is provided
if ($origin) {
    if (in_array($origin, $allowedOrigins)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    } elseif (strpos($origin, 'sntrips.com') !== false || strpos($origin, 'localhost') !== false) {
        // Allow any sntrips.com subdomain or localhost
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    } else {
        // For development - allow the origin anyway
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
} else {
    // No origin - might be same-origin request, allow it
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');


