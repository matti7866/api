<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

try {
    require_once __DIR__ . '/../../connection.php';
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
    // Database connection already available as $pdo from connection.php
    
    function filterInput($name) {
        return htmlspecialchars(stripslashes(trim(isset($_POST[$name]) ? $_POST[$name] : (isset($_GET[$name]) ? $_GET[$name] : ''))));
    }
    
    // Search services
    if ($action == 'searchServices') {
        $customer_id = filterInput('customer_id');
        $service_id = filterInput('service_id');
        $passenger_name = filterInput('passenger_name');
        $start_date = filterInput('start_date');
        $end_date = filterInput('end_date');
        
        // Build WHERE clause based on search criteria
        $where = [];
        $params = [];
        
        if (!empty($customer_id) && $customer_id != '-1') {
            $where[] = "servicedetails.customer_id = :customer_id";
            $params[':customer_id'] = $customer_id;
        }
        
        if (!empty($service_id) && $service_id != '-1') {
            $where[] = "servicedetails.serviceID = :service_id";
            $params[':service_id'] = $service_id;
        }
        
        if (!empty($passenger_name)) {
            $where[] = "LOWER(servicedetails.passenger_name) LIKE :passenger_name";
            $params[':passenger_name'] = '%' . strtolower($passenger_name) . '%';
        }
        
        if (!empty($start_date) && !empty($end_date)) {
            $where[] = "DATE(servicedetails.service_date) BETWEEN :start_date AND :end_date";
            $params[':start_date'] = $start_date;
            $params[':end_date'] = $end_date;
        } elseif (!empty($start_date)) {
            $where[] = "DATE(servicedetails.service_date) >= :start_date";
            $params[':start_date'] = $start_date;
        } elseif (!empty($end_date)) {
            $where[] = "DATE(servicedetails.service_date) <= :end_date";
            $params[':end_date'] = $end_date;
        }
        
        // Build WHERE clause - if no filters, show all records
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        $sql = "
        SELECT 
            servicedetails.serviceDetailsID,
            service.serviceName,
            customer.customer_name,
            servicedetails.passenger_name,
            DATE(servicedetails.service_date) AS service_date,
            servicedetails.service_details,
            servicedetails.salePrice,
            currency.currencyName,
            CASE WHEN servicedetails.Supplier_id THEN 'bySupplier' ELSE 'byAccount' END AS chargeFlag,
            CASE WHEN servicedetails.Supplier_id 
                THEN (SELECT supp_name FROM supplier WHERE supplier.supp_id = servicedetails.Supplier_id)
                ELSE (SELECT account_Name FROM accounts WHERE accounts.account_ID = servicedetails.accoundID)
            END AS ChargedEntity,
            staff.staff_name,
            servicedetails.serviceID,
            servicedetails.customer_id,
            servicedetails.Supplier_id,
            servicedetails.accoundID,
            servicedetails.netPrice,
            servicedetails.netCurrencyID,
            servicedetails.saleCurrencyID
        FROM servicedetails
        INNER JOIN service ON service.serviceID = servicedetails.serviceID
        INNER JOIN customer ON customer.customer_id = servicedetails.customer_id
        INNER JOIN currency ON currency.currencyID = servicedetails.saleCurrencyID
        INNER JOIN staff ON staff.staff_id = servicedetails.uploadedBy
        $whereClause
        ORDER BY servicedetails.serviceDetailsID DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $services = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        JWTHelper::sendResponse([
            'success' => true,
            'data' => $services
        ]);
    }
    
    // Get single service
    if ($action == 'getService') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service ID is required'
            ]);
        }
        
        $sql = "SELECT * FROM servicedetails WHERE serviceDetailsID = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $service = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($service) {
            JWTHelper::sendResponse([
                'success' => true,
                'data' => $service
            ]);
        } else {
            http_response_code(404);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service not found'
            ]);
        }
    }
    
    // Add service (simplified - no net cost, supplier, account, or customer payment)
    if ($action == 'addService') {
        $service_id = filterInput('service_id');
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $service_details = filterInput('service_details');
        $sale_price = filterInput('sale_price');
        $sale_currency_id = filterInput('sale_currency_id');
        
        $errors = [];
        
        if (empty($service_id) || $service_id == '-1') $errors['service_id'] = 'Service type is required';
        if (empty($customer_id) || $customer_id == '-1') $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger name is required';
        if (empty($service_details)) $errors['service_details'] = 'Service detail is required';
        if (empty($sale_price) || $sale_price <= 0) $errors['sale_price'] = 'Sale price is required and must be greater than 0';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        try {
            // Insert service detail (simplified - no net price, supplier, or account)
            $sql = "INSERT INTO servicedetails (
                serviceID, customer_id, passenger_name, service_details,
                salePrice, saleCurrencyID, uploadedBy, service_date,
                netPrice, netCurrencyID, Supplier_id, accoundID
            ) VALUES (
                :service_id, :customer_id, :passenger_name, :service_details,
                :sale_price, :sale_currency_id, :uploaded_by, NOW(),
                0, :sale_currency_id, NULL, NULL
            )";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':service_id', $service_id);
            $stmt->bindParam(':customer_id', $customer_id);
            $stmt->bindParam(':passenger_name', $passenger_name);
            $stmt->bindParam(':service_details', $service_details);
            $stmt->bindParam(':sale_price', $sale_price);
            $stmt->bindParam(':sale_currency_id', $sale_currency_id);
            $stmt->bindParam(':uploaded_by', $staff_id);
            $stmt->execute();
            
            $service_details_id = $pdo->lastInsertId();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Service added successfully',
                'data' => ['serviceDetailsID' => $service_details_id]
            ]);
        } catch (Exception $e) {
            throw $e;
        }
    }
    
    // Update service (simplified - only basic fields)
    if ($action == 'updateService') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service ID is required'
            ]);
        }
        
        $service_id = filterInput('service_id');
        $customer_id = filterInput('customer_id');
        $passenger_name = filterInput('passenger_name');
        $service_details = filterInput('service_details');
        $sale_price = filterInput('sale_price');
        $sale_currency_id = filterInput('sale_currency_id');
        
        $errors = [];
        
        if (empty($service_id) || $service_id == '-1') $errors['service_id'] = 'Service type is required';
        if (empty($customer_id) || $customer_id == '-1') $errors['customer_id'] = 'Customer is required';
        if (empty($passenger_name)) $errors['passenger_name'] = 'Passenger name is required';
        if (empty($service_details)) $errors['service_details'] = 'Service detail is required';
        if (empty($sale_price) || $sale_price <= 0) $errors['sale_price'] = 'Sale price is required and must be greater than 0';
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $staff_id = $user['staff_id'] ?? $user['user_id'] ?? null;
        
        $sql = "UPDATE servicedetails SET
                serviceID = :service_id,
                customer_id = :customer_id,
                passenger_name = :passenger_name,
                service_details = :service_details,
                salePrice = :sale_price,
                saleCurrencyID = :sale_currency_id,
                uploadedBy = :uploaded_by
                WHERE serviceDetailsID = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':service_id', $service_id);
        $stmt->bindParam(':customer_id', $customer_id);
        $stmt->bindParam(':passenger_name', $passenger_name);
        $stmt->bindParam(':service_details', $service_details);
        $stmt->bindParam(':sale_price', $sale_price);
        $stmt->bindParam(':sale_currency_id', $sale_currency_id);
        $stmt->bindParam(':uploaded_by', $staff_id);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Service updated successfully'
        ]);
    }
    
    // Delete service
    if ($action == 'deleteService') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service ID is required'
            ]);
        }
        
        $pdo->beginTransaction();
        
        try {
            // Get all files for this service
            $sql = "SELECT document_id, file_name FROM servicedocuments WHERE detailServiceID = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Delete files from filesystem
            foreach ($files as $file) {
                $file_path = __DIR__ . '/../../service/' . $file['file_name'];
                if (file_exists($file_path)) {
                    unlink($file_path);
                }
            }
            
            // Delete file records
            $sql = "DELETE FROM servicedocuments WHERE detailServiceID = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            // Delete service detail
            $sql = "DELETE FROM servicedetails WHERE serviceDetailsID = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            
            $pdo->commit();
            
            JWTHelper::sendResponse([
                'success' => true,
                'message' => 'Service deleted successfully'
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    
    // Update service charge (assign supplier/account and net cost)
    if ($action == 'updateServiceCharge') {
        $id = filterInput('id');
        
        if (empty($id)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service ID is required'
            ]);
        }
        
        $supplier_id = filterInput('supplier_id');
        $account_id = filterInput('account_id');
        $net_price = filterInput('net_price');
        $net_currency_id = filterInput('net_currency_id');
        
        $errors = [];
        
        // Either supplier or account must be provided, but not both
        if ((empty($supplier_id) || $supplier_id == '-1') && (empty($account_id) || $account_id == '-1')) {
            $errors['charge'] = 'Service should be charged on Supplier or Account';
        }
        if ((!empty($supplier_id) && $supplier_id != '-1') && (!empty($account_id) && $account_id != '-1')) {
            $errors['charge'] = 'Service should be charged either on Supplier or Account, not both';
        }
        
        if (empty($net_price) || $net_price <= 0) {
            $errors['net_price'] = 'Net price is required and must be greater than 0';
        }
        
        if (!empty($errors)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $errors
            ]);
        }
        
        $supplier_value = (!empty($supplier_id) && $supplier_id != '-1') ? $supplier_id : null;
        $account_value = (!empty($account_id) && $account_id != '-1') ? $account_id : null;
        
        $sql = "UPDATE servicedetails SET
                Supplier_id = :supplier_id,
                accoundID = :account_id,
                netPrice = :net_price,
                netCurrencyID = :net_currency_id
                WHERE serviceDetailsID = :id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':supplier_id', $supplier_value, PDO::PARAM_INT);
        $stmt->bindValue(':account_id', $account_value, PDO::PARAM_INT);
        $stmt->bindParam(':net_price', $net_price);
        $stmt->bindParam(':net_currency_id', $net_currency_id);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Service charge updated successfully'
        ]);
    }
    
    // Add service type
    if ($action == 'addServiceType') {
        $service_name = filterInput('service_name');
        
        if (empty($service_name)) {
            http_response_code(400);
            JWTHelper::sendResponse([
                'success' => false,
                'message' => 'Service name is required'
            ]);
        }
        
        $sql = "INSERT INTO service (serviceName) VALUES (:service_name)";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':service_name', $service_name);
        $stmt->execute();
        
        JWTHelper::sendResponse([
            'success' => true,
            'message' => 'Service type added successfully'
        ]);
    }
    
    http_response_code(400);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Invalid action'
    ]);
    
} catch (Exception $e) {
    error_log('Services API Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    http_response_code(500);
    JWTHelper::sendResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

