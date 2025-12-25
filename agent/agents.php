<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
require_once '../../api/auth/JWTHelper.php';
require_once '../../connection.php';

try {
    $user = JWTHelper::verifyRequest();
    
    if (!$user) {
        http_response_code(401);
        JWTHelper::sendResponse([
            'success' => false,
            'message' => 'Unauthorized'
        ]);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = isset($input['action']) ? trim($input['action']) : '';
    
    // Get user_id from JWT token
    $user_id = null;
    if (isset($user['staff_id'])) {
        $user_id = intval($user['staff_id']);
    } elseif (isset($user['user_id'])) {
        $user_id = intval($user['user_id']);
    } elseif (isset($user['id'])) {
        $user_id = intval($user['id']);
    }
    
    // Search Agents
    if ($action == 'searchAgents') {
        $search = isset($input['search']) ? trim($input['search']) : '';
        $status = isset($input['status']) ? trim($input['status']) : '';
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $per_page = isset($input['per_page']) ? max(1, min(100, intval($input['per_page']))) : 20;
        $offset = ($page - 1) * $per_page;
        
        $whereConditions = [];
        $params = [];
        
        $whereConditions[] = "a.deleted = 0";
        
        if (!empty($search)) {
            $whereConditions[] = "(a.company LIKE :search OR a.email LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }
        
        if ($status !== '' && $status !== null) {
            $whereConditions[] = "a.status = :status";
            $params[':status'] = intval($status);
        }
        
        $whereClause = "WHERE " . implode(" AND ", $whereConditions);
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total 
                     FROM agents a 
                     LEFT JOIN customer c ON c.customer_id = a.customer_id 
                     $whereClause";
        
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
        $total = intval($totalResult['total']);
        
        // Get paginated results
        $sql = "SELECT a.id, a.company, a.customer_id, a.email, a.status, c.customer_name
                FROM agents a
                LEFT JOIN customer c ON c.customer_id = a.customer_id
                $whereClause
                ORDER BY a.id DESC
                LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $agents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $agents,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ]);
    }
    
    // Add Agent
    if ($action == 'addAgent') {
        $company = isset($input['company']) ? trim($input['company']) : '';
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $email = isset($input['email']) ? trim($input['email']) : '';
        
        $errors = [];
        if (empty($company)) {
            $errors['company'] = 'Company name is required';
        }
        if (empty($customer_id)) {
            $errors['customer_id'] = 'Customer is required';
        }
        if (empty($email)) {
            $errors['email'] = 'Email is required';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Invalid email format';
        }
        
        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation errors',
                'errors' => $errors
            ]);
        }
        
        // Check if email already exists
        $checkStmt = $pdo->prepare("SELECT * FROM agents WHERE LCASE(email) = :email AND deleted = 0");
        $checkStmt->execute([':email' => strtolower($email)]);
        $existingAgent = $checkStmt->fetch();
        
        if ($existingAgent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Email already exists',
                'errors' => ['email' => 'Email already exists']
            ]);
        }
        
        // Check if customer already linked with agent
        $checkStmt = $pdo->prepare("SELECT * FROM agents WHERE customer_id = :customer_id AND deleted = 0");
        $checkStmt->execute([':customer_id' => $customer_id]);
        $existingAgent = $checkStmt->fetch();
        
        if ($existingAgent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer already linked with agent',
                'errors' => ['customer_id' => 'Customer already linked with agent']
            ]);
        }
        
        // Generate random password
        $password = bin2hex(random_bytes(4));
        $passwordEncrypted = md5(md5($password . "sntravels123"));
        $status = 1;
        
        $sql = "INSERT INTO agents (company, customer_id, email, password, status, added_by) 
                VALUES (:company, :customer_id, :email, :password, :status, :added_by)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':company', $company);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':password', $passwordEncrypted);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':added_by', $user_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Agent added successfully'
        ]);
    }
    
    // Get Agent
    if ($action == 'getAgent') {
        $id = isset($input['id']) ? intval($input['id']) : null;
        
        if (!$id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Agent ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM agents WHERE id = :id AND deleted = 0";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $agent = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$agent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Agent not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $agent
        ]);
    }
    
    // Update Agent
    if ($action == 'updateAgent') {
        $id = isset($input['id']) ? intval($input['id']) : null;
        $company = isset($input['company']) ? trim($input['company']) : '';
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $email = isset($input['email']) ? trim($input['email']) : '';
        
        $errors = [];
        if (empty($company)) {
            $errors['company'] = 'Company name is required';
        }
        if (empty($customer_id)) {
            $errors['customer_id'] = 'Customer is required';
        }
        if (empty($email)) {
            $errors['email'] = 'Email is required';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Invalid email format';
        }
        
        if (!empty($errors)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation errors',
                'errors' => $errors
            ]);
        }
        
        // Check if email already exists (excluding current agent)
        $checkStmt = $pdo->prepare("SELECT * FROM agents WHERE LCASE(email) = :email AND id != :id AND deleted = 0");
        $checkStmt->execute([':email' => strtolower($email), ':id' => $id]);
        $existingAgent = $checkStmt->fetch();
        
        if ($existingAgent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Email already exists',
                'errors' => ['email' => 'Email already exists']
            ]);
        }
        
        // Check if customer already linked with agent (excluding current agent)
        $checkStmt = $pdo->prepare("SELECT * FROM agents WHERE customer_id = :customer_id AND id != :id AND deleted = 0");
        $checkStmt->execute([':customer_id' => $customer_id, ':id' => $id]);
        $existingAgent = $checkStmt->fetch();
        
        if ($existingAgent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer already linked with agent',
                'errors' => ['customer_id' => 'Customer already linked with agent']
            ]);
        }
        
        $sql = "UPDATE agents SET company = :company, customer_id = :customer_id, email = :email WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':company', $company);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        if ($stmt->rowCount() == 0) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'No changes made or agent not found'
            ]);
        }
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Agent updated successfully'
        ]);
    }
    
    // Delete Agent
    if ($action == 'deleteAgent') {
        $id = isset($input['id']) ? intval($input['id']) : null;
        
        if (!$id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Agent ID is required'
            ]);
        }
        
        // Load the agent first
        $stmt = $pdo->prepare("SELECT * FROM agents WHERE id = :id AND deleted = 0");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $agent = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$agent) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Agent not found'
            ]);
        }
        
        // Soft delete
        $stmt = $pdo->prepare("UPDATE agents SET deleted = 1 WHERE id = :id");
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        // Create delete request
        $datetime = date('Y-m-d H:i:s');
        $meta = json_encode($agent);
        $type = 'agent';
        $status = 'pending';
        
        $stmt = $pdo->prepare("INSERT INTO delete_requests 
                               (datetime, added_by, type, unique_id, metadata, status) 
                               VALUES (:datetime, :added_by, :type, :unique_id, :metadata, :status)");
        $stmt->bindParam(':datetime', $datetime);
        $stmt->bindParam(':added_by', $user_id);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':unique_id', $id);
        $stmt->bindParam(':metadata', $meta);
        $stmt->bindParam(':status', $status);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Agent deleted successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

