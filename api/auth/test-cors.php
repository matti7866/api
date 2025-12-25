<?php
// Simple CORS test endpoint
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

echo json_encode([
    'success' => true,
    'message' => 'CORS is working correctly',
    'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'not set',
    'method' => $_SERVER['REQUEST_METHOD'],
    'headers_received' => getallheaders()
]);
?>

