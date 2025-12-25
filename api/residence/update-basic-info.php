<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Update Basic Residence Information
 * Endpoint: /api/residence/update-basic-info.php
 * Updates sale price, tawjeeh settings, insurance settings, remarks, and salary
 */

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

// Verify JWT token
$userData = JWTHelper::verifyRequest();

if (!$userData) {
    JWTHelper::sendResponse(401, false, 'Unauthorized');
}

// Check permission
try {
    // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
    $sql = "SELECT permission.update FROM `permission` WHERE role_id = :role_id AND page_name = 'Residence'";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $userData['role_id']);
    $stmt->execute();
    $permission = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$permission || $permission['update'] == 0) {
        JWTHelper::sendResponse(403, false, 'Permission denied');
    }
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Permission check failed: ' . $e->getMessage());
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['residenceID'])) {
    JWTHelper::sendResponse(400, false, 'Missing required field: residenceID');
}

$residenceID = (int)$data['residenceID'];

// Extract optional fields
$salePrice = isset($data['sale_price']) ? (float)$data['sale_price'] : null;
$tawjeehIncluded = isset($data['tawjeehIncluded']) ? (int)$data['tawjeehIncluded'] : null;
$tawjeehAmount = isset($data['tawjeeh_amount']) ? (float)$data['tawjeeh_amount'] : null;
$insuranceIncluded = isset($data['insuranceIncluded']) ? (int)$data['insuranceIncluded'] : null;
$insuranceAmount = isset($data['insuranceAmount']) ? (float)$data['insuranceAmount'] : null;
$remarks = isset($data['remarks']) ? trim($data['remarks']) : null;
$salaryAmount = isset($data['salary_amount']) ? (float)$data['salary_amount'] : null;

try {
    // Verify residence exists
    $sql = "SELECT residenceID FROM residence WHERE residenceID = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    
    if ($stmt->rowCount() === 0) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    // Begin transaction
    $pdo->beginTransaction();
    
    // Update residence table
    $residenceUpdates = [];
    $residenceParams = [':residenceID' => $residenceID];
    
    if ($salePrice !== null) {
        $residenceUpdates[] = "sale_price = :salePrice";
        $residenceParams[':salePrice'] = $salePrice;
    }
    
    if ($remarks !== null) {
        $residenceUpdates[] = "remarks = :remarks";
        $residenceParams[':remarks'] = $remarks;
    }
    
    if ($salaryAmount !== null) {
        $residenceUpdates[] = "salary_amount = :salaryAmount";
        $residenceParams[':salaryAmount'] = $salaryAmount;
    }
    
    // Execute residence table update if there are any updates
    if (!empty($residenceUpdates)) {
        $sql = "UPDATE residence SET " . implode(', ', $residenceUpdates) . " WHERE residenceID = :residenceID";
        $stmt = $pdo->prepare($sql);
        foreach ($residenceParams as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
    }
    
    // Update residence_charges table for insurance and tawjeeh settings
    // Check if residence_charges record exists
    $sql = "SELECT residence_id FROM residence_charges WHERE residence_id = :residenceID";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID);
    $stmt->execute();
    $chargesExists = $stmt->rowCount() > 0;
    
    $chargesUpdates = [];
    $chargesParams = [':residenceID' => $residenceID];
    
    if ($tawjeehIncluded !== null) {
        $chargesUpdates[] = "tawjeeh_included_in_sale = :tawjeehIncluded";
        $chargesParams[':tawjeehIncluded'] = $tawjeehIncluded;
    }
    
    if ($tawjeehAmount !== null) {
        $chargesUpdates[] = "tawjeeh_amount = :tawjeehAmount";
        $chargesParams[':tawjeehAmount'] = $tawjeehAmount;
    }
    
    if ($insuranceIncluded !== null) {
        $chargesUpdates[] = "insurance_included_in_sale = :insuranceIncluded";
        $chargesParams[':insuranceIncluded'] = $insuranceIncluded;
    }
    
    if ($insuranceAmount !== null) {
        $chargesUpdates[] = "insurance_amount = :insuranceAmount";
        $chargesParams[':insuranceAmount'] = $insuranceAmount;
    }
    
    // Execute residence_charges update/insert if there are any updates
    if (!empty($chargesUpdates)) {
        if ($chargesExists) {
            // Update existing record
            $sql = "UPDATE residence_charges SET " . implode(', ', $chargesUpdates) . " WHERE residence_id = :residenceID";
        } else {
            // Insert new record with default values
            $fields = ['residence_id'];
            $values = [':residenceID'];
            
            foreach ($chargesUpdates as $update) {
                list($field, $placeholder) = explode(' = ', $update);
                $fields[] = $field;
                $values[] = $placeholder;
            }
            
            $sql = "INSERT INTO residence_charges (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $values) . ")";
        }
        
        $stmt = $pdo->prepare($sql);
        foreach ($chargesParams as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
    }
    
    // Commit transaction
    $pdo->commit();
    
    JWTHelper::sendResponse(200, true, 'Residence information updated successfully', [
        'residenceID' => $residenceID,
        'updated' => array_merge(
            $salePrice !== null ? ['sale_price' => $salePrice] : [],
            $tawjeehIncluded !== null ? ['tawjeehIncluded' => $tawjeehIncluded] : [],
            $tawjeehAmount !== null ? ['tawjeeh_amount' => $tawjeehAmount] : [],
            $insuranceIncluded !== null ? ['insuranceIncluded' => $insuranceIncluded] : [],
            $insuranceAmount !== null ? ['insuranceAmount' => $insuranceAmount] : [],
            $remarks !== null ? ['remarks' => $remarks] : [],
            $salaryAmount !== null ? ['salary_amount' => $salaryAmount] : []
        )
    ]);
    
} catch (Exception $e) {
    // Rollback transaction on error
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    JWTHelper::sendResponse(500, false, 'Error updating residence information: ' . $e->getMessage());
}


