<?php
require_once __DIR__ . '/cors-headers.php';

session_start();
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Not authenticated']);
    exit();
}
require_once __DIR__ . '/../connection.php';

header('Content-Type: application/json');

// Function to generate consistent private chat ID
function generatePrivateChatId($user1, $user2) {
    $ids = [$user1, $user2];
    sort($ids);
    return implode('_', $ids);
}

$input_chat_id = $_GET['chat'] ?? 'main';
$user_id = $_SESSION['user_id'];

if ($input_chat_id === 'main') {
    $stmt = $pdo->prepare("
        SELECT cm.*, 
               COALESCE(s.staff_name, 'Unknown') as staff_name, 
               COALESCE(s.staff_pic, '') as staff_pic,
               COALESCE(cm.type, CASE WHEN cm.attachment IS NOT NULL THEN 'attachment' WHEN cm.voice_message IS NOT NULL THEN 'voice' WHEN cm.bot_name IS NOT NULL THEN 'bot' ELSE 'text' END) as type
        FROM chat_messages cm 
        LEFT JOIN staff s ON cm.staff_id = s.staff_id 
        WHERE cm.chat_id = 'main' 
        ORDER BY cm.timestamp ASC
    ");
    $stmt->execute();
} else {
    $chat_id = generatePrivateChatId($user_id, $input_chat_id);
    $stmt = $pdo->prepare("
        SELECT cm.*, 
               COALESCE(s.staff_name, 'Unknown') as staff_name, 
               COALESCE(s.staff_pic, '') as staff_pic,
               COALESCE(cm.type, CASE WHEN cm.attachment IS NOT NULL THEN 'attachment' WHEN cm.voice_message IS NOT NULL THEN 'voice' WHEN cm.bot_name IS NOT NULL THEN 'bot' ELSE 'text' END) as type
        FROM chat_messages cm 
        LEFT JOIN staff s ON cm.staff_id = s.staff_id 
        WHERE cm.chat_id = ? 
        ORDER BY cm.timestamp ASC
    ");
    $stmt->execute([$chat_id]);
}

$messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($messages);
exit();
?>

