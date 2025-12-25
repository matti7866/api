<?php

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: text/html; charset=utf-8");

require 'simple_html_dom.php';

echo "<h2>Testing MOHRE Document Verification Service</h2>";
echo "<hr>";

$passportNumber = isset($_GET['passportNumber']) ? $_GET['passportNumber'] : 'P06154607';
$nationalityCode = isset($_GET['nationalityCode']) ? $_GET['nationalityCode'] : '209';

echo "<p><strong>Testing with:</strong></p>";
echo "<ul>";
echo "<li>Passport: $passportNumber</li>";
echo "<li>Nationality Code: $nationalityCode</li>";
echo "</ul>";

$url = "https://inquiry.mohre.gov.ae/";

echo "<h3>Step 1: Getting initial page and captcha...</h3>";

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
curl_setopt($ch, CURLOPT_COOKIEJAR, dirname(__FILE__) . "/cookies_test.txt");
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo "<p style='color:red'>Error: " . curl_error($ch) . "</p>";
    curl_close($ch);
    exit;
}
curl_close($ch);

echo "<p style='color:green'>✓ Got initial response</p>";

$html = str_get_html($response);

if (!$html) {
    echo "<p style='color:red'>Failed to parse HTML</p>";
    echo "<pre>" . htmlspecialchars(substr($response, 0, 1000)) . "</pre>";
    exit;
}

$otp = $html->find("#captchaValue", 0)->innertext ?? '';
$otpURL = $html->find('input#CaptchaURL', 0)->getAttribute("value") ?? '';
$verificationToken = $html->find('input[name=__RequestVerificationToken]', 0)->getAttribute("value") ?? '';

echo "<p><strong>Extracted values:</strong></p>";
echo "<ul>";
echo "<li>OTP: $otp</li>";
echo "<li>OTP URL: " . substr($otpURL, 0, 50) . "...</li>";
echo "<li>Token: " . substr($verificationToken, 0, 50) . "...</li>";
echo "</ul>";

echo "<h3>Step 2: Submitting verification request...</h3>";

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
$postData = http_build_query($formData);

echo "<p>Posting to: $finalURL</p>";
echo "<p>Post data length: " . strlen($postData) . " bytes</p>";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $finalURL);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_COOKIEFILE, dirname(__FILE__) . '/cookies_test.txt');
curl_setopt($ch, CURLOPT_REFERER, $url . 'Home/RC');
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/x-www-form-urlencoded',
    'Content-Length: ' . strlen($postData)
));
$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo "<p style='color:red'>Error: " . curl_error($ch) . "</p>";
    curl_close($ch);
    exit;
}

$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

echo "<p style='color:green'>✓ Got response</p>";
echo "<p><strong>HTTP Code:</strong> $httpcode</p>";
echo "<p><strong>Final URL:</strong> $final_url</p>";

$headers = substr($response, 0, $header_size);
$body = substr($response, $header_size);

echo "<h3>Response Headers:</h3>";
echo "<pre>" . htmlspecialchars($headers) . "</pre>";

echo "<h3>Response Body (first 2000 characters):</h3>";
echo "<pre>" . htmlspecialchars(substr($body, 0, 2000)) . "</pre>";

echo "<h3>Full HTML Structure:</h3>";
$html2 = str_get_html($body);
if ($html2) {
    echo "<ul>";
    echo "<li>Tables found: " . count($html2->find('table')) . "</li>";
    echo "<li>ULs found: " . count($html2->find('ul')) . "</li>";
    echo "<li>Divs found: " . count($html2->find('div')) . "</li>";
    echo "<li>Forms found: " . count($html2->find('form')) . "</li>";
    echo "</ul>";
    
    // Show all text content
    echo "<h3>All visible text:</h3>";
    echo "<pre>" . htmlspecialchars($html2->plaintext) . "</pre>";
} else {
    echo "<p style='color:red'>Could not parse HTML</p>";
}

?>

