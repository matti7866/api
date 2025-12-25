<?php
/**
 * Passport OCR Service using OpenAI Vision API
 * Extracts data from passport images
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
 * Convert PDF to image (first page)
 */
function convertPDFToImage($pdfData) {
    // Try using Imagick if available
    if (extension_loaded('imagick')) {
        try {
            $imagick = new Imagick();
            $imagick->readImageBlob($pdfData);
            $imagick->setIteratorIndex(0); // Get first page
            $imagick->setImageFormat('jpeg');
            $imagick->setImageCompressionQuality(90);
            $imagick->setImageResolution(300, 300); // High quality for OCR
            $imageData = $imagick->getImageBlob();
            $imagick->clear();
            error_log("PDF converted to JPEG successfully using Imagick");
            return ['data' => $imageData, 'type' => 'image/jpeg'];
        } catch (Exception $e) {
            error_log("Imagick PDF conversion failed: " . $e->getMessage());
            throw new Exception("PDF conversion failed. Please upload as JPG or PNG image instead. Error: " . $e->getMessage());
        }
    }
    
    // If Imagick not available, cannot process PDF
    throw new Exception("PDF files require ImageMagick (Imagick) extension. Please upload passport as JPG or PNG image instead.");
}

/**
 * Ensure image is in JPEG format for OpenAI
 */
function ensureJPEGFormat($imageData, $mimeType) {
    // If already JPEG, return as-is
    if ($mimeType === 'image/jpeg') {
        return $imageData;
    }
    
    // Convert PNG or other formats to JPEG
    try {
        $img = imagecreatefromstring($imageData);
        if (!$img) {
            throw new Exception('Failed to create image from data');
        }
        
        // Create JPEG
        ob_start();
        imagejpeg($img, null, 90);
        $jpegData = ob_get_clean();
        imagedestroy($img);
        
        error_log("Converted $mimeType to JPEG, size: " . strlen($jpegData));
        return $jpegData;
    } catch (Exception $e) {
        error_log("Image conversion failed: " . $e->getMessage());
        // Return original if conversion fails
        return $imageData;
    }
}

/**
 * Extract passport data using OpenAI Vision
 */
function extractPassportDataWithAI($imageData, $mimeType = 'image/jpeg') {
    // IMPORTANT: Set OPENAI_API_KEY in your environment or .env file
    $apiKey = getenv('OPENAI_API_KEY') ?: $_ENV['OPENAI_API_KEY'] ?? '';
    $apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Convert PDF to image if needed
    if ($mimeType === 'application/pdf') {
        $converted = convertPDFToImage($imageData);
        $imageData = $converted['data'];
        $mimeType = $converted['type'];
        error_log("PDF converted, new type: $mimeType");
    }
    
    // Always ensure JPEG format for OpenAI (most compatible)
    $imageData = ensureJPEGFormat($imageData, $mimeType);
    $mimeType = 'image/jpeg';
    
    // Convert image to base64
    $base64 = base64_encode($imageData);
    
    error_log("Sending to OpenAI - Type: $mimeType, Size: " . strlen($imageData) . " bytes, Base64 size: " . strlen($base64));
    
    $messages = [
        [
            'role' => 'user',
            'content' => [
                [
                    'type' => 'text',
                    'text' => 'You are an expert at extracting data from passport bio-data pages. Extract information from this passport image.

Return ONLY a valid JSON object (no markdown, no explanation):

{
  "passport_number": "Passport number",
  "full_name": "Full name (format: LASTNAME, FIRSTNAME as shown on passport)",
  "surname": "Surname/Last name only",
  "given_names": "Given names/First name only",
  "nationality": "FULL Country name (e.g., Afghanistan, Pakistan, India) or 3-letter code",
  "gender": "M or F",
  "dob": "YYYY-MM-DD format",
  "place_of_birth": "Place/City of birth",
  "issue_date": "YYYY-MM-DD format",
  "expiry_date": "YYYY-MM-DD format",
  "issuing_country": "Country that issued passport",
  "mrz_line1": "First line of MRZ if visible",
  "mrz_line2": "Second line of MRZ if visible"
}

IMPORTANT:
- Convert all dates to YYYY-MM-DD format (from DD/MM/YYYY if needed)
- Gender must be exactly "M" or "F" 
- For full_name, preserve format exactly as on passport (usually "LASTNAME, FIRSTNAME")
- For nationality, use full country name if possible, or 3-letter code
- Return ONLY JSON, no other text'
                ],
                [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => 'data:' . $mimeType . ';base64,' . $base64,
                        'detail' => 'auto'  // Auto selects best detail level (faster and cheaper)
                    ]
                ]
            ]
        ]
    ];
    
    $requestData = [
        'model' => 'gpt-4o-mini',  // Use mini model - much faster and 60x cheaper
        'messages' => $messages,
        'max_tokens' => 500,
        'temperature' => 0
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
    
    $content = trim($result['choices'][0]['message']['content']);
    $content = preg_replace('/^```json\s*|\s*```$/m', '', $content);
    
    $extractedData = json_decode($content, true);
    
    if (!$extractedData) {
        throw new Exception('Failed to parse extracted data');
    }
    
    return $extractedData;
}

try {
    // Log request for debugging
    error_log("Passport OCR Request - FILES: " . print_r($_FILES, true));
    
    if (!isset($_FILES['passport'])) {
        throw new Exception('No file uploaded. Expected field name: passport');
    }
    
    if ($_FILES['passport']['error'] !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE => 'File too large (exceeds server limit)',
            UPLOAD_ERR_FORM_SIZE => 'File too large (exceeds form limit)',
            UPLOAD_ERR_PARTIAL => 'File partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'No temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file',
            UPLOAD_ERR_EXTENSION => 'Upload stopped by extension'
        ];
        $errorMsg = $uploadErrors[$_FILES['passport']['error']] ?? 'Unknown upload error';
        throw new Exception('Upload error: ' . $errorMsg);
    }
    
    $passportImageData = file_get_contents($_FILES['passport']['tmp_name']);
    
    if (!$passportImageData) {
        throw new Exception('Failed to read uploaded file');
    }
    
    // Detect MIME type from file extension (more reliable)
    $extension = strtolower(pathinfo($_FILES['passport']['name'], PATHINFO_EXTENSION));
    $mimeMap = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'pdf' => 'application/pdf'
    ];
    $mimeType = $mimeMap[$extension] ?? $_FILES['passport']['type'];
    
    error_log("Processing passport OCR - File: {$_FILES['passport']['name']}, Extension: $extension, Type: $mimeType, Size: " . strlen($passportImageData));
    
    // Convert PDF to JPEG if needed
    if ($mimeType === 'application/pdf' || $extension === 'pdf') {
        error_log("PDF detected, converting to JPEG...");
        $converted = convertPDFToImage($passportImageData);
        $passportImageData = $converted['data'];
        $mimeType = $converted['type'];
    }
    
    $extractedData = extractPassportDataWithAI($passportImageData, $mimeType);
    
    // Convert gender M/F to male/female
    if (isset($extractedData['gender'])) {
        $extractedData['gender'] = strtoupper($extractedData['gender']) === 'M' ? 'male' : 'female';
    }
    
    // Fix name format: "LASTNAME, FIRSTNAME" -> "FIRSTNAME LASTNAME"
    if (isset($extractedData['full_name']) && strpos($extractedData['full_name'], ',') !== false) {
        $parts = array_map('trim', explode(',', $extractedData['full_name']));
        if (count($parts) === 2) {
            // Reverse: [LASTNAME, FIRSTNAME] -> FIRSTNAME LASTNAME
            $extractedData['full_name'] = $parts[1] . ' ' . $parts[0];
            error_log("Name reformatted from '{$parts[0]}, {$parts[1]}' to '{$extractedData['full_name']}'");
        }
    }
    
    // Map common nationality variations to full country names (for airports.countryName)
    $nationalityVariations = [
        'afghan' => 'Afghanistan',
        'pakistani' => 'Pakistan',
        'indian' => 'India',
        'bangladeshi' => 'Bangladesh',
        'nepali' => 'Nepal',
        'sri lankan' => 'Sri Lanka',
        'filipino' => 'Philippines',
        'egyptian' => 'Egypt',
        'british' => 'United Kingdom',
        'american' => 'United States',
        'canadian' => 'Canada',
        'australian' => 'Australia',
        'emirati' => 'United Arab Emirates',
        'saudi' => 'Saudi Arabia',
        'kuwaiti' => 'Kuwait',
        'bahraini' => 'Bahrain',
        'omani' => 'Oman',
        'qatari' => 'Qatar',
        'chinese' => 'China',
        'japanese' => 'Japan',
        'korean' => 'South Korea',
        'thai' => 'Thailand',
        'vietnamese' => 'Vietnam',
        'indonesian' => 'Indonesia',
        'malaysian' => 'Malaysia',
        'singaporean' => 'Singapore'
    ];
    
    // Standardize nationality names to match database format (from airports table)
    if (isset($extractedData['nationality'])) {
        $nationalityMap = [
            // Common 3-letter codes to full country names (matching airports.countryName)
            'AFG' => 'Afghanistan',
            'PAK' => 'Pakistan',
            'IND' => 'India',
            'BGD' => 'Bangladesh',
            'NPL' => 'Nepal',
            'LKA' => 'Sri Lanka',
            'PHL' => 'Philippines',
            'EGY' => 'Egypt',
            'JOR' => 'Jordan',
            'LBN' => 'Lebanon',
            'SYR' => 'Syria',
            'IRQ' => 'Iraq',
            'YEM' => 'Yemen',
            'SDN' => 'Sudan',
            'SOM' => 'Somalia',
            'ETH' => 'Ethiopia',
            'KEN' => 'Kenya',
            'UGA' => 'Uganda',
            'TZA' => 'Tanzania',
            'GBR' => 'United Kingdom',
            'USA' => 'United States',
            'CAN' => 'Canada',
            'AUS' => 'Australia',
            'ARE' => 'United Arab Emirates',
            'SAU' => 'Saudi Arabia',
            'KWT' => 'Kuwait',
            'BHR' => 'Bahrain',
            'OMN' => 'Oman',
            'QAT' => 'Qatar',
            'CHN' => 'China',
            'JPN' => 'Japan',
            'KOR' => 'South Korea',
            'THA' => 'Thailand',
            'VNM' => 'Vietnam',
            'IDN' => 'Indonesia',
            'MYS' => 'Malaysia',
            'SGP' => 'Singapore',
            'FRA' => 'France',
            'DEU' => 'Germany',
            'ITA' => 'Italy',
            'ESP' => 'Spain',
            'NLD' => 'Netherlands',
            'BEL' => 'Belgium',
            'CHE' => 'Switzerland',
            'AUT' => 'Austria',
            'SWE' => 'Sweden',
            'NOR' => 'Norway',
            'DNK' => 'Denmark',
            'FIN' => 'Finland',
            'POL' => 'Poland',
            'RUS' => 'Russia',
            'TUR' => 'Turkey',
            'GRC' => 'Greece',
            'PRT' => 'Portugal',
            'ROU' => 'Romania',
            'HUN' => 'Hungary',
            'CZE' => 'Czech Republic',
            'BGR' => 'Bulgaria',
            'HRV' => 'Croatia',
            'SRB' => 'Serbia',
            'UKR' => 'Ukraine',
            'ZAF' => 'South Africa',
            'NGA' => 'Nigeria',
            'MAR' => 'Morocco',
            'DZA' => 'Algeria',
            'TUN' => 'Tunisia',
            'LBY' => 'Libya'
        ];
        
        $nat = strtoupper(trim($extractedData['nationality']));
        $natLower = strtolower(trim($extractedData['nationality']));
        
        // Check if it's a 3-letter code
        if (strlen($nat) === 3 && isset($nationalityMap[$nat])) {
            $extractedData['nationality'] = $nationalityMap[$nat];
            error_log("Converted nationality code '$nat' to '{$extractedData['nationality']}'");
        }
        // Check if it's a nationality variation (e.g., "Afghan" -> "Afghanistan")
        else if (isset($nationalityVariations[$natLower])) {
            $extractedData['nationality'] = $nationalityVariations[$natLower];
            error_log("Converted nationality variation '$natLower' to '{$extractedData['nationality']}'");
        }
        // If already full name, capitalize properly
        else if (strlen($nat) > 3) {
            $extractedData['nationality'] = ucwords(strtolower($extractedData['nationality']));
        }
    }
    
    error_log("Passport OCR Success - Extracted: " . json_encode($extractedData));
    
    echo json_encode([
        'success' => true,
        'data' => $extractedData
    ]);
    
} catch (Exception $e) {
    error_log("Passport OCR Error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'debug' => [
            'files_received' => isset($_FILES['passport']),
            'error_code' => $_FILES['passport']['error'] ?? 'N/A'
        ]
    ]);
}

