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
    
    // Get Customers Report with filters and pagination
    if ($action == 'getCustomers') {
        $page = isset($input['page']) ? max(1, intval($input['page'])) : 1;
        $per_page = isset($input['per_page']) ? max(1, min(100, intval($input['per_page']))) : 10;
        $offset = ($page - 1) * $per_page;
        
        $filterName = isset($input['filter_name']) ? trim($input['filter_name']) : '';
        $filterPhone = isset($input['filter_phone']) ? trim($input['filter_phone']) : '';
        $filterEmail = isset($input['filter_email']) ? trim($input['filter_email']) : '';
        $filterStatus = isset($input['filter_status']) ? trim($input['filter_status']) : '';
        $filterSupplier = isset($input['filter_supplier']) ? intval($input['filter_supplier']) : null;
        
        $whereConditions = [];
        $params = [];
        
        if (!empty($filterName)) {
            $whereConditions[] = "c.customer_name LIKE :filterName";
            $params[':filterName'] = '%' . $filterName . '%';
        }
        
        if (!empty($filterPhone)) {
            $whereConditions[] = "c.customer_phone LIKE :filterPhone";
            $params[':filterPhone'] = '%' . $filterPhone . '%';
        }
        
        if (!empty($filterEmail)) {
            $whereConditions[] = "c.customer_email LIKE :filterEmail";
            $params[':filterEmail'] = '%' . $filterEmail . '%';
        }
        
        if (!empty($filterStatus)) {
            $whereConditions[] = "c.status = :filterStatus";
            $params[':filterStatus'] = $filterStatus;
        }
        
        if (!empty($filterSupplier)) {
            $whereConditions[] = "c.affliate_supp_id = :filterSupplier";
            $params[':filterSupplier'] = $filterSupplier;
        }
        
        $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM customer c $whereClause";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }
        $countStmt->execute();
        $totalResult = $countStmt->fetch(PDO::FETCH_ASSOC);
        $total = intval($totalResult['total']);
        
        // Get paginated results
        // Order by customer_id DESC (most recent first) as customer_id auto-increments
        // Join with supplier table to get supplier name
        $sql = "SELECT c.customer_id, c.customer_name, c.customer_phone, c.customer_whatsapp, 
                       c.customer_address, c.customer_email, c.cust_password, 
                       CASE WHEN c.status = 1 THEN 'Active' ELSE 'Inactive' END AS status,
                       c.affliate_supp_id,
                       s.supp_name AS affiliate_supplier_name
                FROM customer c
                LEFT JOIN supplier s ON c.affliate_supp_id = s.supp_id
                $whereClause
                ORDER BY c.customer_id DESC
                LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $customers,
            'pagination' => [
                'page' => $page,
                'per_page' => $per_page,
                'total' => $total,
                'total_pages' => ceil($total / $per_page)
            ]
        ]);
    }
    
    // Add Customer
    if ($action == 'addCustomer') {
        $customer_name = isset($input['customer_name']) ? trim($input['customer_name']) : '';
        $customer_phone = isset($input['customer_phone']) ? trim($input['customer_phone']) : '';
        $customer_whatsapp = isset($input['customer_whatsapp']) ? trim($input['customer_whatsapp']) : '';
        $customer_address = isset($input['customer_address']) ? trim($input['customer_address']) : '';
        $customer_email = isset($input['customer_email']) ? trim($input['customer_email']) : '';
        $customer_password = isset($input['customer_password']) ? trim($input['customer_password']) : '';
        $customer_status = isset($input['customer_status']) ? intval($input['customer_status']) : 1;
        
        // Handle supplier_id - check for -1, null, or empty string
        $supplier_id = null;
        if (isset($input['supplier_id'])) {
            $supplier_id_val = $input['supplier_id'];
            if ($supplier_id_val != -1 && $supplier_id_val != null && $supplier_id_val !== '' && $supplier_id_val !== 'null') {
                $supplier_id = intval($supplier_id_val);
            }
        }
        
        if (empty($customer_name)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer name is required'
            ]);
        }
        
        $defaultPass = 'abc';
        $password = !empty($customer_password) ? $customer_password : $defaultPass;
        
        // Handle empty strings for optional fields
        $customer_phone = empty($customer_phone) ? null : $customer_phone;
        $customer_whatsapp = empty($customer_whatsapp) ? null : $customer_whatsapp;
        $customer_address = empty($customer_address) ? null : $customer_address;
        $customer_email = empty($customer_email) ? null : $customer_email;
        
        try {
            $sql = "INSERT INTO customer (customer_name, customer_phone, customer_whatsapp, 
                    customer_address, customer_email, cust_password, status, affliate_supp_id) 
                    VALUES (:customer_name, :customer_phone, :customer_whatsapp, :customer_address, 
                    :customer_email, :cust_password, :status, :affliate_supp_id)";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':customer_name', $customer_name);
            $stmt->bindParam(':customer_phone', $customer_phone);
            $stmt->bindParam(':customer_whatsapp', $customer_whatsapp);
            $stmt->bindParam(':customer_address', $customer_address);
            $stmt->bindParam(':customer_email', $customer_email);
            $stmt->bindParam(':cust_password', $password);
            $stmt->bindParam(':status', $customer_status);
            $stmt->bindParam(':affliate_supp_id', $supplier_id);
            $stmt->execute();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Customer added successfully'
            ]);
        } catch (PDOException $e) {
            error_log('Customer Add Error: ' . $e->getMessage());
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Error adding customer: ' . $e->getMessage()
            ]);
        }
    }
    
    // Update Customer
    if ($action == 'updateCustomer') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        $customer_name = isset($input['customer_name']) ? trim($input['customer_name']) : '';
        $customer_phone = isset($input['customer_phone']) ? trim($input['customer_phone']) : '';
        $customer_whatsapp = isset($input['customer_whatsapp']) ? trim($input['customer_whatsapp']) : '';
        $customer_address = isset($input['customer_address']) ? trim($input['customer_address']) : '';
        $customer_email = isset($input['customer_email']) ? trim($input['customer_email']) : '';
        $customer_password = isset($input['customer_password']) ? trim($input['customer_password']) : '';
        $customer_status = isset($input['customer_status']) ? intval($input['customer_status']) : 1;
        $supplier_id = isset($input['supplier_id']) && $input['supplier_id'] != -1 ? intval($input['supplier_id']) : null;
        
        if (!$customer_id || empty($customer_name)) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID and name are required'
            ]);
        }
        
        if (!empty($customer_password)) {
            $sql = "UPDATE customer SET customer_name = :customer_name, customer_phone = :customer_phone,
                    customer_whatsapp = :customer_whatsapp, customer_address = :customer_address,
                    customer_email = :customer_email, cust_password = :cust_password, status = :status,
                    affliate_supp_id = :affliate_supp_id WHERE customer_id = :customer_id";
        } else {
            $sql = "UPDATE customer SET customer_name = :customer_name, customer_phone = :customer_phone,
                    customer_whatsapp = :customer_whatsapp, customer_address = :customer_address,
                    customer_email = :customer_email, status = :status, affliate_supp_id = :affliate_supp_id
                    WHERE customer_id = :customer_id";
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_name', $customer_name);
        $stmt->bindParam(':customer_phone', $customer_phone);
        $stmt->bindParam(':customer_whatsapp', $customer_whatsapp);
        $stmt->bindParam(':customer_address', $customer_address);
        $stmt->bindParam(':customer_email', $customer_email);
        if (!empty($customer_password)) {
            $stmt->bindParam(':cust_password', $customer_password);
        }
        $stmt->bindParam(':status', $customer_status);
        $stmt->bindParam(':affliate_supp_id', $supplier_id);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Customer updated successfully'
        ]);
    }
    
    // Delete Customer
    if ($action == 'deleteCustomer') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        
        if (!$customer_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID is required'
            ]);
        }
        
        $sql = "DELETE FROM customer WHERE customer_id = :customer_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Customer deleted successfully'
        ]);
    }
    
    // Get Customer by ID
    if ($action == 'getCustomer') {
        $customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;
        
        if (!$customer_id) {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM customer WHERE customer_id = :customer_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->execute();
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($customer) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $customer
            ]);
        } else {
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Customer not found'
            ]);
        }
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

