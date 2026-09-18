<?php
/**
 * Idempotent database bootstrap for local / Cloud Agent development.
 *
 * Creates the database and the minimal set of tables required for the
 * authentication flow (staff + roles) and seeds a demo administrator so the
 * React frontend can log in end to end. Safe to run on every boot.
 *
 * Demo credentials (dev only):
 *   username: admin@sntrips.com   password: admin123
 */

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'sntravels_prod';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS');
if ($dbPass === false) {
    $dbPass = '';
}

$root = new PDO("mysql:host=$dbHost;port=$dbPort", $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);
$root->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

$pdo = new PDO("mysql:host=$dbHost;port=$dbPort;dbname=$dbName", $dbUser, $dbPass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8mb4',
]);

$pdo->exec("
    CREATE TABLE IF NOT EXISTS roles (
        role_id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS staff (
        staff_id INT AUTO_INCREMENT PRIMARY KEY,
        staff_name VARCHAR(150) NOT NULL,
        staff_email VARCHAR(190) DEFAULT NULL,
        staff_pic VARCHAR(255) DEFAULT NULL,
        staff_password VARCHAR(255) NOT NULL,
        role_id INT DEFAULT NULL,
        status TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// Seed an administrator role.
$pdo->exec("INSERT INTO roles (role_id, role_name)
            VALUES (1, 'Administrator')
            ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)");

// Seed the demo admin user (dev only). Password stored as a bcrypt hash.
$hash = password_hash('admin123', PASSWORD_BCRYPT);
$stmt = $pdo->prepare("SELECT staff_id FROM staff WHERE staff_email = ? LIMIT 1");
$stmt->execute(['admin@sntrips.com']);
if ($stmt->fetchColumn() === false) {
    $insert = $pdo->prepare("
        INSERT INTO staff (staff_name, staff_email, staff_password, role_id, status)
        VALUES ('Administrator', 'admin@sntrips.com', ?, 1, 1)
    ");
    $insert->execute([$hash]);
    echo "Seeded demo admin (admin@sntrips.com / admin123)\n";
} else {
    echo "Demo admin already present\n";
}

echo "Database bootstrap complete: $dbName\n";
