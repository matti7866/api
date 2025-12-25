<?php

require 'simple_html_dom.php';

function response_json($output = array())
{
    header("Content-Type: application/json");
    echo json_encode($output);
    exit;
}



$appNumber = isset($_GET['appNumber']) ? $_GET['appNumber'] : '';

if ($appNumber == "") {
    response_json(['status' => "error", 'message' => "Application Number not provided"]);
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
    'InquiryCode' => 'AS',
    'InputData' => '',
    'Captcha' => '',
]));
curl_setopt($ch, CURLOPT_COOKIEJAR, dirname(__FILE__) . "/cookies.txt"); // Save cookies here
//curl_setopt($ch, CURLOPT_COOKIEFILE, "cookies.txt"); // Read cookies from here
$response = curl_exec($ch);
curl_close($ch);



$html = str_get_html($response);

// check if unable to find request 
if (!$html) {
    response_json(['status' => 'error', 'message' => 'Sorry! unable to serve you at this time']);
}

$otp = $html->find("#captchaValue", 0)->innertext ?? '';
$otpURL = $html->find('input#CaptchaURL', 0)->getAttribute("value") ?? '';
$verificationToken = $html->find('input[name=__RequestVerificationToken]', 0)->getAttribute("value") ?? '';




$formData = [
    'CaptchaURL' => $otpURL,
    'InquiryCode' => 'AS',
    'InputData' => $appNumber,
    'Captcha' => $otp,
    'InputCaptcha' => $otp,
    'InputLanguge' => 'en',
    '__RequestVerificationToken' => $verificationToken
];


$finalURL = $url . "TransactionInquiry";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $finalURL);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
curl_setopt($ch, CURLOPT_POSTFIELDS, $formData);
curl_setopt($ch, CURLOPT_COOKIEFILE, dirname(__FILE__) . '/cookies.txt');
$a = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

$final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);

$data = file_get_contents($final_url);



if (strpos($data, 'Application Status is not available') !== false) {
    response_json(['status' => 'error', 'message' => 'Application Status is not available']);
}
$html = str_get_html($data);

$table = $html->find('ul.decription-list', 0);


$app = [
    'transaction_number' => $table->find('li', 1)->find('span', 0)->plaintext,
    'company' => $table->find('li', 0)->find('span', 0)->plaintext,
    'company_number' => $table->find('li', 2)->find('span', 0)->plaintext,
    'emirates' => $table->find('li', 3)->find('span', 0)->plaintext,
    'datetime' => date("Y-m-d h:i:s", strtotime($table->find('li', 4)->find('span', 0)->plaintext)),
    'transaction_type' => $table->find('li', 5)->find('span', 0)->plaintext,
    'location' => $table->find('li', 3)->find('span', 1)->plaintext,
    'status' => $table->find('li', 6)->find('span', 0)->plaintext,
];


response_json(['status' => 'success',  'message' => 'OK', 'data' => $app]);
