<?php
require_once __DIR__ . '/cors-headers.php';

ob_start();
session_start();

if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    exit();
}

require_once __DIR__ . '/../connection.php';
header('Content-Type: application/json');
$response = ['status' => 'error', 'message' => ''];

// Function to generate consistent private chat ID
function generatePrivateChatId($user1, $user2) {
    $ids = [$user1, $user2];
    sort($ids);
    return implode('_', $ids);
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $staff_id = $_SESSION['user_id'];
    
    // Get POST data - use $_POST directly as filter_input may not work with FormData
    $input_chat_id = isset($_POST['chat_id']) ? trim($_POST['chat_id']) : 'main';
    $message = isset($_POST['message']) ? trim($_POST['message']) : '';
    
    // Determine chat_id
    $chat_id = ($input_chat_id === 'main') ? 'main' : generatePrivateChatId($staff_id, $input_chat_id);
    
    // Get staff name for the response
    $stmt = $pdo->prepare("SELECT staff_name, staff_pic FROM staff WHERE staff_id = ?");
    $stmt->execute([$staff_id]);
    $staff_info = $stmt->fetch(PDO::FETCH_ASSOC);
    $staff_name = $staff_info['staff_name'] ?? 'Unknown';
    $staff_pic = $staff_info['staff_pic'] ?? '';

    // Handle text message if present
    if (!empty($message)) {
        // Check if type column exists, if not default to 'text'
        $type = 'text';
        try {
            $stmt = $pdo->prepare("
                INSERT INTO chat_messages (staff_id, chat_id, message, timestamp, type) 
                VALUES (?, ?, ?, NOW(), ?)
            ");
            $stmt->execute([$staff_id, $chat_id, $message, $type]);
        } catch (PDOException $e) {
            // If type column doesn't exist, insert without it
            if (strpos($e->getMessage(), 'Unknown column') !== false) {
                $stmt = $pdo->prepare("
                    INSERT INTO chat_messages (staff_id, chat_id, message, timestamp) 
                    VALUES (?, ?, ?, NOW())
                ");
                $stmt->execute([$staff_id, $chat_id, $message]);
            } else {
                throw $e;
            }
        }
        
        $message_id = $pdo->lastInsertId();
        
        // Get the timestamp
        $stmt = $pdo->prepare("SELECT timestamp FROM chat_messages WHERE id = ?");
        $stmt->execute([$message_id]);
        $timestamp = $stmt->fetch(PDO::FETCH_ASSOC)['timestamp'];
        
        $response = [
            'status' => 'success',
            'message_id' => $message_id,
            'firebase_data' => [
                'id' => $message_id,
                'staff_id' => $staff_id,
                'staff_name' => $staff_name,
                'staff_pic' => $staff_pic,
                'chat_id' => $chat_id,
                'message' => $message,
                'timestamp' => $timestamp,
                'type' => 'text',
                'recipient_id' => ($input_chat_id !== 'main') ? $input_chat_id : null
            ]
        ];
    }

    // Handle voice message
    if (isset($_FILES['voice_message']) && $_FILES['voice_message']['error'] === UPLOAD_ERR_OK) {
        $voice_duration = isset($_POST['voice_duration']) ? (float)$_POST['voice_duration'] : 0;
        $upload_dir = __DIR__ . '/../Uploads/voice/';
        
        if (!file_exists($upload_dir)) {
            @mkdir($upload_dir, 0777, true);
        }
        
        $file_type = $_FILES['voice_message']['type'];
        $file_tmp = $_FILES['voice_message']['tmp_name'];
        $unique_id = uniqid();
        $voice_path = 'Uploads/voice/' . $unique_id . '.webm';
        $full_path = __DIR__ . '/../' . $voice_path;
        
        if (move_uploaded_file($file_tmp, $full_path)) {
            $stmt = $pdo->prepare("
                INSERT INTO chat_messages (staff_id, chat_id, voice_message, voice_duration, timestamp, type) 
                VALUES (?, ?, ?, ?, NOW(), 'voice')
            ");
            $stmt->execute([$staff_id, $chat_id, $voice_path, $voice_duration]);
            
            $message_id = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT timestamp FROM chat_messages WHERE id = ?");
            $stmt->execute([$message_id]);
            $timestamp = $stmt->fetch(PDO::FETCH_ASSOC)['timestamp'];
            
            $response = [
                'status' => 'success',
                'firebase_data' => [
                    'id' => $message_id,
                    'staff_id' => $staff_id,
                    'staff_name' => $staff_name,
                    'staff_pic' => $staff_pic,
                    'chat_id' => $chat_id,
                    'voice_message' => $voice_path,
                    'voice_duration' => $voice_duration,
                    'timestamp' => $timestamp,
                    'type' => 'voice',
                    'recipient_id' => ($input_chat_id !== 'main') ? $input_chat_id : null
                ]
            ];
        }
    }

    // Handle bot command
    if (isset($_POST['bot_command']) && !empty($_POST['bot_command'])) {
        $bot_command = $_POST['bot_command'];
        $bot_params = isset($_POST['bot_params']) ? json_decode($_POST['bot_params'], true) : [];
        
        // Process bot commands
        $bot_response = '';
        $bot_name = 'ChatBot';
        
        switch ($bot_command) {
            case '/weather':
                $location = $bot_params['location'] ?? 'Dubai';
                $bot_response = "🌤️ Weather in {$location}: Sunny, 28°C";
                break;
            case '/time':
                $bot_response = "🕐 Current time: " . date('Y-m-d H:i:s');
                break;
            case '/joke':
                $jokes = [
                    "Why don't scientists trust atoms? Because they make up everything! 😄",
                    "I told my wife she was drawing her eyebrows too high. She looked surprised! 😂",
                    "Why did the scarecrow win an award? He was outstanding in his field! 🌾"
                ];
                $bot_response = $jokes[array_rand($jokes)];
                break;
            case '/quote':
                $quotes = [
                    "The only way to do great work is to love what you do. - Steve Jobs",
                    "Innovation distinguishes between a leader and a follower. - Steve Jobs",
                    "Life is what happens to you while you're busy making other plans. - John Lennon"
                ];
                $bot_response = "💭 " . $quotes[array_rand($quotes)];
                break;
            case '/help':
                $bot_response = "🤖 Available commands:\n/weather - Get weather info\n/time - Current time\n/joke - Random joke\n/quote - Inspirational quote\n/help - Show this help";
                break;
            default:
                $bot_response = "Unknown command. Type /help for available commands.";
        }
        
        if ($bot_response) {
            $stmt = $pdo->prepare("
                INSERT INTO chat_messages (staff_id, chat_id, message, timestamp, type, bot_name) 
                VALUES (?, ?, ?, NOW(), 'bot', ?)
            ");
            $stmt->execute([0, $chat_id, $bot_response, $bot_name]);
            
            $message_id = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT timestamp FROM chat_messages WHERE id = ?");
            $stmt->execute([$message_id]);
            $timestamp = $stmt->fetch(PDO::FETCH_ASSOC)['timestamp'];
            
            $response = [
                'status' => 'success',
                'firebase_data' => [
                    'id' => $message_id,
                    'staff_id' => 0,
                    'staff_name' => $bot_name,
                    'chat_id' => $chat_id,
                    'message' => $bot_response,
                    'timestamp' => $timestamp,
                    'type' => 'bot',
                    'bot_name' => $bot_name,
                    'recipient_id' => ($input_chat_id !== 'main') ? $input_chat_id : null
                ]
            ];
        }
    }

    // Handle multiple attachments
    if (isset($_FILES['attachments']) && !empty($_FILES['attachments']['name'][0])) {
        $allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        $max_size = 5 * 1024 * 1024; // 5MB
        $upload_dir = __DIR__ . '/../Uploads/';
        
        // Make sure upload directory exists and is writable
        if (!file_exists($upload_dir)) {
            if (!@mkdir($upload_dir, 0777, true)) {
                throw new Exception("Failed to create uploads directory. Please check permissions.");
            }
        } elseif (!is_writable($upload_dir)) {
            throw new Exception("Uploads directory is not writable. Please check permissions.");
        }

        $file_count = count($_FILES['attachments']['name']);
        for ($i = 0; $i < $file_count; $i++) {
            if ($_FILES['attachments']['error'][$i] === UPLOAD_ERR_OK) {
                $file_type = $_FILES['attachments']['type'][$i];
                $file_size = $_FILES['attachments']['size'][$i];
                $file_name = $_FILES['attachments']['name'][$i];
                $file_tmp = $_FILES['attachments']['tmp_name'][$i];

                if (in_array($file_type, $allowed_types) && $file_size <= $max_size) {
                    $ext = pathinfo($file_name, PATHINFO_EXTENSION);
                    $unique_id = uniqid();
                    $attachment_path = 'Uploads/' . $unique_id . '.' . $ext;
                    $full_path = __DIR__ . '/../' . $attachment_path;

                    if (move_uploaded_file($file_tmp, $full_path)) {
                        $stmt = $pdo->prepare("
                            INSERT INTO chat_messages (staff_id, chat_id, attachment, filename, timestamp) 
                            VALUES (?, ?, ?, ?, NOW())
                        ");
                        $stmt->execute([$staff_id, $chat_id, $attachment_path, $file_name]);
                        
                        // Get the ID of the inserted message
                        $message_id = $pdo->lastInsertId();
                        
                        // Get the timestamp for Firebase
                        $stmt = $pdo->prepare("SELECT timestamp FROM chat_messages WHERE id = ?");
                        $stmt->execute([$message_id]);
                        $timestamp = $stmt->fetch(PDO::FETCH_ASSOC)['timestamp'];
                        
                        $response = [
                            'status' => 'success',
                            'firebase_data' => [
                                'id' => $message_id,
                                'staff_id' => $staff_id,
                                'staff_name' => $staff_name,
                                'staff_pic' => $staff_pic,
                                'chat_id' => $chat_id,
                                'attachment' => $attachment_path,
                                'filename' => $file_name,
                                'timestamp' => $timestamp,
                                'type' => 'attachment',
                                'recipient_id' => ($input_chat_id !== 'main') ? $input_chat_id : null
                            ]
                        ];
                    } else {
                        throw new Exception("Failed to move uploaded file: $file_name. Check permissions on upload directory.");
                    }
                } else {
                    throw new Exception("Invalid file type or size for $file_name (max 5MB, allowed: images, PDF)");
                }
            } elseif ($_FILES['attachments']['error'][$i] !== UPLOAD_ERR_NO_FILE) {
                $error_code = $_FILES['attachments']['error'][$i];
                $error_message = match($error_code) {
                    UPLOAD_ERR_INI_SIZE => "The uploaded file exceeds the upload_max_filesize directive in php.ini",
                    UPLOAD_ERR_FORM_SIZE => "The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form",
                    UPLOAD_ERR_PARTIAL => "The uploaded file was only partially uploaded",
                    UPLOAD_ERR_NO_TMP_DIR => "Missing a temporary folder",
                    UPLOAD_ERR_CANT_WRITE => "Failed to write file to disk",
                    UPLOAD_ERR_EXTENSION => "File upload stopped by extension",
                    default => "Unknown upload error"
                };
                throw new Exception("Upload error for file $i: $error_message (code: $error_code)");
            }
        }
    }

    if ($response['status'] !== 'success') {
        $response['message'] = 'No message or valid attachments provided';
    }

} catch (Exception $e) {
    $response['message'] = $e->getMessage();
    error_log("Send Message Error: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
}

ob_end_clean();
echo json_encode($response);
exit();
?>

