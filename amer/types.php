<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../connection/index.php';
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
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Unauthorized'
    ]);
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Handle JSON body for POST requests
    if ($method === 'POST' && empty($_POST)) {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        if ($data) {
            $_POST = array_merge($_POST, $data);
        }
    }
    
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    // Get database connection
    // Database connection already available as $pdo from connection.php
    
    function filterInput($name) {
        return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : (isset($_GET[$name]) ? $_GET[$name] : ''))));
    }
    
    // Get all types
    if ($action == 'getTypes' || ($method == 'GET' && empty($action))) {
        $sql = "SELECT * FROM `amer_types` ORDER BY `id` DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $types = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $types
        ]);
    }
    
    // Get single type
    if ($action == 'getType') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM `amer_types` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $type = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($type) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $type
            ]);
        } else {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type not found'
            ]);
        }
    }
    
    // Add type
    if ($action == 'addType') {
        $name = filterInput('name');
        $cost_price = filterInput('cost_price');
        $sale_price = filterInput('sale_price');
        
        $errors = [];
        
        if (empty($name)) $errors['name'] = 'Name is required';
        if (empty($cost_price)) $errors['cost_price'] = 'Cost Price is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale Price is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        // Check if type already exists
        $sql = "SELECT COUNT(*) FROM `amer_types` WHERE LCASE(`name`) = LCASE(:name)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->execute();
        if ($stmt->fetchColumn() > 0) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type already exists',
                'errors' => ['name' => 'Type already exists']
            ]);
        }
        
        $sql = "INSERT INTO `amer_types` (`name`, `cost_price`, `sale_price`) VALUES (:name, :cost_price, :sale_price)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':cost_price', $cost_price);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Type added successfully'
        ]);
    }
    
    // Update type
    if ($action == 'updateType') {
        $id = filterInput('id');
        $name = filterInput('name');
        $cost_price = filterInput('cost_price');
        $sale_price = filterInput('sale_price');
        
        $errors = [];
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type ID is required'
            ]);
        }
        
        if (empty($name)) $errors['name'] = 'Name is required';
        if (empty($cost_price)) $errors['cost_price'] = 'Cost Price is required';
        if (empty($sale_price)) $errors['sale_price'] = 'Sale Price is required';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        // Check if type already exists
        $sql = "SELECT COUNT(*) FROM `amer_types` WHERE LCASE(`name`) = LCASE(:name) AND `id` != :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        if ($stmt->fetchColumn() > 0) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type already exists',
                'errors' => ['name' => 'Type already exists']
            ]);
        }
        
        $sql = "UPDATE `amer_types` SET `name` = :name, `cost_price` = :cost_price, `sale_price` = :sale_price WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $name);
        $stmt->bindParam(':cost_price', $cost_price);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Type updated successfully'
        ]);
    }
    
    // Delete type
    if ($action == 'deleteType') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type ID is required'
            ]);
        }
        
        // Check if type is being used
        $sql = "SELECT COUNT(*) FROM `amer` WHERE `type_id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        if ($stmt->fetchColumn() > 0) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Type cannot be deleted as it is being used in transactions'
            ]);
        }
        
        $sql = "DELETE FROM `amer_types` WHERE `id` = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Type deleted successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Types API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

