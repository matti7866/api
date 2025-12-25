<?php
/**
 * Emirates ID OCR Service
 * Extracts data from Emirates ID front and back images
 * Uses OCR.space free API
 */

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}


/**
 * Perform OCR using OpenAI Vision API
 */
function performOCRWithOpenAI($frontImageData, $backImageData) {
    // IMPORTANT: Set OPENAI_API_KEY in your environment or .env file
    $apiKey = getenv('OPENAI_API_KEY') ?: $_ENV['OPENAI_API_KEY'] ?? '';
    $apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Convert images to base64
    $frontBase64 = base64_encode($frontImageData);
    $backBase64 = base64_encode($backImageData);
    
    // Prepare the request to GPT-4 Vision
    $messages = [
        [
            'role' => 'user',
            'content' => [
                [
                    'type' => 'text',
                    'text' => 'You are an expert at extracting data from UAE Emirates ID cards. I am providing you with two images: FRONT and BACK of an Emirates ID card.

Please extract and return ONLY a valid JSON object with the following structure (no markdown, no explanation, just the JSON):

{
  "eid_number": "784-XXXX-XXXXXXX-X format",
  "full_name": "Full name in English (First Middle Last)",
  "gender": "male or female",
  "dob": "YYYY-MM-DD format",
  "nationality": "Country name",
  "expiry_date": "YYYY-MM-DD format",
  "profession": "Profession/Occupation from back",
  "establishment": "Establishment/Company name from back"
}

IMPORTANT:
- Dates must be in YYYY-MM-DD format (convert from DD/MM/YYYY if needed)
- Extract the full name properly (not just initials)
- Do NOT include issue_date
- Return ONLY the JSON, no other text'
                ],
                [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => 'data:image/jpeg;base64,' . $frontBase64,
                        'detail' => 'auto'
                    ]
                ],
                [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => 'data:image/jpeg;base64,' . $backBase64,
                        'detail' => 'auto'
                    ]
                ]
            ]
        ]
    ];
    
    $requestData = [
        'model' => 'gpt-4o-mini',  // Mini model - faster and cheaper, still very accurate
        'messages' => $messages,
        'max_tokens' => 500,
        'temperature' => 0  // Deterministic output
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        throw new Exception('OpenAI API Error: ' . $curlError);
    }
    
    if ($httpCode !== 200) {
        $errorDetails = json_decode($response, true);
        $errorMsg = $errorDetails['error']['message'] ?? 'HTTP ' . $httpCode;
        throw new Exception('OpenAI API Error: ' . $errorMsg);
    }
    
    $result = json_decode($response, true);
    
    if (!isset($result['choices'][0]['message']['content'])) {
        throw new Exception('Invalid response from OpenAI');
    }
    
    // Extract JSON from response
    $content = trim($result['choices'][0]['message']['content']);
    
    // Remove markdown code blocks if present
    $content = preg_replace('/^```json\s*|\s*```$/m', '', $content);
    
    $extractedData = json_decode($content, true);
    
    if (!$extractedData) {
        throw new Exception('Failed to parse extracted data');
    }
    
    return $extractedData;
}

try {
    // Check if both images were uploaded
    if (!isset($_FILES['front']) || !isset($_FILES['back'])) {
        throw new Exception('Both front and back images are required');
    }
    
    if ($_FILES['front']['error'] !== UPLOAD_ERR_OK || $_FILES['back']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Error uploading files');
    }
    
    // Read image data
    $frontImageData = file_get_contents($_FILES['front']['tmp_name']);
    $backImageData = file_get_contents($_FILES['back']['tmp_name']);
    
    // Use OpenAI Vision to extract data
    $aiExtractedData = performOCRWithOpenAI($frontImageData, $backImageData);
    
    // Return the extracted data in the expected format
    $response = [
        'success' => true,
        'front' => [
            'eid_number' => $aiExtractedData['eid_number'] ?? '',
            'full_name' => $aiExtractedData['full_name'] ?? '',
            'gender' => $aiExtractedData['gender'] ?? '',
            'dob' => $aiExtractedData['dob'] ?? '',
            'expiry_date' => $aiExtractedData['expiry_date'] ?? '',
            'nationality' => $aiExtractedData['nationality'] ?? ''
        ],
        'back' => [
            'profession' => $aiExtractedData['profession'] ?? '',
            'establishment' => $aiExtractedData['establishment'] ?? ''
        ],
        'raw_ai_response' => $aiExtractedData  // For debugging
    ];
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

