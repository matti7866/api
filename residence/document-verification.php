<?php

// CORS headers to allow requests from your React app
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'simple_html_dom.php';

// Database connection with environment detection
try {
    $isProduction = !in_array($_SERVER['HTTP_HOST'] ?? 'localhost', ['localhost', '127.0.0.1', 'localhost:8080']);
    
    if ($isProduction) {
        // Production server credentials
        $host = 'localhost';
        $dbname = 'sntravels_prod';
        $username = 'sntravels_prod';
        $password = 'MG2NCiDwWWt5jxcP';
    } else {
        // Local XAMPP credentials
        $host = '127.0.0.1';
        $dbname = 'sntravels_prod';
        $username = 'root';
        $password = '';
    }
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password, array(PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"));
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    if (!$pdo) {
        response_json(['status' => 'error', 'message' => 'PDO CONNECTION ERROR WITH DATABASE - CONTACT MATTIULLAH NADIRY']);
    }
    
} catch(PDOException $e) {
    response_json(['status' => 'error', 'message' => 'Database connection failed: ' . $e->getMessage()]);
}

function response_json($output = array())
{
    header("Content-Type: application/json");
    echo json_encode($output);
    exit;
}



$passportNumber = isset($_GET['passportNumber']) ? $_GET['passportNumber'] : '';
$nationalityCode = isset($_GET['nationalityCode']) ? $_GET['nationalityCode'] : '';
$residenceID = isset($_GET['residenceID']) ? $_GET['residenceID'] : null; // Optional

if ($passportNumber == "") {
    response_json(['status' => "error", 'message' => "Passport Number not provided"]);
}

if ($nationalityCode == "") {
    response_json(['status' => "error", 'message' => "Nationality Code not provided"]);
}



$url = "https://inquiry.mohre.gov.ae/";

// Initialize cURL session
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url . 'Home/RC');
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'InquiryCode' => 'DVS',
    'InputData' => '',
    'Captcha' => '',
]));
curl_setopt($ch, CURLOPT_COOKIEJAR, dirname(__FILE__) . "/cookies_dvs.txt");
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 second timeout
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // 10 second connection timeout
$response = curl_exec($ch);

if (curl_errno($ch)) {
    $error = curl_error($ch);
    curl_close($ch);
    response_json(['status' => 'error', 'message' => 'MOHRE connection failed (initial): ' . $error]);
}
curl_close($ch);



$html = str_get_html($response);

if (!$html) {
    response_json(['status' => 'error', 'message' => 'Sorry! unable to serve you at this time']);
}

$otp = $html->find("#captchaValue", 0)->innertext ?? '';
$otpURL = $html->find('input#CaptchaURL', 0)->getAttribute("value") ?? '';
$verificationToken = $html->find('input[name=__RequestVerificationToken]', 0)->getAttribute("value") ?? '';




$formData = [
    'CaptchaURL' => $otpURL,
    'InquiryCode' => 'DVS',
    'InputData' => $passportNumber,
    'NationalityCode' => $nationalityCode,
    'Captcha' => $otp,
    'InputCaptcha' => $otp,
    'InputLanguge' => 'en',
    '__RequestVerificationToken' => $verificationToken,
    'InputPermitType' => $nationalityCode
];


$finalURL = $url . "TransactionInquiry";

// Build the POST data string
$postData = http_build_query($formData);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $finalURL);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_COOKIEFILE, dirname(__FILE__) . '/cookies_dvs.txt');
curl_setopt($ch, CURLOPT_REFERER, $url . 'Home/RC');
curl_setopt($ch, CURLOPT_TIMEOUT, 30); // 30 second timeout
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // 10 second connection timeout
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/x-www-form-urlencoded',
    'Content-Length: ' . strlen($postData)
));
$response = curl_exec($ch);

if (curl_errno($ch)) {
    $error = curl_error($ch);
    curl_close($ch);
    response_json(['status' => 'error', 'message' => 'MOHRE verification request failed: ' . $error]);
}

$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

// Extract body from response (after headers)
$data = substr($response, $header_size);



// Check for no data available message
if (strpos($data, 'not available') !== false || strpos($data, 'No Data') !== false || strpos($data, 'No data found') !== false) {
    response_json(['status' => 'success', 'message' => 'No data available', 'data' => [
        'passport_number' => $passportNumber,
        'nationality_code' => $nationalityCode,
        'verification_status' => 'No Data',
        'details' => null
    ]]);
}

$html = str_get_html($data);

if (!$html) {
    response_json(['status' => 'error', 'message' => 'Failed to parse HTML response', 'debug' => substr($data, 0, 500)]);
}

// Look for MOHRE's alert message (aegov-alert)
$verificationStatus = 'Unknown';
$verification = [];

// Primary strategy: Look for aegov-alert div
$alertDiv = $html->find('div.aegov-alert', 0);

if ($alertDiv) {
    $alertContent = $alertDiv->find('.alert-content span', 0);
    if ($alertContent) {
        $message = trim($alertContent->plaintext);
        $verification['message'] = $message;
        
        // Determine status from message
        $messageLower = strtolower($message);
        if (strpos($messageLower, 'approved') !== false || strpos($messageLower, 'verified') !== false) {
            $verificationStatus = 'Approved';
        } elseif (strpos($messageLower, 'rejected') !== false || strpos($messageLower, 'denied') !== false) {
            $verificationStatus = 'Rejected';
        } elseif (strpos($messageLower, 'pending') !== false || strpos($messageLower, 'under review') !== false) {
            $verificationStatus = 'Pending';
        } else {
            $verificationStatus = 'Unknown';
        }
    }
} else {
    // Fallback: Return debug info
    response_json([
        'status' => 'error', 
        'message' => 'No verification alert found - check debug output',
        'debug' => [
            'html_preview' => substr($data, 0, 1000),
            'has_aegov_alert' => count($html->find('div.aegov-alert')) > 0,
            'has_alert_content' => count($html->find('.alert-content')) > 0,
            'all_text' => substr($html->plaintext, 0, 500)
        ]
    ]);
}

// Status already determined from aegov-alert above

// Update database with verification status (only if residenceID is provided)
if ($residenceID) {
    try {
        $updateQuery = $pdo->prepare("
            UPDATE residence 
            SET document_verify = :status, 
                document_verify_datetime = NOW(),
                document_verify_message = :message
            WHERE residenceID = :residenceID
        ");
        
        $detailsMessage = json_encode($verification);
        
        $updateQuery->bindParam(':status', $verificationStatus);
        $updateQuery->bindParam(':message', $detailsMessage);
        $updateQuery->bindParam(':residenceID', $residenceID);
        $updateQuery->execute();
    } catch (Exception $e) {
        response_json(['status' => 'error', 'message' => 'Failed to update database: ' . $e->getMessage()]);
    }
}

$result = [
    'passport_number' => $passportNumber,
    'nationality_code' => $nationalityCode,
    'verification_status' => $verificationStatus,
    'details' => $verification
];

response_json(['status' => 'success', 'message' => 'Verification status updated successfully', 'data' => $result]);

