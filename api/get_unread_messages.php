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

$user_id = $_SESSION['user_id'];
$unread_counts = [];

try {
    // Get the last time user viewed each chat from the session
    $last_viewed = $_SESSION['last_viewed_chats'] ?? [];
    
    // For main chat
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM chat_messages 
        WHERE chat_id = 'main' 
        AND staff_id != ? 
        AND timestamp > ?
    ");
    $stmt->execute([
        $user_id, 
        isset($last_viewed['main']) ? date('Y-m-d H:i:s', $last_viewed['main']) : '1970-01-01'
    ]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $unread_counts['main'] = (int)($result['count'] ?? 0);
    
    // For private chats - need to generate chat_id properly
    // Get all staff members
    $staff_stmt = $pdo->prepare("SELECT staff_id FROM staff WHERE staff_id != ? AND status = 1");
    $staff_stmt->execute([$user_id]);
    $staff_members = $staff_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($staff_members as $staff) {
        $other_user_id = $staff['staff_id'];
        
        // Generate private chat ID
        $ids = [$user_id, $other_user_id];
        sort($ids);
        $chat_id = implode('_', $ids);
        
        $last_time = isset($last_viewed[$other_user_id]) ? 
            date('Y-m-d H:i:s', $last_viewed[$other_user_id]) : '1970-01-01';
        
        // Count unread messages in this private chat (messages not from current user)
        $count_stmt = $pdo->prepare("
            SELECT COUNT(*) AS count
            FROM chat_messages cm
            WHERE cm.chat_id = ?
            AND cm.staff_id != ?
            AND cm.timestamp > ?
        ");
        $count_stmt->execute([$chat_id, $user_id, $last_time]);
        $result = $count_stmt->fetch(PDO::FETCH_ASSOC);
        $unread_counts[$other_user_id] = (int)($result['count'] ?? 0);
    }
    
    // Update last viewed time for current chat
    if(isset($_GET['mark_read']) && $_GET['mark_read']) {
        $mark_read_chat = $_GET['mark_read'];
        if (!isset($_SESSION['last_viewed_chats'])) {
            $_SESSION['last_viewed_chats'] = [];
        }
        $_SESSION['last_viewed_chats'][$mark_read_chat] = time();
        
        // Also update the database if there's a read tracking table
        // For now, just update session
    }
    
    echo json_encode($unread_counts);

} catch (Exception $e) {
    error_log("Error in get_unread_messages.php: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
}
?>

