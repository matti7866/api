<?php
require_once __DIR__ . '/../cors-headers.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if(!isset($_SESSION['user_id'])){
    // Try JWT token from Authorization header
    require_once(__DIR__ . '/../auth/JWTHelper.php');
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
        $decoded = JWTHelper::validateToken($token);
        if ($decoded && isset($decoded->data)) {
            $_SESSION['user_id'] = $decoded->data->staff_id ?? null;
            $_SESSION['role_id'] = $decoded->data->role_id ?? null;
            $_SESSION['staff_name'] = $decoded->data->staff_name ?? '';
        }
    }
    
    if(!isset($_SESSION['user_id'])){
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required']);
        exit;
    }
}

require_once __DIR__ . '/../../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

// Get action from request
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_POST['action'] ?? null;

if (!$action) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Action is required']);
    exit;
}

// Database connection - check both locations like send-otp.php
if (file_exists(__DIR__ . '/../../connection.php')) {
    require_once __DIR__ . '/../../connection.php';
} else {
    require_once __DIR__ . '/../connection.php';
}

if (!isset($pdo) || $pdo === null) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection not available']);
    exit;
}

// Gmail SMTP Configuration (same as send-otp.php)
$gmailConfig = [
    'smtp_host' => 'smtp.gmail.com',
    'smtp_port' => 587,
    'smtp_username' => 'selabnadirydxb@gmail.com',
    'smtp_password' => 'zdwefhpewgyqmdkl',
    'from_email' => 'selabnadirydxb@gmail.com',
    'from_name' => 'SN Travels & Tourism'
];

// Handle different actions
switch ($action) {
    case 'getEmails':
        getEmails($pdo, $input);
        break;
    case 'getEmail':
        getEmail($pdo, $input);
        break;
    case 'sendEmail':
        sendEmail($gmailConfig, $input);
        break;
    case 'deleteEmail':
        deleteEmail($pdo, $input);
        break;
    case 'markAsRead':
        markAsRead($pdo, $input);
        break;
    case 'searchEmails':
        searchEmails($pdo, $input);
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
        break;
}

/**
 * Get emails from database (store sent/received emails in DB)
 */
function getEmails($pdo, $input) {
    try {
        $labelId = $input['labelIds'][0] ?? 'INBOX';
        $limit = $input['limit'] ?? 50;
        
        // For now, return emails from database table
        // Create a simple email_log table to store sent/received emails
        
        $sql = "SELECT * FROM email_log 
                WHERE label = :label 
                ORDER BY created_at DESC 
                LIMIT :limit";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':label', $labelId);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $emails = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $emails[] = [
                'id' => $row['id'],
                'threadId' => $row['id'],
                'from' => $row['from_email'],
                'subject' => $row['subject'],
                'date' => $row['created_at'],
                'snippet' => substr(strip_tags($row['body']), 0, 150),
                'isUnread' => (bool)$row['is_unread'],
                'isStarred' => (bool)$row['is_starred'],
                'labels' => [$row['label']]
            ];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $emails,
            'nextPageToken' => null,
            'resultSizeEstimate' => count($emails)
        ]);
        
    } catch (PDOException $e) {
        // Table might not exist yet
        if (strpos($e->getMessage(), "doesn't exist") !== false) {
            // Create table and return empty
            createEmailLogTable($pdo);
            echo json_encode([
                'success' => true,
                'data' => [],
                'nextPageToken' => null,
                'resultSizeEstimate' => 0
            ]);
        } else {
            error_log('Get emails error: ' . $e->getMessage());
            echo json_encode(['success' => false, 'message' => 'Failed to fetch emails: ' . $e->getMessage()]);
        }
    }
}

/**
 * Create email_log table
 */
function createEmailLogTable($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS email_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_email VARCHAR(255) NOT NULL,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        body TEXT,
        label VARCHAR(50) DEFAULT 'INBOX',
        is_unread TINYINT(1) DEFAULT 1,
        is_starred TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_label (label),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    $pdo->exec($sql);
}

/**
 * Get single email detail
 */
function getEmail($pdo, $input) {
    $emailId = $input['id'] ?? null;
    
    if (!$emailId) {
        echo json_encode(['success' => false, 'message' => 'Email ID is required']);
        return;
    }
    
    try {
        $sql = "SELECT * FROM email_log WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $emailId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Email not found']);
            return;
        }
        
        $email = [
            'id' => $row['id'],
            'threadId' => $row['id'],
            'from' => $row['from_email'],
            'to' => $row['to_email'],
            'subject' => $row['subject'],
            'date' => $row['created_at'],
            'body' => $row['body'],
            'snippet' => substr(strip_tags($row['body']), 0, 150),
            'isUnread' => (bool)$row['is_unread'],
            'isStarred' => (bool)$row['is_starred'],
            'labels' => [$row['label']]
        ];
        
        echo json_encode(['success' => true, 'data' => $email]);
        
    } catch (Exception $e) {
        error_log('Get email error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to fetch email: ' . $e->getMessage()]);
    }
}

/**
 * Send email via SMTP (same as send-otp.php)
 */
function sendEmail($config, $input) {
    $to = $input['to'] ?? '';
    $subject = $input['subject'] ?? '';
    $body = $input['body'] ?? '';
    
    if (empty($to) || empty($subject)) {
        echo json_encode(['success' => false, 'message' => 'To and Subject are required']);
        return;
    }
    
    $mail = new PHPMailer(true);
    
    try {
        // Same SMTP config as send-otp.php
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_username'];
        $mail->Password = $config['smtp_password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $config['smtp_port'];
        
        // Timeout settings
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = true;
        
        // SSL options (same as send-otp.php)
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );
        
        $mail->setFrom($config['from_email'], $config['from_name']);
        $mail->addAddress($to);
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->AltBody = strip_tags($body);
        
        $mail->send();
        
        // Log sent email to database
        global $pdo;
        if ($pdo) {
            try {
                $sql = "INSERT INTO email_log (from_email, to_email, subject, body, label, is_unread)
                        VALUES (:from, :to, :subject, :body, 'SENT', 0)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':from' => $config['from_email'],
                    ':to' => $to,
                    ':subject' => $subject,
                    ':body' => $body
                ]);
            } catch (Exception $e) {
                error_log('Failed to log sent email: ' . $e->getMessage());
            }
        }
        
        echo json_encode(['success' => true, 'message' => 'Email sent successfully']);
        
    } catch (PHPMailerException $e) {
        error_log('PHPMailer error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to send email: ' . $mail->ErrorInfo]);
    }
}

/**
 * Delete email from database
 */
function deleteEmail($pdo, $input) {
    $emailId = $input['id'] ?? null;
    
    if (!$emailId) {
        echo json_encode(['success' => false, 'message' => 'Email ID is required']);
        return;
    }
    
    try {
        // Update label to TRASH instead of deleting
        $sql = "UPDATE email_log SET label = 'TRASH' WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $emailId]);
        
        echo json_encode(['success' => true, 'message' => 'Email moved to trash']);
    } catch (Exception $e) {
        error_log('Delete email error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to delete email: ' . $e->getMessage()]);
    }
}

/**
 * Mark email as read
 */
function markAsRead($pdo, $input) {
    $emailId = $input['id'] ?? null;
    
    if (!$emailId) {
        echo json_encode(['success' => false, 'message' => 'Email ID is required']);
        return;
    }
    
    try {
        $sql = "UPDATE email_log SET is_unread = 0 WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $emailId]);
        
        echo json_encode(['success' => true, 'message' => 'Email marked as read']);
    } catch (Exception $e) {
        error_log('Mark as read error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to mark as read: ' . $e->getMessage()]);
    }
}

/**
 * Search emails
 */
function searchEmails($pdo, $input) {
    $query = $input['query'] ?? '';
    $limit = $input['limit'] ?? 50;
    
    if (empty($query)) {
        echo json_encode(['success' => false, 'message' => 'Search query is required']);
        return;
    }
    
    try {
        $sql = "SELECT * FROM email_log 
                WHERE (subject LIKE :query OR body LIKE :query OR from_email LIKE :query OR to_email LIKE :query)
                AND label != 'TRASH'
                ORDER BY created_at DESC 
                LIMIT :limit";
        
        $stmt = $pdo->prepare($sql);
        $searchTerm = "%$query%";
        $stmt->bindValue(':query', $searchTerm);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $emails = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $emails[] = [
                'id' => $row['id'],
                'threadId' => $row['id'],
                'from' => $row['from_email'],
                'subject' => $row['subject'],
                'date' => $row['created_at'],
                'snippet' => substr(strip_tags($row['body']), 0, 150),
                'isUnread' => (bool)$row['is_unread'],
                'isStarred' => (bool)$row['is_starred'],
                'labels' => [$row['label']]
            ];
        }
        
        echo json_encode([
            'success' => true,
            'data' => $emails,
            'resultSizeEstimate' => count($emails)
        ]);
        
    } catch (Exception $e) {
        error_log('Search emails error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to search emails: ' . $e->getMessage()]);
    }
}
?>

