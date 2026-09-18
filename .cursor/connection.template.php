<?php
/**
 * Database connection bootstrap.
 *
 * Defines $pdo (used across the API) and $conn (legacy alias) as a shared PDO
 * connection. Credentials are read from environment variables so the same code
 * works in local, Cloud Agent, and production environments, falling back to the
 * historical local defaults when nothing is set.
 */

require_once __DIR__ . '/cors-headers.php';

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'sntravels_prod';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS');
if ($dbPass === false) {
    $dbPass = '';
}

try {
    $pdo = new PDO(
        "mysql:host=$dbHost;port=$dbPort;dbname=$dbName",
        $dbUser,
        $dbPass,
        [
            PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    // Legacy alias used by a handful of older endpoints.
    $conn = $pdo;
} catch (PDOException $e) {
    error_log('Database connection failed: ' . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed: ' . $e->getMessage(),
        ]);
    }
    die();
}
