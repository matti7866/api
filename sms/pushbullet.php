<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../../connection.php';
    require_once __DIR__ . '/../auth/JWTHelper.php';
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to load required files: ' . $e->getMessage()
    ]);
    exit;
}

// Verify JWT token
$user = JWTHelper::verifyRequest();
if (!$user) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
    exit;
}

// Pushbullet Configuration
define('PUSHBULLET_ACCESS_TOKEN', 'o.z73AL8X1FrE0bUJNYDsFQ4ilrCqmie1p');
define('PUSHBULLET_API_BASE', 'https://api.pushbullet.com/v2');

/**
 * Make a request to Pushbullet API
 */
function pushbulletRequest($endpoint, $method = 'GET', $data = null) {
    $url = PUSHBULLET_API_BASE . $endpoint;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Disable SSL verification for local dev
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Access-Token: ' . PUSHBULLET_ACCESS_TOKEN,
        'Content-Type: application/json'
    ]);
    
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        error_log("Pushbullet API Error - HTTP $httpCode: $response");
        error_log("CURL Error: $curlError");
        error_log("Endpoint was: $endpoint");
        throw new Exception("Pushbullet API error: HTTP $httpCode - " . substr($response, 0, 200));
    }
    
    $decoded = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("JSON decode error: " . json_last_error_msg());
        error_log("Response was: " . substr($response, 0, 500));
    }
    
    return $decoded;
}

try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    // Get SMS threads (conversations)
    if ($action === 'getThreads') {
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
        $response = pushbulletRequest('/texts?limit=' . $limit);
        
        echo json_encode([
            'success' => true,
            'data' => $response['threads'] ?? []
        ]);
        exit;
    }
    
    // Get messages from a specific thread
    if ($action === 'getMessages') {
        $deviceIden = $_GET['device_iden'] ?? '';
        $threadId = $_GET['thread_id'] ?? '';
        
        if (empty($deviceIden) || empty($threadId)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'device_iden and thread_id are required'
            ]);
            exit;
        }
        
        // Fetch messages for this thread on this device
        // Add modified_after parameter to get only recent messages (last 30 days)
        $modifiedAfter = time() - (30 * 24 * 60 * 60); // 30 days ago
        $endpoint = '/permanents/' . $deviceIden . '_thread_' . $threadId . '?modified_after=' . $modifiedAfter;
        
        $response = pushbulletRequest($endpoint);
        
        // Log for debugging
        error_log("Fetching messages for thread $threadId on device $deviceIden");
        error_log("Response has " . (isset($response['thread']) ? count($response['thread']) : 0) . " messages");
        
        echo json_encode([
            'success' => true,
            'data' => $response
        ]);
        exit;
    }
    
    // Send SMS
    if ($action === 'sendSMS') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $deviceIden = $input['device_iden'] ?? '';
        $phoneNumber = $input['phone_number'] ?? '';
        $message = $input['message'] ?? '';
        
        if (empty($deviceIden) || empty($phoneNumber) || empty($message)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'device_iden, phone_number, and message are required'
            ]);
            exit;
        }
        
        $data = [
            'push' => [
                'type' => 'messaging_extension_reply',
                'package_name' => 'com.pushbullet.android',
                'source_user_iden' => $deviceIden,
                'target_device_iden' => $deviceIden,
                'conversation_iden' => $phoneNumber,
                'message' => $message
            ]
        ];
        
        $response = pushbulletRequest('/ephemerals', 'POST', $data);
        
        echo json_encode([
            'success' => true,
            'message' => 'SMS sent successfully',
            'data' => $response
        ]);
        exit;
    }
    
    // Get devices
    if ($action === 'getDevices') {
        $response = pushbulletRequest('/devices');
        
        echo json_encode([
            'success' => true,
            'data' => $response['devices'] ?? []
        ]);
        exit;
    }
    
    // Get SMS threads for a specific device
    if ($action === 'getSMSThreads') {
        $deviceIden = $_GET['device_iden'] ?? '';
        
        if (empty($deviceIden)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'device_iden is required'
            ]);
            exit;
        }
        
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
        
        // Fetch SMS threads for this device
        $response = pushbulletRequest('/permanents/' . $deviceIden . '_threads');
        
        if (isset($response['threads']) && is_array($response['threads'])) {
            // Format for easy display
            $formattedSMS = [];
            foreach ($response['threads'] as $thread) {
                $recipient = $thread['recipients'][0] ?? [];
                $latest = $thread['latest'] ?? [];
                
                $formattedSMS[] = [
                    'thread_id' => $thread['id'] ?? '',
                    'phone_number' => $recipient['number'] ?? $recipient['address'] ?? 'Unknown',
                    'contact_name' => $recipient['name'] ?? null,
                    'latest_message' => $latest['body'] ?? '',
                    'latest_timestamp' => $latest['timestamp'] ?? 0,
                    'latest_direction' => $latest['direction'] ?? 'incoming',
                    'unread' => false
                ];
            }
            
            echo json_encode([
                'success' => true,
                'data' => $formattedSMS,
                'count' => count($formattedSMS)
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'data' => [],
                'count' => 0,
                'message' => 'No SMS threads found for this device'
            ]);
        }
        exit;
    }
    
    // Invalid action
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid action. Available actions: getThreads, getMessages, sendSMS, getDevices, getAllSMS'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
?>

