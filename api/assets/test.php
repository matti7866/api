<?php
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
    // Simple count
    $count = $pdo->query("SELECT COUNT(*) as total FROM assets")->fetch()['total'];
    
    // Get assets without joins
    $assetsSimple = $pdo->query("SELECT * FROM assets LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    
    // Check asset_types table
    $typesExist = false;
    try {
        $typesCount = $pdo->query("SELECT COUNT(*) as total FROM asset_types")->fetch()['total'];
        $typesExist = true;
    } catch (Exception $e) {
        $typesCount = 0;
        $typesError = $e->getMessage();
    }
    
    echo json_encode([
        'success' => true,
        'assets_count' => $count,
        'assets_sample' => $assetsSimple,
        'asset_types_exist' => $typesExist,
        'asset_types_count' => $typesCount ?? 0,
        'asset_types_error' => $typesError ?? null
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}

