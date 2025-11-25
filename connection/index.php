<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


    try{
        // Use XAMPP socket path for MySQL connection
        $host = '127.0.0.1';
        $dbname = 'sntravels_prod';
        $username = 'root';
        $password = '';
        $socket = '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';
        
        // Try with socket first, fallback to regular connection
        if (file_exists($socket)) {
            $conn = new PDO("mysql:unix_socket=$socket;dbname=$dbname", $username, $password, [
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]);
        } else {
            $conn = new PDO("mysql:host=$host;port=3306;dbname=$dbname", $username, $password, [
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ]);
        }
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }catch(PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Database connection failed: ' . $e->getMessage()
            ]);
        }
        die();
    }    
?>
