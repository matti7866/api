<?php
require_once __DIR__ . '/cors-headers.php';

session_start();
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'User not logged in']);
    exit;
}

require_once __DIR__ . '/../connection.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'getStaff':
            // Get all active staff members except current user
            $stmt = $pdo->prepare("
                SELECT staff_id, staff_name, staff_pic, status 
                FROM staff 
                WHERE staff_id != ? AND status = 1
                ORDER BY staff_name ASC
            ");
            $stmt->execute([$_SESSION['user_id']]);
            $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($staff);
            break;

        case 'search':
            $query = $_GET['query'] ?? '';
            $chat_id = $_GET['chat_id'] ?? null;
            
            if (empty($query)) {
                echo json_encode([]);
                break;
            }
            
            $searchTerm = '%' . $query . '%';
            
            if ($chat_id) {
                $stmt = $pdo->prepare("
                    SELECT cm.*, s.staff_name, s.staff_pic 
                    FROM chat_messages cm 
                    JOIN staff s ON cm.staff_id = s.staff_id 
                    WHERE cm.chat_id = ? 
                    AND (cm.message LIKE ? OR cm.filename LIKE ?)
                    ORDER BY cm.timestamp DESC
                    LIMIT 50
                ");
                $stmt->execute([$chat_id, $searchTerm, $searchTerm]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT cm.*, s.staff_name, s.staff_pic 
                    FROM chat_messages cm 
                    JOIN staff s ON cm.staff_id = s.staff_id 
                    WHERE (cm.message LIKE ? OR cm.filename LIKE ?)
                    ORDER BY cm.timestamp DESC
                    LIMIT 50
                ");
                $stmt->execute([$searchTerm, $searchTerm]);
            }
            
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($results);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>

