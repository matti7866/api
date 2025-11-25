<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';

require_once __DIR__ . '/../../api/auth/JWTHelper.php';
require_once __DIR__ . '/../../connection.php';

header('Content-Type: application/json');

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Create company_files table if it doesn't exist
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS company_files (
            file_id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INT NOT NULL,
            file_extension VARCHAR(10) NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uploaded_by INT NOT NULL,
            INDEX idx_company_id (company_id),
            INDEX idx_upload_date (upload_date)
        )");
    } catch (PDOException $e) {
        error_log("Could not create company_files table: " . $e->getMessage());
    }

    // Verify JWT token
    $user = JWTHelper::verifyRequest();
    if (!$user) {
        JWTHelper::sendResponse(401, false, 'Unauthorized');
    }

    // Check permissions
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    
    if (empty($action)) {
        JWTHelper::sendResponse(400, false, 'Action is required');
    }

    // Handle different actions
    switch ($action) {
        case 'searchCompanies':
            handleSearchCompanies($pdo, $user);
            break;
            
        case 'getSidebarCounts':
            handleGetSidebarCounts($pdo, $user);
            break;
            
        case 'getPersons':
            handleGetPersons($pdo, $user);
            break;
            
        case 'addCompany':
            handleAddCompany($pdo, $user);
            break;
            
        case 'loadCompany':
            handleLoadCompany($pdo, $user);
            break;
            
        case 'updateCompany':
            handleUpdateCompany($pdo, $user);
            break;
            
        case 'deleteCompany':
            handleDeleteCompany($pdo, $user);
            break;
            
        case 'addPerson':
            handleAddPerson($pdo, $user);
            break;
            
        case 'getCompanyFiles':
            handleGetCompanyFiles($pdo, $user);
            break;
            
        case 'uploadCompanyFile':
            handleUploadCompanyFile($pdo, $user);
            break;
            
        case 'deleteCompanyFile':
            handleDeleteCompanyFile($pdo, $user);
            break;
            
        default:
            JWTHelper::sendResponse(400, false, 'Invalid action');
    }
} catch (Exception $e) {
    error_log('Manage Establishments API Error: ' . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Server error: ' . $e->getMessage());
}

function handleSearchCompanies($pdo, $user) {
    $filterType = isset($_POST['filterType']) ? $_POST['filterType'] : 'all';
    $search = isset($_POST['search']) ? trim($_POST['search']) : '';
    $sort = isset($_POST['sort']) ? $_POST['sort'] : 'name';
    $page = isset($_POST['page']) ? max(1, (int)$_POST['page']) : 1;
    $limit = isset($_POST['limit']) ? max(1, min(100, (int)$_POST['limit'])) : 12;
    $offset = ($page - 1) * $limit;
    
    $whereConditions = [];
    $params = [];
    
    // Filter by type
    if ($filterType === 'Mainland' || $filterType === 'Freezone') {
        $whereConditions[] = "company.company_type = :type";
        $params[':type'] = $filterType;
    }
    
    // Filter for persons view - this should show persons, not companies
    if ($filterType === 'persons') {
        // For persons view, we'll return empty companies array
        // The frontend should handle this differently
        JWTHelper::sendResponse(200, true, 'Persons view - use getPersons action', [
            'companies' => [],
            'pagination' => [
                'currentPage' => 1,
                'totalPages' => 1,
                'totalRecords' => 0,
                'recordsPerPage' => $limit
            ]
        ]);
        return;
    }
    
    // Search filter
    if (!empty($search)) {
        $whereConditions[] = "(company.company_name LIKE :search OR company.company_number LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    // Missing documents filter
    if ($filterType === 'missing') {
        $whereConditions[] = "(
            company.letterhead IS NULL OR company.letterhead = '' OR
            company.stamp IS NULL OR company.stamp = '' OR
            company.signature IS NULL OR company.signature = '' OR
            company.trade_license_copy IS NULL OR company.trade_license_copy = '' OR
            company.establishment_card IS NULL OR company.establishment_card = ''
        )";
    }
    
    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
    
    // Get total count for pagination
    $countSql = "SELECT COUNT(*) as total FROM company {$whereClause}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
    $totalPages = ceil($totalRecords / $limit);
    
    // Sort order
    $orderBy = 'ORDER BY ';
    switch ($sort) {
        case 'expiry':
            $orderBy .= 'company.company_expiry ASC';
            break;
        case 'quota':
            $orderBy .= 'company.starting_quota DESC';
            break;
        case 'name':
        default:
            $orderBy .= 'company.company_name ASC';
            break;
    }
    
    // Use SELECT * to get all columns, then filter what we need
    $sql = "SELECT 
                company.company_id,
                company.company_name,
                company.company_type,
                company.company_number,
                company.starting_quota as quota,
                company.company_expiry as expiry_date,
                company.username,
                company.password,
                company.local_name,
                company.letterhead,
                company.stamp,
                company.signature,
                company.trade_license_copy as trade_license,
                company.establishment_card
            FROM company
            {$whereClause}
            {$orderBy}
            LIMIT :limit OFFSET :offset";
    
    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Add missing documents info
    foreach ($companies as &$company) {
        $missingDocs = [];
        if (empty($company['letterhead'])) $missingDocs[] = 'Letterhead';
        if (empty($company['stamp'])) $missingDocs[] = 'Stamp';
        if (empty($company['signature'])) $missingDocs[] = 'Signature';
        // Check trade_license_copy (the actual column) or trade_license (the alias)
        $tradeLicense = $company['trade_license'] ?? $company['trade_license_copy'] ?? '';
        if (empty($tradeLicense)) $missingDocs[] = 'Trade License';
        if (empty($company['establishment_card'])) $missingDocs[] = 'Establishment Card';
        $company['missing_documents'] = $missingDocs;
    }
    
    JWTHelper::sendResponse(200, true, 'Companies retrieved successfully', [
        'companies' => $companies,
        'pagination' => [
            'currentPage' => $page,
            'totalPages' => $totalPages,
            'totalRecords' => (int)$totalRecords,
            'recordsPerPage' => $limit
        ]
    ]);
}

function handleGetSidebarCounts($pdo, $user) {
    // Count all
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM company");
    $allCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Count Mainland
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM company WHERE company_type = 'Mainland'");
    $mainlandCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Count Freezone
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM company WHERE company_type = 'Freezone'");
    $freezoneCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Count missing documents
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM company WHERE 
        letterhead IS NULL OR letterhead = '' OR
        stamp IS NULL OR stamp = '' OR
        signature IS NULL OR signature = '' OR
        trade_license_copy IS NULL OR trade_license_copy = '' OR
        establishment_card IS NULL OR establishment_card = ''");
    $missingCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Count persons - try person_information first, fallback to persons
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM person_information");
        $personsCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    } catch (PDOException $e) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM persons");
            $personsCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        } catch (PDOException $e2) {
            $personsCount = 0;
        }
    }
    
    JWTHelper::sendResponse(200, true, 'Counts retrieved successfully', [
        'counts' => [
            'all' => (int)$allCount,
            'mainland' => (int)$mainlandCount,
            'freezone' => (int)$freezoneCount,
            'missing' => (int)$missingCount,
            'persons' => (int)$personsCount
        ]
    ]);
}

function handleGetPersons($pdo, $user) {
    // Try person_information table first (new structure), fallback to persons
    $sql = "SELECT 
                person_id,
                full_name as person_name,
                role as person_role,
                passport_number,
                emirates_id,
                phone,
                email,
                nationality,
                date_of_birth
            FROM person_information
            ORDER BY full_name ASC";
    
    try {
        $stmt = $pdo->query($sql);
        $persons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log('Fetched ' . count($persons) . ' persons from person_information');
        if (count($persons) > 0) {
            error_log('First person: ' . json_encode($persons[0]));
        }
    } catch (PDOException $e) {
        error_log('Failed to query person_information, trying persons table: ' . $e->getMessage());
        // Fallback to old table structure
        $sql = "SELECT 
                    person_id,
                    person_name,
                    person_role,
                    passport_number,
                    emirates_id,
                    phone,
                    email
                FROM persons
                ORDER BY person_name ASC";
        $stmt = $pdo->query($sql);
        $persons = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log('Fetched ' . count($persons) . ' persons from persons table');
        if (count($persons) > 0) {
            error_log('First person: ' . json_encode($persons[0]));
        }
    }
    
    JWTHelper::sendResponse(200, true, 'Persons retrieved successfully', [
        'persons' => $persons
    ]);
}

function handleAddCompany($pdo, $user) {
    $name = isset($_POST['nameAdd']) ? trim($_POST['nameAdd']) : '';
    $type = isset($_POST['typeAdd']) ? trim($_POST['typeAdd']) : '';
    $quota = isset($_POST['quotaAdd']) ? trim($_POST['quotaAdd']) : '';
    $expiry = isset($_POST['expiryAdd']) ? trim($_POST['expiryAdd']) : '';
    $number = isset($_POST['numberAdd']) ? trim($_POST['numberAdd']) : '';
    $username = isset($_POST['usernameAdd']) ? trim($_POST['usernameAdd']) : '';
    $password = isset($_POST['passwordAdd']) ? trim($_POST['passwordAdd']) : '';

    $errors = [];
    if (empty($name)) $errors['nameAdd'] = 'Company name is required';
    if (empty($type)) $errors['typeAdd'] = 'Company type is required';
    if (empty($quota)) $errors['quotaAdd'] = 'Starting quota is required';
    if (empty($expiry)) $errors['expiryAdd'] = 'Expiry date is required';
    if (empty($number)) $errors['numberAdd'] = 'Company number is required';

    // Documents are now optional - can be uploaded later via attachments

    // Validate authorized signatories
    $hasValidSignatory = false;
    if (isset($_POST['signatoryRoles']) && isset($_POST['signatoryPersons'])) {
        $signatoryRoles = $_POST['signatoryRoles'];
        $signatoryPersons = $_POST['signatoryPersons'];
        
        foreach ($signatoryRoles as $i => $role) {
            if (!empty($role) && !empty($signatoryPersons[$i])) {
                $hasValidSignatory = true;
                break;
            }
        }
    }
    
    if (!$hasValidSignatory) {
        $errors['authorizedSignatoriesAdd'] = 'At least one authorized signatory is required';
    }

    if (count($errors) > 0) {
        JWTHelper::sendResponse(400, false, 'form_errors', ['errors' => $errors]);
    }

    // Check if company number already exists
    $stmt = $pdo->prepare("SELECT * FROM company WHERE company_number = :number");
    $stmt->execute([':number' => $number]);
    $existingCompany = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existingCompany) {
        JWTHelper::sendResponse(400, false, 'form_errors', ['errors' => ['numberAdd' => 'Company number already exists']]);
    }

    // Handle file uploads
    $uploadDir = __DIR__ . '/../../letters/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    // Handle optional file uploads
    $letterheadFile = '';
    $stampFile = '';
    $signatureFile = '';
    $tradeLicenseFile = '';
    $establishmentCardFile = '';
    
    if (isset($_FILES['letterHeadAdd']) && $_FILES['letterHeadAdd']['error'] === UPLOAD_ERR_OK) {
        $letterheadFile = uploadEstablishmentFile($_FILES['letterHeadAdd'], $uploadDir, 'letterhead');
    }
    if (isset($_FILES['stampAdd']) && $_FILES['stampAdd']['error'] === UPLOAD_ERR_OK) {
        $stampFile = uploadEstablishmentFile($_FILES['stampAdd'], $uploadDir, 'stamp');
    }
    if (isset($_FILES['signatureAdd']) && $_FILES['signatureAdd']['error'] === UPLOAD_ERR_OK) {
        $signatureFile = uploadEstablishmentFile($_FILES['signatureAdd'], $uploadDir, 'signature');
    }
    if (isset($_FILES['tradeLicenseAdd']) && $_FILES['tradeLicenseAdd']['error'] === UPLOAD_ERR_OK) {
        $tradeLicenseFile = uploadEstablishmentFile($_FILES['tradeLicenseAdd'], $uploadDir, 'trade_license');
    }
    if (isset($_FILES['establishmentCardAdd']) && $_FILES['establishmentCardAdd']['error'] === UPLOAD_ERR_OK) {
        $establishmentCardFile = uploadEstablishmentFile($_FILES['establishmentCardAdd'], $uploadDir, 'establishment_card');
    }

    try {
        $pdo->beginTransaction();

        // Insert company
        $stmt = $pdo->prepare("
            INSERT INTO company 
            (company_name, company_type, starting_quota, company_expiry, company_number, username, password, letterhead, stamp, signature, trade_license_copy, establishment_card) 
            VALUES (:name, :type, :quota, :expiry, :number, :username, :password, :letterhead, :stamp, :signature, :trade_license_copy, :establishment_card)
        ");
        $stmt->execute([
            ':name' => $name,
            ':type' => $type,
            ':quota' => $quota,
            ':expiry' => $expiry,
            ':number' => $number,
            ':username' => $username,
            ':password' => $password,
            ':letterhead' => $letterheadFile,
            ':stamp' => $stampFile,
            ':signature' => $signatureFile,
            ':trade_license_copy' => $tradeLicenseFile,
            ':establishment_card' => $establishmentCardFile
        ]);

        $companyId = $pdo->lastInsertId();

        // Handle authorized signatories
        if (isset($_POST['signatoryRoles']) && isset($_POST['signatoryPersons'])) {
            $signatoryRoles = $_POST['signatoryRoles'];
            $signatoryPersons = $_POST['signatoryPersons'];
            
            $stmt = $pdo->prepare("
                INSERT INTO company_persons 
                (company_id, person_id, role_in_company, status) 
                VALUES (:company_id, :person_id, :role, 'Active')
            ");
            
            foreach ($signatoryRoles as $i => $role) {
                if (!empty($role) && !empty($signatoryPersons[$i])) {
                    $stmt->execute([
                        ':company_id' => $companyId,
                        ':person_id' => $signatoryPersons[$i],
                        ':role' => $role
                    ]);
                }
            }
        }

        // Handle additional files
        if (isset($_FILES['additionalFiles']) && isset($_POST['fileNames'])) {
            $fileNames = $_POST['fileNames'];
            $additionalFiles = $_FILES['additionalFiles'];

            $stmt = $pdo->prepare("
                INSERT INTO company_files 
                (company_id, file_name, display_name, file_path, file_size, file_extension, uploaded_by) 
                VALUES (:company_id, :file_name, :display_name, :file_path, :file_size, :file_extension, :uploaded_by)
            ");

            foreach ($additionalFiles['name'] as $i => $fileName) {
                if (!empty($fileName) && $additionalFiles['error'][$i] === UPLOAD_ERR_OK && !empty($fileNames[$i])) {
                    $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
                    $newFilename = 'additional_' . uniqid() . time() . '.' . $fileExt;
                    $uploadFile = $uploadDir . $newFilename;

                    if (move_uploaded_file($additionalFiles['tmp_name'][$i], $uploadFile)) {
                        $uploadedBy = $user['user_id'] ?? $user['staff_id'] ?? 0;
                        
                        $stmt->execute([
                            ':company_id' => $companyId,
                            ':file_name' => $newFilename,
                            ':display_name' => $fileNames[$i],
                            ':file_path' => 'letters/' . $newFilename,
                            ':file_size' => $additionalFiles['size'][$i],
                            ':file_extension' => $fileExt,
                            ':uploaded_by' => $uploadedBy
                        ]);
                    }
                }
            }
        }

        $pdo->commit();
        JWTHelper::sendResponse(200, true, 'Establishment added successfully');
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Error adding company: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error adding establishment: ' . $e->getMessage());
    }
}

function uploadEstablishmentFile($file, $uploadDir, $type = '') {
    // Ensure directory exists and is writable
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    if (!is_writable($uploadDir)) {
        chmod($uploadDir, 0777);
    }
    
    $fileExt = pathinfo($file['name'], PATHINFO_EXTENSION);
    $newFilename = ($type != '' ? $type . '_' : '') . uniqid() . time() . '.' . $fileExt;
    $uploadFile = $uploadDir . $newFilename;

    // Verify it's an uploaded file
    if (!is_uploaded_file($file['tmp_name'])) {
        error_log('Not an uploaded file: ' . $file['tmp_name']);
        JWTHelper::sendResponse(500, false, 'Invalid ' . $type . ' file upload');
    }

    if (!@move_uploaded_file($file['tmp_name'], $uploadFile)) {
        $error = error_get_last();
        error_log('Failed to move uploaded file: ' . print_r($error, true));
        error_log('Upload dir: ' . $uploadDir);
        error_log('Target file: ' . $uploadFile);
        error_log('Dir writable: ' . (is_writable($uploadDir) ? 'yes' : 'no'));
        JWTHelper::sendResponse(500, false, 'Failed to upload ' . $type . ' file. Check server permissions.');
    }

    return $newFilename;
}

function handleLoadCompany($pdo, $user) {
    $companyId = isset($_POST['companyId']) ? (int)$_POST['companyId'] : 0;
    
    if (!$companyId) {
        JWTHelper::sendResponse(400, false, 'Company ID is required');
    }
    
    $stmt = $pdo->prepare("SELECT * FROM company WHERE company_id = :id");
    $stmt->execute([':id' => $companyId]);
    $company = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$company) {
        JWTHelper::sendResponse(404, false, 'Company not found');
    }
    
    JWTHelper::sendResponse(200, true, 'Company loaded successfully', [
        'company' => $company
    ]);
}

function handleUpdateCompany($pdo, $user) {
    $id = isset($_POST['idEdit']) ? (int)$_POST['idEdit'] : 0;
    $name = isset($_POST['nameEdit']) ? trim($_POST['nameEdit']) : '';
    $type = isset($_POST['typeEdit']) ? trim($_POST['typeEdit']) : '';
    $quota = isset($_POST['quotaEdit']) ? trim($_POST['quotaEdit']) : '';
    $expiry = isset($_POST['expiryEdit']) ? trim($_POST['expiryEdit']) : '';
    $number = isset($_POST['numberEdit']) ? trim($_POST['numberEdit']) : '';
    $username = isset($_POST['usernameEdit']) ? trim($_POST['usernameEdit']) : '';
    $password = isset($_POST['passwordEdit']) ? trim($_POST['passwordEdit']) : '';

    if (!$id) {
        JWTHelper::sendResponse(400, false, 'Company ID is required');
    }

    $errors = [];
    if (empty($name)) $errors['nameEdit'] = 'Company name is required';
    if (empty($type)) $errors['typeEdit'] = 'Company type is required';
    if (empty($quota)) $errors['quotaEdit'] = 'Starting quota is required';
    if (empty($expiry)) $errors['expiryEdit'] = 'Expiry date is required';
    if (empty($number)) $errors['numberEdit'] = 'Company number is required';

    if (count($errors) > 0) {
        JWTHelper::sendResponse(400, false, 'form_errors', ['errors' => $errors]);
    }

    // Check if company number already exists (excluding current company)
    $stmt = $pdo->prepare("SELECT * FROM company WHERE company_number = :number AND company_id != :id");
    $stmt->execute([':number' => $number, ':id' => $id]);
    $company = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($company) {
        JWTHelper::sendResponse(400, false, 'form_errors', ['errors' => ['numberEdit' => 'Company number already exists']]);
    }

    // Load existing company data to preserve old file references
    $stmt = $pdo->prepare("SELECT letterhead, stamp, signature, trade_license_copy, establishment_card FROM company WHERE company_id = :id");
    $stmt->execute([':id' => $id]);
    $existingCompany = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existingCompany) {
        JWTHelper::sendResponse(404, false, 'Company not found');
    }

    // Handle file uploads
    $uploadDir = __DIR__ . '/../../letters/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $letterheadFile = $existingCompany['letterhead'];
    $stampFile = $existingCompany['stamp'];
    $signatureFile = $existingCompany['signature'];
    $tradeLicenseFile = $existingCompany['trade_license_copy'];
    $establishmentCardFile = $existingCompany['establishment_card'];

    // Track old files for deletion
    $oldFiles = [];

    if (isset($_FILES['letterHeadEdit']) && $_FILES['letterHeadEdit']['error'] === UPLOAD_ERR_OK) {
        $oldFiles[] = $existingCompany['letterhead'];
        $letterheadFile = uploadEstablishmentFile($_FILES['letterHeadEdit'], $uploadDir, 'letterhead');
    }
    if (isset($_FILES['stampEdit']) && $_FILES['stampEdit']['error'] === UPLOAD_ERR_OK) {
        $oldFiles[] = $existingCompany['stamp'];
        $stampFile = uploadEstablishmentFile($_FILES['stampEdit'], $uploadDir, 'stamp');
    }
    if (isset($_FILES['signatureEdit']) && $_FILES['signatureEdit']['error'] === UPLOAD_ERR_OK) {
        $oldFiles[] = $existingCompany['signature'];
        $signatureFile = uploadEstablishmentFile($_FILES['signatureEdit'], $uploadDir, 'signature');
    }
    if (isset($_FILES['tradeLicenseEdit']) && $_FILES['tradeLicenseEdit']['error'] === UPLOAD_ERR_OK) {
        $oldFiles[] = $existingCompany['trade_license_copy'];
        $tradeLicenseFile = uploadEstablishmentFile($_FILES['tradeLicenseEdit'], $uploadDir, 'trade_license');
    }
    if (isset($_FILES['establishmentCardEdit']) && $_FILES['establishmentCardEdit']['error'] === UPLOAD_ERR_OK) {
        $oldFiles[] = $existingCompany['establishment_card'];
        $establishmentCardFile = uploadEstablishmentFile($_FILES['establishmentCardEdit'], $uploadDir, 'establishment_card');
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE company 
            SET 
                company_name = :name, 
                company_type = :type, 
                starting_quota = :quota, 
                company_expiry = :expiry, 
                company_number = :number,
                username = :username,
                password = :password,
                letterhead = :letterhead,
                stamp = :stamp,
                signature = :signature,
                trade_license_copy = :trade_license_copy,
                establishment_card = :establishment_card
            WHERE company_id = :id
        ");
        $stmt->execute([
            ':name' => $name,
            ':type' => $type,
            ':quota' => $quota,
            ':expiry' => $expiry,
            ':number' => $number,
            ':username' => $username,
            ':password' => $password,
            ':letterhead' => $letterheadFile,
            ':stamp' => $stampFile,
            ':signature' => $signatureFile,
            ':trade_license_copy' => $tradeLicenseFile,
            ':establishment_card' => $establishmentCardFile,
            ':id' => $id
        ]);

        // Delete old files if they were replaced
        foreach ($oldFiles as $oldFile) {
            if (!empty($oldFile) && file_exists($uploadDir . $oldFile)) {
                @unlink($uploadDir . $oldFile);
            }
        }

        JWTHelper::sendResponse(200, true, 'Company updated successfully');
    } catch (Exception $e) {
        error_log('Error updating company: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error updating company: ' . $e->getMessage());
    }
}

function handleDeleteCompany($pdo, $user) {
    $companyId = isset($_POST['companyId']) ? (int)$_POST['companyId'] : 0;
    
    if (!$companyId) {
        JWTHelper::sendResponse(400, false, 'Company ID is required');
    }
    
    // Check if company has employees
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM residence WHERE company = :id");
    $stmt->execute([':id' => $companyId]);
    $employeeCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    if ($employeeCount > 0) {
        JWTHelper::sendResponse(400, false, "Cannot delete company with {$employeeCount} employee(s)");
    }
    
    $stmt = $pdo->prepare("DELETE FROM company WHERE company_id = :id");
    $stmt->execute([':id' => $companyId]);
    
    JWTHelper::sendResponse(200, true, 'Company deleted successfully');
}

function handleAddPerson($pdo, $user) {
    $fullName = isset($_POST['fullName']) ? trim($_POST['fullName']) : '';
    $role = isset($_POST['role']) ? trim($_POST['role']) : '';
    $passportNumber = isset($_POST['passportNumber']) ? trim($_POST['passportNumber']) : '';
    $emiratesId = isset($_POST['emiratesId']) ? trim($_POST['emiratesId']) : '';
    $phone = isset($_POST['phone']) ? trim($_POST['phone']) : '';
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';
    $nationality = isset($_POST['nationality']) ? trim($_POST['nationality']) : '';
    $dateOfBirth = isset($_POST['dateOfBirth']) ? trim($_POST['dateOfBirth']) : '';

    $errors = [];
    if (empty($fullName)) {
        $errors['fullName'] = 'Full name is required';
    }
    
    // Validate required file uploads
    if (!isset($_FILES['passportCopy']) || $_FILES['passportCopy']['error'] !== UPLOAD_ERR_OK) {
        $errors['passportCopy'] = 'Passport copy is required';
    }
    if (!isset($_FILES['emiratesIdCopy']) || $_FILES['emiratesIdCopy']['error'] !== UPLOAD_ERR_OK) {
        $errors['emiratesIdCopy'] = 'Emirates ID copy is required';
    }
    if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        $errors['photo'] = 'Photo is required';
    }

    if (count($errors) > 0) {
        JWTHelper::sendResponse(400, false, 'form_errors', ['errors' => $errors]);
    }

    // Handle file uploads
    $uploadDir = __DIR__ . '/../../letters/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $passportCopy = uploadEstablishmentFile($_FILES['passportCopy'], $uploadDir, 'passport');
    $emiratesIdCopy = uploadEstablishmentFile($_FILES['emiratesIdCopy'], $uploadDir, 'emirates');
    $photo = uploadEstablishmentFile($_FILES['photo'], $uploadDir, 'photo');

    try {
        $pdo->beginTransaction();

        // Insert person
        $stmt = $pdo->prepare("
            INSERT INTO person_information 
            (full_name, role, passport_number, emirates_id, phone, email, nationality, date_of_birth, passport_copy, emirates_id_copy, photo) 
            VALUES (:full_name, :role, :passport_number, :emirates_id, :phone, :email, :nationality, :date_of_birth, :passport_copy, :emirates_id_copy, :photo)
        ");
        $stmt->execute([
            ':full_name' => $fullName,
            ':role' => $role,
            ':passport_number' => $passportNumber,
            ':emirates_id' => $emiratesId,
            ':phone' => $phone,
            ':email' => $email,
            ':nationality' => $nationality,
            ':date_of_birth' => $dateOfBirth,
            ':passport_copy' => $passportCopy,
            ':emirates_id_copy' => $emiratesIdCopy,
            ':photo' => $photo
        ]);

        $personId = $pdo->lastInsertId();

        // Handle additional documents
        if (isset($_FILES['additionalDocuments']) && isset($_POST['documentNames']) && isset($_POST['documentTypes'])) {
            $documentNames = $_POST['documentNames'];
            $documentTypes = $_POST['documentTypes'];
            $additionalDocuments = $_FILES['additionalDocuments'];

            $stmt = $pdo->prepare("
                INSERT INTO person_documents 
                (person_id, document_name, document_type, file_path, file_size, file_extension, uploaded_by) 
                VALUES (:person_id, :document_name, :document_type, :file_path, :file_size, :file_extension, :uploaded_by)
            ");

            foreach ($additionalDocuments['name'] as $i => $fileName) {
                if (!empty($fileName) && $additionalDocuments['error'][$i] === UPLOAD_ERR_OK && !empty($documentNames[$i])) {
                    $fileExt = pathinfo($fileName, PATHINFO_EXTENSION);
                    $newFilename = 'person_doc_' . uniqid() . time() . '.' . $fileExt;
                    $uploadFile = $uploadDir . $newFilename;

                    if (move_uploaded_file($additionalDocuments['tmp_name'][$i], $uploadFile)) {
                        $uploadedBy = $user['user_id'] ?? $user['staff_id'] ?? 0;
                        
                        $stmt->execute([
                            ':person_id' => $personId,
                            ':document_name' => $documentNames[$i],
                            ':document_type' => $documentTypes[$i],
                            ':file_path' => 'letters/' . $newFilename,
                            ':file_size' => $additionalDocuments['size'][$i],
                            ':file_extension' => $fileExt,
                            ':uploaded_by' => $uploadedBy
                        ]);
                    }
                }
            }
        }

        $pdo->commit();
        JWTHelper::sendResponse(200, true, 'Person added successfully');
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Error adding person: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error adding person: ' . $e->getMessage());
    }
}

function handleGetCompanyFiles($pdo, $user) {
    $companyId = isset($_POST['companyId']) ? (int)$_POST['companyId'] : 0;
    
    if (!$companyId) {
        JWTHelper::sendResponse(400, false, 'Company ID is required');
    }
    
    // Get standard documents
    $stmt = $pdo->prepare("
        SELECT company_id, company_name, letterhead, stamp, signature, trade_license_copy, establishment_card 
        FROM company 
        WHERE company_id = :id
    ");
    $stmt->execute([':id' => $companyId]);
    $company = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$company) {
        JWTHelper::sendResponse(404, false, 'Company not found');
    }
    
    // Get additional files from company_files table
    $stmt = $pdo->prepare("
        SELECT file_id, file_name, display_name, file_path, file_size, file_extension, upload_date
        FROM company_files 
        WHERE company_id = :id
        ORDER BY upload_date DESC
    ");
    $stmt->execute([':id' => $companyId]);
    $additionalFiles = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    JWTHelper::sendResponse(200, true, 'Company files retrieved successfully', [
        'company' => $company,
        'additionalFiles' => $additionalFiles
    ]);
}

function handleUploadCompanyFile($pdo, $user) {
    $companyId = isset($_POST['companyId']) ? (int)$_POST['companyId'] : 0;
    $fileName = isset($_POST['fileName']) ? trim($_POST['fileName']) : '';
    
    if (!$companyId) {
        JWTHelper::sendResponse(400, false, 'Company ID is required');
    }
    if (empty($fileName)) {
        JWTHelper::sendResponse(400, false, 'File name is required');
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        JWTHelper::sendResponse(400, false, 'File is required');
    }
    
    $uploadDir = __DIR__ . '/../../letters/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $file = $_FILES['file'];
    $fileExt = pathinfo($file['name'], PATHINFO_EXTENSION);
    $newFilename = 'company_' . $companyId . '_' . uniqid() . time() . '.' . $fileExt;
    $uploadFile = $uploadDir . $newFilename;
    
    if (!move_uploaded_file($file['tmp_name'], $uploadFile)) {
        JWTHelper::sendResponse(500, false, 'Failed to upload file');
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO company_files 
            (company_id, file_name, display_name, file_path, file_size, file_extension, uploaded_by) 
            VALUES (:company_id, :file_name, :display_name, :file_path, :file_size, :file_extension, :uploaded_by)
        ");
        $uploadedBy = $user['user_id'] ?? $user['staff_id'] ?? 0;
        
        $stmt->execute([
            ':company_id' => $companyId,
            ':file_name' => $newFilename,
            ':display_name' => $fileName,
            ':file_path' => 'letters/' . $newFilename,
            ':file_size' => $file['size'],
            ':file_extension' => $fileExt,
            ':uploaded_by' => $uploadedBy
        ]);
        
        JWTHelper::sendResponse(200, true, 'File uploaded successfully');
    } catch (Exception $e) {
        error_log('Error uploading company file: ' . $e->getMessage());
        JWTHelper::sendResponse(500, false, 'Error uploading file: ' . $e->getMessage());
    }
}

function handleDeleteCompanyFile($pdo, $user) {
    $fileId = isset($_POST['fileId']) ? (int)$_POST['fileId'] : 0;
    
    if (!$fileId) {
        JWTHelper::sendResponse(400, false, 'File ID is required');
    }
    
    // Get file info
    $stmt = $pdo->prepare("SELECT file_path FROM company_files WHERE file_id = :id");
    $stmt->execute([':id' => $fileId]);
    $file = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$file) {
        JWTHelper::sendResponse(404, false, 'File not found');
    }
    
    // Delete from database
    $stmt = $pdo->prepare("DELETE FROM company_files WHERE file_id = :id");
    $stmt->execute([':id' => $fileId]);
    
    // Delete physical file
    $uploadDir = __DIR__ . '/../../';
    $filePath = $uploadDir . $file['file_path'];
    if (file_exists($filePath)) {
        @unlink($filePath);
    }
    
    JWTHelper::sendResponse(200, true, 'File deleted successfully');
}

