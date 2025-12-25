<?php
    require_once __DIR__ . '/cors-headers.php';
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if(!isset($_SESSION['user_id'])){
        // Try JWT token from Authorization header
        require_once(__DIR__ . '/auth/JWTHelper.php');
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            $decoded = JWTHelper::validateToken($token);
            if ($decoded && isset($decoded->data)) {
                $_SESSION['user_id'] = $decoded->data->staff_id ?? null;
                $_SESSION['role_id'] = $decoded->data->role_id ?? null;
                $_SESSION['staff_name'] = $decoded->data->staff_name ?? '';
            }
        }
        
        if(!isset($_SESSION['user_id'])){
            sendJsonResponse(['error' => 'Authentication required'], 401);
        }
    }
    include __DIR__ . '/../connection.php';
    
    // Helper function to send JSON response with CORS headers
    function sendJsonResponse($data, $statusCode = 200) {
        // Set CORS headers
        $allowedOrigins = [
            'http://localhost:5174', 
            'http://127.0.0.1:5174',
            'http://localhost:5176', 
            'http://127.0.0.1:5176',
            'https://ssn.sntrips.com',
            'http://ssn.sntrips.com',
            'https://app.sntrips.com',
            'http://app.sntrips.com'
        ];
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        
        if (in_array($origin, $allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        }
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    $sql = "SELECT permission.select,permission.insert,permission.delete FROM `permission` WHERE role_id = :role_id AND page_name = 'Company Documents' ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':role_id', $_SESSION['role_id']);
    $stmt->execute();
    $records = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    
    if (empty($records)) {
        sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Permission denied'], 403);
    }
    
    $select = $records[0]['select'];
    $insert = $records[0]['insert'];
    $delete = $records[0]['delete'];
    
    if($select == 0 && $insert == 0 ){
        sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Permission denied'], 403);
    }
    
    if(isset($_POST['CreateFolder'])){
        try{
            if($insert == 1){
                // First of all, let's begin a transaction
                $pdo->beginTransaction();
                
                // Check if user_id column exists
                $columns = $pdo->query("SHOW COLUMNS FROM company_directories LIKE 'user_id'")->fetchAll();
                $hasUserIdColumn = count($columns) > 0;
                
                // Check if directory name already exists for this user (or globally if public)
                // Explicitly check for '1' string or 1 integer, default to 0 (private) if not set or '0'
                $isPublicValue = isset($_POST['isPublic']) ? $_POST['isPublic'] : '0';
                $isPublic = ($isPublicValue === '1' || $isPublicValue === 1) ? 1 : 0;
                $userId = $isPublic ? NULL : $_SESSION['user_id'];
                
                if ($hasUserIdColumn) {
                    // Check if directory exists (for public, check globally; for private, check for this user)
                    if ($isPublic) {
                        $sql = "SELECT directory_name FROM company_directories WHERE directory_name = :directory_name AND (is_public = 1 OR user_id IS NULL)";
                    } else {
                        $sql = "SELECT directory_name FROM company_directories WHERE directory_name = :directory_name AND user_id = :userId";
                    }
                } else {
                    $sql = "SELECT directory_name FROM company_directories WHERE directory_name = :directory_name";
                }
                
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':directory_name', $_POST['Foler_Name']);
                if (!$isPublic && $hasUserIdColumn) {
                    $stmt->bindParam(':userId', $userId);
                }
                $stmt->execute();
                $directory = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                
                if($directory){
                    $directory = $directory[0]['directory_name'];
                    if(is_dir(__DIR__ . '/../company_files/'. $directory)){
                        $pdo->rollback();
                        sendJsonResponse(['msg' => 'error', 'msgDetails' => "Directory already exists with the name " . $_POST['Foler_Name']], 400);
                    }else{
                        $pdo->rollback();
                        sendJsonResponse(['msg' => 'error', 'msgDetails' => "Directory already exists with the name " . $_POST['Foler_Name']], 400);
                    }
                }else{
                    // Create directory in filesystem
                    mkdir(__DIR__ . '/../company_files/'.$_POST['Foler_Name'] , 0777, true);
                    
                    // Insert into database
                    if ($hasUserIdColumn) {
                        $sql = "INSERT INTO `company_directories` (`directory_name`, `user_id`, `is_public`) VALUES (:directoryName, :userId, :isPublic)  ";
                        $stmt = $pdo->prepare($sql);
                        $stmt->bindParam(':directoryName', $_POST['Foler_Name']);
                        $stmt->bindParam(':userId', $userId);
                        $stmt->bindParam(':isPublic', $isPublic);
                    } else {
                        // Fallback for old structure
                        $sql = "INSERT INTO `company_directories` (`directory_name`) VALUES (:directoryName)  ";
                        $stmt = $pdo->prepare($sql);
                        $stmt->bindParam(':directoryName', $_POST['Foler_Name']);
                    }
                    $stmt->execute();
                    $pdo->commit();
                    
                    $sql = "SELECT directory_id FROM company_directories WHERE directory_name = :directory_name";
                    if ($hasUserIdColumn && !$isPublic) {
                        $sql .= " AND user_id = :userId";
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->bindParam(':directory_name', $_POST['Foler_Name']);
                    if ($hasUserIdColumn && !$isPublic) {
                        $stmt->bindParam(':userId', $userId);
                    }
                    $stmt->execute();
                    $id = $stmt->fetchColumn();
                    sendJsonResponse(['msg' => 'success', 'id' => $id]);
                }
            }
        }catch(PDOException $e){
            $pdo->rollback();
            sendJsonResponse(['msg' => 'error', 'msgDetails' => $e->getMessage()], 500);
        }
    }else if(isset($_POST['uploadCompanyFiles']) || isset($_FILES['uploadFile'])){
        try{
            // Debug logging
            error_log('Upload request received. POST data: ' . print_r($_POST, true));
            error_log('FILES data: ' . print_r($_FILES, true));
            
            // Check if file was uploaded
            if(!isset($_FILES['uploadFile'])){
                sendJsonResponse(['msg' => 'error', 'msgDetails' => 'No file uploaded. File field name must be "uploadFile"'], 400);
            }
            
            if($_FILES['uploadFile']['error'] !== UPLOAD_ERR_OK){
                $errorMsg = 'File upload error';
                switch($_FILES['uploadFile']['error']){
                    case UPLOAD_ERR_INI_SIZE:
                    case UPLOAD_ERR_FORM_SIZE:
                        $errorMsg = 'File size exceeds limit (max 10MB)';
                        break;
                    case UPLOAD_ERR_PARTIAL:
                        $errorMsg = 'File was only partially uploaded';
                        break;
                    case UPLOAD_ERR_NO_FILE:
                        $errorMsg = 'No file was uploaded';
                        break;
                    case UPLOAD_ERR_NO_TMP_DIR:
                        $errorMsg = 'Missing temporary folder';
                        break;
                    case UPLOAD_ERR_CANT_WRITE:
                        $errorMsg = 'Failed to write file to disk';
                        break;
                    case UPLOAD_ERR_EXTENSION:
                        $errorMsg = 'File upload stopped by extension';
                        break;
                    default:
                        $errorMsg = 'Upload error code: ' . $_FILES['uploadFile']['error'];
                }
                sendJsonResponse(['msg' => 'error', 'msgDetails' => $errorMsg], 400);
            }
            
            // Check if directory ID is provided
            if(!isset($_POST['DID']) || empty($_POST['DID'])){
                sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Directory ID is required'], 400);
            }
            
            if($insert){
                // First of all, let's begin a transaction
            $pdo->beginTransaction();
            $sql = "SELECT directory_name FROM company_directories WHERE directory_id = :directory_id";
            $stmt = $pdo->prepare($sql);
            $stmt->bindParam(':directory_id', $_POST['DID']);
            $stmt->execute();
            $directory =  $stmt->fetchColumn();
                if($directory && trim($directory) !== '')
                {
                    // Ensure parent directory exists
                    $parentDir = __DIR__ . '/../company_files';
                    if(!is_dir($parentDir)){
                        if(!@mkdir($parentDir, 0777, true)){
                            $error = error_get_last();
                            $errorMsg = isset($error['message']) ? $error['message'] : 'Unknown error';
                            $pdo->rollback();
                            sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Failed to create parent directory: ' . $parentDir . '. Error: ' . $errorMsg . '. Please check file permissions. Run fix_company_files_permissions.php to fix permissions.'], 500);
                        }
                    }
                    
                    // Ensure parent directory is writable
                    if(!is_writable($parentDir)){
                        // Try to fix permissions
                        @chmod($parentDir, 0777);
                        if(!is_writable($parentDir)){
                            $pdo->rollback();
                            sendJsonResponse(['msg' => 'error', 'msgDetails' => 'The company_files directory is not writable. Please run fix_company_files_permissions.php or set permissions manually: chmod -R 777 company_files'], 500);
                        }
                    }
                    
                    // Sanitize directory name - remove path traversal attempts and clean special chars
                    $sanitizedDirectory = basename($directory); // Remove any path components
                    // Only replace characters that are problematic for filesystem, keep spaces and common chars
                    $sanitizedDirectory = preg_replace('/[<>:"|?*\x00-\x1f]/', '_', $sanitizedDirectory);
                    
                    // Try original directory name first
                    $originalDirectory = $directory;
                    $directoryPath = $parentDir . '/' . $originalDirectory;
                    
                    if(!is_dir($directoryPath)){
                        // Directory doesn't exist, try to create it
                        $created = @mkdir($directoryPath, 0777, true);
                        if(!$created){
                            // If original fails (might have invalid chars), try sanitized
                            $sanitizedPath = $parentDir . '/' . $sanitizedDirectory;
                            if(is_dir($sanitizedPath)){
                                // Sanitized version already exists, use it
                                $directoryPath = $sanitizedPath;
                                $directory = $sanitizedDirectory;
                            } else {
                                // Try creating sanitized version
                                $created = @mkdir($sanitizedPath, 0777, true);
                                if($created){
                                    $directoryPath = $sanitizedPath;
                                    $directory = $sanitizedDirectory;
                                } else {
                                    $error = error_get_last();
                                    $errorMsg = isset($error['message']) ? $error['message'] : 'Unknown error';
                                    $fullPath = realpath($parentDir) ? realpath($parentDir) : $parentDir;
                                    $pdo->rollback();
                                    sendJsonResponse([
                                        'msg' => 'error', 
                                        'msgDetails' => 'Failed to create directory "' . $originalDirectory . '". Error: ' . $errorMsg . '. Parent directory: ' . $fullPath . '. Please ensure the company_files directory is writable and the directory name does not contain invalid characters. Tried paths: ' . $directoryPath . ' and ' . $sanitizedPath
                                    ], 500);
                                }
                            }
                        }
                    }
                    
                    if(is_dir($directoryPath)){
                            $image = 'Error';
                            if($_FILES['uploadFile']['name'] !='')
                            {
                                $fileExists = "SELECT file_name FROM company_documents WHERE dir_id = :directory_id AND
                                file_name = :fname";
                                $fileExistsStmt = $pdo->prepare($fileExists);
                                $fileExistsStmt->bindParam(':directory_id', $_POST['DID']);
                                $fileExistsStmt->bindParam(':fname',$_FILES['uploadFile']['name']);
                                $fileExistsStmt->execute();
                                $fileInDatabase =  $fileExistsStmt->fetchColumn();
                                if($fileInDatabase){
                                    if(isset($_POST['Agree']) && $_POST['Agree'] == 1){
                                        $deleteFile = "DELETE FROM company_documents WHERE dir_id = :directory_id AND
                                        file_name = :fname";
                                        $deleteFileStmt = $pdo->prepare($deleteFile);
                                        $deleteFileStmt->bindParam(':directory_id', $_POST['DID']);
                                        $deleteFileStmt->bindParam(':fname', $fileInDatabase);
                                        $deleteFileStmt->execute();
                                        if(file_exists(__DIR__ . '/../company_files/'.$directory. '/'. $fileInDatabase)){
                                            unlink(__DIR__ . '/../company_files/'.$directory. '/'. $fileInDatabase);
                                        }
                                        $image = upload_Image($_FILES['uploadFile']['name'],$directory );
                                        if($image == '')
                                        {
                                            $image = 'Error';
                                        }

                                    }else{
                                        sendJsonResponse(['msg' => 'info', 'msgDetails' => "file with the name". $fileInDatabase . " exists inside " . $directory. " directory. Do you want to replace it or you can rename the file name"]);
                                    }
                                }else{
                                    $image = upload_Image($_FILES['uploadFile']['name'],$directory );
                                        if($image == '')
                                        {
                                            $image = 'Error';
                                        }
                                }
                                
                            }
                            if($image == 'Error' || $image == '')
                            {
                                if($pdo->inTransaction()){
                                    $pdo->rollback();
                                }
                                $errorDetails = 'File upload failed. ';
                                if(!isset($_FILES['uploadFile']['name']) || empty($_FILES['uploadFile']['name'])){
                                    $errorDetails .= 'No file name provided.';
                                } else {
                                    $ext = strtolower(pathinfo($_FILES['uploadFile']['name'], PATHINFO_EXTENSION));
                                    $allowedExts = ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'ppt', 'zip'];
                                    if(!in_array($ext, $allowedExts)){
                                        $errorDetails .= 'File type not allowed. Allowed types: ' . implode(', ', $allowedExts);
                                    } else {
                                        $errorDetails .= 'Please check file permissions and try again.';
                                    }
                                }
                                sendJsonResponse(['msg' => 'error', 'msgDetails' => $errorDetails], 400);
                            }
                            else
                            {
                                
                                $sql = "INSERT INTO `company_documents`(`file_name`,  `uploaded_by`,`dir_id`)
                                VALUES (:file_name, :uploaded_by,:dir_id)";
                                $stmt = $pdo->prepare($sql);
                                // bind parameters to statement
                                $stmt->bindParam(':file_name', $_FILES['uploadFile']['name']);
                                $stmt->bindParam(':uploaded_by', $_SESSION['user_id']);
                                $stmt->bindParam(':dir_id', $_POST['DID']);
                                // execute the prepared statement
                                $stmt->execute();
                                $pdo->commit(); 
                                sendJsonResponse(['msg' => 'success', 'msgDetails' => 'File Uploaded Successfully']);
                            }
                        }
                        else
                        {
                            $pdo->rollback();
                            sendJsonResponse(['msg' => 'error', 'msgDetails' => "Directory does not exist in filesystem: " . $directory . '. The directory has been created automatically. Please try uploading again.'], 400);
                        }
                }
                else
                {
                    if($pdo->inTransaction()){
                        $pdo->rollback();
                    }
                    sendJsonResponse(['msg' => 'error', 'msgDetails' => "Directory not found with ID: " . $_POST['DID']], 400);
                }
            } else {
                sendJsonResponse(['msg' => 'error', 'msgDetails' => 'You do not have permission to upload files'], 403);
            }
            
        }catch(PDOException $e){
            if($pdo->inTransaction()){
                $pdo->rollback();
            }
            error_log('Upload error: ' . $e->getMessage());
            sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Database error: ' . $e->getMessage()], 500);
        }catch(Exception $e){
            if($pdo->inTransaction()){
                $pdo->rollback();
            }
            error_log('Upload error: ' . $e->getMessage());
            sendJsonResponse(['msg' => 'error', 'msgDetails' => 'Error: ' . $e->getMessage()], 500);
        }
    }else if(isset($_POST["DELETE_VAR"])){
        try{
            if($delete == 1){
                // First of all, let's begin a transaction
            $pdo->beginTransaction();
            if($_POST['IsFile'] == 'true'){
                $sql = "SELECT directory_name FROM company_directories WHERE directory_id = :directory_id";
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':directory_id', $_POST['ParentCustomID']);
                $stmt->execute();
                $directory =  $stmt->fetchColumn();
                if($directory){
                    if(is_dir(__DIR__ . '/../company_files/'.$directory)){
                        $fileExists = "SELECT file_name FROM company_documents WHERE dir_id = :directory_id AND
                        document_id = :document_id";
                        $fileExistsStmt = $pdo->prepare($fileExists);
                        $fileExistsStmt->bindParam(':directory_id', $_POST['ParentCustomID']);
                        $fileExistsStmt->bindParam(':document_id',$_POST['CustomID']);
                        $fileExistsStmt->execute();
                        $fileInDatabase =  $fileExistsStmt->fetchColumn();
                        $deleteFile = "DELETE FROM company_documents WHERE dir_id = :directory_id AND
                        document_id = :document_id";
                        $deleteFileStmt = $pdo->prepare($deleteFile);
                        $deleteFileStmt->bindParam(':directory_id', $_POST['ParentCustomID']);
                        $deleteFileStmt->bindParam(':document_id', $_POST['CustomID']);
                        $deleteFileStmt->execute();
                        if(file_exists(__DIR__ . '/../company_files/'.$directory. '/'. $fileInDatabase)){
                            unlink(__DIR__ . '/../company_files/'.$directory. '/'. $fileInDatabase);
                        }
                        $pdo->commit();
                        sendJsonResponse(['msg' => 'success', 'msgDetails' => 'File with the name '.$fileInDatabase. ' deleted successfully']);
                    }else{
                        $pdo->rollback();
                        sendJsonResponse(['msg' => 'error', 'msgDetails' => "Something went wrong! contact technical team"], 500);
                    }
                }else{
                    $pdo->rollback();
                    sendJsonResponse(['msg' => 'error', 'msgDetails' => "Something went wrong! contact technical team"], 500);
                }
            }else if($_POST['IsFile'] == 'false'){
                $sql = "SELECT directory_name FROM company_directories WHERE directory_id = :directory_id";
                $stmt = $pdo->prepare($sql);
                $stmt->bindParam(':directory_id', $_POST['CustomID']);
                $stmt->execute();
                $directory =  $stmt->fetchColumn();
                if($directory){
                    if(is_dir(__DIR__ . '/../company_files/'.$directory)){
                        // delete all files of given directory from database
                        $deleteFile = "DELETE FROM company_documents WHERE dir_id = :directory_id";
                        $deleteFileStmt = $pdo->prepare($deleteFile);
                        $deleteFileStmt->bindParam(':directory_id', $_POST['CustomID']);
                        $deleteFileStmt->execute();
                        // delete the directory from database
                        $deleteFolder = "DELETE FROM company_directories WHERE directory_id = :directory_id";
                        $deleteFolderStmt = $pdo->prepare($deleteFolder);
                        $deleteFolderStmt->bindParam(':directory_id', $_POST['CustomID']);
                        $deleteFolderStmt->execute();
                        if(file_exists(__DIR__ . '/../company_files/'.$directory)){
                            array_map('unlink', glob(__DIR__ . "/../company_files/".$directory . "/*.*"));
                            rmdir(__DIR__ . '/../company_files/'.$directory);
                        }
                        $pdo->commit();
                        sendJsonResponse(['msg' => 'success', 'msgDetails' => 'Directory deleted successfully!']);
                    }else{
                        $pdo->rollback();
                        sendJsonResponse(['msg' => 'error', 'msgDetails' => "Something went wrong! contact technical team"], 500);
                    }
                }else{
                    $pdo->rollback();
                    sendJsonResponse(['msg' => 'error', 'msgDetails' => "Something went wrong! contact technical team"], 500);
                }
            }
           
            }         
        }catch(PDOException $e){
            $pdo->rollback();
            sendJsonResponse(['msg' => 'error', 'msgDetails' => $e->getMessage()], 500);
        }
    }else if(isset($_POST['GetDocuments'])){
        if($select == 1){
            $folder = [];
        $folderFiles =  [];
        $finalArr = [];
        
        // Check if user_id column exists
        $columns = $pdo->query("SHOW COLUMNS FROM company_directories LIKE 'user_id'")->fetchAll();
        $hasUserIdColumn = count($columns) > 0;
        
        if ($hasUserIdColumn) {
            // Get Public folders (is_public = 1 OR user_id IS NULL) and user's own folders
            $selectQuery = $pdo->prepare("
                SELECT * FROM company_directories 
                WHERE (is_public = 1 OR user_id IS NULL OR user_id = :userId)
                ORDER BY 
                    CASE WHEN is_public = 1 OR user_id IS NULL THEN 0 ELSE 1 END,
                    company_directories.directory_id DESC
            ");
            $selectQuery->bindParam(':userId', $_SESSION['user_id']);
        } else {
            // Fallback: get all directories (old structure)
            $selectQuery = $pdo->prepare("SELECT * FROM company_directories ORDER BY company_directories.directory_id DESC");
        }
        $selectQuery->execute();
        /* Fetch all of the remaining rows in the result set */
        $directories = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
        
        for($i=0; $i< count($directories); $i++){

            $documentsQuery = $pdo->prepare("SELECT * FROM company_documents WHERE company_documents.dir_id = :dirID ORDER BY 
            company_documents.document_id DESC");
            $documentsQuery->bindParam(':dirID', $directories[$i]['directory_id']);
            $documentsQuery->execute();
            /* Fetch all of the remaining rows in the result set */
            $files = $documentsQuery->fetchAll(\PDO::FETCH_ASSOC);
            $folderFiles = [];
            if(count($files) > 0 ){
                for($j=0; $j< count($files); $j++){
                   array_push($folderFiles,
                        array(
                            'text' => $files[$j]['file_name'], 
                            'customID' =>  $files[$j]['document_id'],
                            'isFile' => 'true',
                            'parentCustomID' => $directories[$i]['directory_id'],
                            'type' => 'file',
                        )
                    );
                }
                array_push($finalArr,   
                        array(
                            'text' => $directories[$i]['directory_name'],
                            'parent' => '#',
                            'isFile' => 'false',
                            'customID' => $directories[$i]['directory_id'],
                            'children' => $folderFiles,
                            'is_public' => isset($directories[$i]['is_public']) ? $directories[$i]['is_public'] : ($directories[$i]['directory_name'] === 'Public' ? 1 : 0),
                            'user_id' => isset($directories[$i]['user_id']) ? $directories[$i]['user_id'] : NULL
                        )
                );
            }else{
                array_push($finalArr,   
                        array(
                            'text' => $directories[$i]['directory_name'],
                            'parent' => '#',
                            'isFile' => 'false',
                            'customID' => $directories[$i]['directory_id'],
                            'is_public' => isset($directories[$i]['is_public']) ? $directories[$i]['is_public'] : ($directories[$i]['directory_name'] === 'Public' ? 1 : 0),
                            'user_id' => isset($directories[$i]['user_id']) ? $directories[$i]['user_id'] : NULL
                        )
                );
            }
            
            
           
        }
        sendJsonResponse($finalArr);
        }
        
    }
    
    function upload_Image($companyDocument,$directory){
        $new_image_name = '';
        
        // Check if file exists
        if(!isset($_FILES['uploadFile']) || $_FILES['uploadFile']['error'] !== UPLOAD_ERR_OK){
            return '';
        }
        
        if($_FILES['uploadFile']['size']<=10485760){
            $extension = explode(".", $_FILES['uploadFile']['name']);
            $f_name = '';
            $f_ext = '';
            if(count($extension) > 2){
                for($i = 0; $i< count($extension); $i++){
                    if(count($extension) == $extension[$i]){
                        $f_name  = $f_name . $extension[$i];
                    }else{
                        $f_ext = $extension[$i];
                    }
                }
               
            }else{
                $f_name =  $extension[0];
                $f_ext = $extension[1];
            }
            $ext = array("txt", "pdf", "doc", "docx","xls","xlsx","jpg","jpeg","png","ppt",'zip');
            if (in_array(strtolower($f_ext), $ext))
            {
                $new_image_name = __DIR__ . '/../company_files/'. $directory. '/'. $f_name. '.' .$f_ext;
                $destination = $new_image_name;
                
                // Ensure directory exists
                $destDir = dirname($destination);
                if(!is_dir($destDir)){
                    @mkdir($destDir, 0777, true);
                }
                
                // Move uploaded file
                if(!move_uploaded_file($_FILES['uploadFile']['tmp_name'], $destination)){
                    error_log('Failed to move uploaded file to: ' . $destination);
                    return '';
                }
            }else{
                $new_image_name = '';
            }
            
        } else {
            error_log('File size exceeds limit: ' . $_FILES['uploadFile']['size']);
            return '';
        }
        
        return $new_image_name;
    }
    
   
    // Close connection
    unset($pdo); 
?>
