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

$API_KEY = '019ada0d-01b6-7345-90f8-0e34db2dd9a4|bQ9fMxameIRy70eSWy8RsB5niMKChyxb325sKip913459946';
$API_BASE = 'https://fr24api.flightradar24.com/api';

$action = $_GET['action'] ?? '';
$flightNumber = $_GET['flightNumber'] ?? '';
$travelDate = $_GET['travelDate'] ?? '';

if (empty($action)) {
    echo json_encode(['error' => 'Action parameter required']);
    exit;
}

switch ($action) {
    case 'search':
    case 'live':
        if (empty($flightNumber)) {
            echo json_encode(['error' => 'Flight number required']);
            exit;
        }
        
        // Determine if date is in past or future
        $isToday = false;
        $isPast = false;
        
        if ($travelDate) {
            $travelTimestamp = strtotime($travelDate);
            $todayTimestamp = strtotime(date('Y-m-d'));
            
            if ($travelTimestamp < $todayTimestamp) {
                $isPast = true;
            } elseif ($travelTimestamp == $todayTimestamp) {
                $isToday = true;
            }
        }
        
        // Use live endpoint for today/future, summary for past
        if ($isPast && $travelDate) {
            // Use flight-summary for historical flights
            $dateFrom = date('Y-m-d\T00:00:00', strtotime($travelDate));
            $dateTo = date('Y-m-d\T23:59:59', strtotime($travelDate));
            
            $url = $API_BASE . '/flight-summary/full?flights=' . urlencode($flightNumber) 
                 . '&flight_datetime_from=' . urlencode($dateFrom)
                 . '&flight_datetime_to=' . urlencode($dateTo);
        } else {
            // Use live endpoint for current/future flights
            $url = $API_BASE . '/live/flight-positions/full?flights=' . urlencode($flightNumber);
        }
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
    'Authorization: Bearer ' . $API_KEY,
    'Accept: application/json',
    'Accept-Version: v1'  // Required header for FR24 API
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

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
        'error' => 'API returned error',
        'http_code' => $httpCode,
        'response' => $response
    ]);
    exit;
}

// Return the FlightRadar24 response
echo $response;

