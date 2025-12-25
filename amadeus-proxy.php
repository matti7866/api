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

// Amadeus API credentials
$API_KEY = 'rA2tBaCri6vD6NryFOnOwrz51Zm3aClC';
$API_SECRET = 'Yd0BrUEasrEu3YA5';
$API_BASE = 'https://test.api.amadeus.com';

// Get or refresh access token
function getAccessToken($apiKey, $apiSecret, $apiBase) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiBase . '/v1/security/oauth2/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'client_credentials',
        'client_id' => $apiKey,
        'client_secret' => $apiSecret
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        return $data['access_token'] ?? null;
    }
    
    return null;
}

$action = $_GET['action'] ?? '';
$flightNumber = $_GET['flightNumber'] ?? '';
$departureDate = $_GET['departureDate'] ?? '';

if (empty($action)) {
    echo json_encode(['error' => 'Action parameter required']);
    exit;
}

// Get access token
$accessToken = getAccessToken($API_KEY, $API_SECRET, $API_BASE);
if (!$accessToken) {
    echo json_encode(['error' => 'Failed to authenticate with Amadeus API']);
    exit;
}

$url = '';

switch ($action) {
    case 'searchFlight':
        // Flight Offers Search by flight number and date
        if (empty($flightNumber)) {
            echo json_encode(['error' => 'Flight number required']);
            exit;
        }
        
        // Extract carrier code and flight number (e.g., EK226 -> EK + 226)
        preg_match('/^([A-Z]{2})(\d+)$/i', $flightNumber, $matches);
        if (!$matches) {
            echo json_encode(['error' => 'Invalid flight number format']);
            exit;
        }
        
        $carrierCode = strtoupper($matches[1]);
        $flightNum = $matches[2];
        
        // Use Flight Status endpoint (works better for schedules)
        $params = [
            'carrierCode' => $carrierCode,
            'flightNumber' => $flightNum,
        ];
        
        if ($departureDate) {
            $params['scheduledDepartureDate'] = $departureDate;
        }
        
        $url = $API_BASE . '/v2/schedule/flights?' . http_build_query($params);
        break;
        
    case 'flightStatus':
        if (empty($flightNumber)) {
            echo json_encode(['error' => 'Flight number required']);
            exit;
        }
        
        // Extract carrier code and flight number
        preg_match('/^([A-Z]{2})(\d+)$/i', $flightNumber, $matches);
        if (!$matches) {
            echo json_encode(['error' => 'Invalid flight number format']);
            exit;
        }
        
        $carrierCode = strtoupper($matches[1]);
        $flightNum = $matches[2];
        
        $params = [
            'carrierCode' => $carrierCode,
            'flightNumber' => $flightNum,
        ];
        
        if ($departureDate) {
            $params['scheduledDepartureDate'] = $departureDate;
        }
        
        $url = $API_BASE . '/v2/schedule/flights?' . http_build_query($params);
        break;
        
    default:
        echo json_encode(['error' => 'Invalid action']);
        exit;
}

// Make API request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Accept: application/json'
]);
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
        'error' => 'Amadeus API returned error',
        'http_code' => $httpCode,
        'response' => json_decode($response, true)
    ]);
    exit;
}

// Return the Amadeus response
echo $response;

