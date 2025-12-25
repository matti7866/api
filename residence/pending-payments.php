<?php

require 'simple_html_dom.php';

function response_json($output = array())
{
    header("Content-Type: application/json");
    echo json_encode($output);
    exit;
}



$companyCode = isset($_GET['companyCode']) ? $_GET['companyCode'] : '';

if ($companyCode == "") {
    response_json(['status' => "error", 'message' => "Company Code not provided"]);
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
    'InquiryCode' => 'PP',
    'InputData' => '',
    'Captcha' => '',
]));
curl_setopt($ch, CURLOPT_COOKIEJAR, dirname(__FILE__) . "/cookies_pp.txt"); // Save cookies here
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
    'InquiryCode' => 'PP',
    'InputData' => $companyCode,
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
curl_setopt($ch, CURLOPT_COOKIEFILE, dirname(__FILE__) . '/cookies_pp.txt');
$a = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

$final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);

$data = file_get_contents($final_url);



// Check for no pending payments message
if (strpos($data, 'No Pending Payments') !== false || strpos($data, 'not available') !== false) {
    response_json(['status' => 'success', 'message' => 'No pending payments found', 'data' => [
        'company_code' => $companyCode,
        'company_name' => '',
        'payments' => []
    ]]);
}

$html = str_get_html($data);

// Extract company information
$companyNameElement = $html->find('li span', 0);
$companyName = $companyNameElement ? $companyNameElement->plaintext : '';

// Find the payments table
$table = $html->find('table', 0);

if (!$table) {
    response_json(['status' => 'error', 'message' => 'Unable to parse payment data']);
}

$payments = [];

// Parse table rows (skip header row)
$rows = $table->find('tr');
for ($i = 1; $i < count($rows); $i++) {
    $row = $rows[$i];
    $cols = $row->find('td');
    
    if (count($cols) >= 5) {
        $payment = [
            'transaction_number' => trim($cols[0]->plaintext),
            'person_name' => trim($cols[1]->plaintext),
            'pay_card_number' => trim($cols[2]->plaintext),
            'card_number' => trim($cols[3]->plaintext),
            'card_expiry_date' => trim($cols[4]->plaintext),
        ];
        
        // Get transaction type and remarks if available
        if (isset($cols[5])) {
            $payment['transaction_type'] = trim($cols[5]->plaintext);
        }
        
        if (isset($cols[6])) {
            $payment['remarks'] = trim($cols[6]->plaintext);
        }
        
        $payments[] = $payment;
    }
}

// Try to extract company code and name from the page
$companyInfoList = $html->find('ul.decription-list', 0);
if ($companyInfoList) {
    $companyCodeElement = $companyInfoList->find('li', 0);
    $companyNameElement = $companyInfoList->find('li', 1);
    
    if ($companyCodeElement && $companyCodeElement->find('span', 0)) {
        $extractedCompanyCode = $companyCodeElement->find('span', 0)->plaintext;
    }
    
    if ($companyNameElement && $companyNameElement->find('span', 0)) {
        $companyName = $companyNameElement->find('span', 0)->plaintext;
    }
}

$result = [
    'company_code' => $companyCode,
    'company_name' => $companyName,
    'total_payments' => count($payments),
    'payments' => $payments
];

response_json(['status' => 'success', 'message' => 'OK', 'data' => $result]);

