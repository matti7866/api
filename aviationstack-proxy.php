<?php

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");

// AviationStack API credentials
$API_KEY = '5f42068dae82e0d9061615522f0209f5';
$API_BASE = 'http://api.aviationstack.com/v1';

$action = $_GET['action'] ?? '';
$flightNumber = $_GET['flightNumber'] ?? '';
$flightDate = $_GET['flightDate'] ?? '';

if (empty($action)) {
    echo json_encode(['error' => 'Action parameter required']);
    exit;
}

$url = '';

switch ($action) {
    case 'search':
    case 'flightInfo':
        if (empty($flightNumber)) {
            echo json_encode(['error' => 'Flight number required']);
            exit;
        }
        
        // Build query parameters
        $params = [
            'access_key' => $API_KEY,
            'flight_iata' => $flightNumber,
        ];
        
        // Add flight date if provided (format: YYYY-MM-DD)
        if ($flightDate) {
            $params['flight_date'] = $flightDate;
        }
        
        $url = $API_BASE . '/flights?' . http_build_query($params);
        break;
        
    default:
        echo json_encode(['error' => 'Invalid action']);
        exit;
}

// Make API request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo json_encode([
        'error' => 'cURL error: ' . $curlError,
        'http_code' => $httpCode
    ]);
    exit;
}

if ($httpCode !== 200) {
    echo json_encode([
        'error' => 'AviationStack API returned error',
        'http_code' => $httpCode,
        'response' => json_decode($response, true)
    ]);
    exit;
}

// Return the AviationStack response
echo $response;



