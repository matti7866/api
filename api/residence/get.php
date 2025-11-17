<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Get Single Residence Details
 * Endpoint: /api/residence/get.php
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

// Get residence ID
$residenceID = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if (!$residenceID) {
    JWTHelper::sendResponse(400, false, 'Residence ID is required');
}

try {
    $sql = "SELECT 
                r.*,
                c.customer_name,
                c.customer_phone,
                c.customer_email,
                c.customer_whatsapp,
                a.countryName as nationality_name,
                s.serviceName as visa_type_name,
                curr.currencyName as sale_currency_name,
                salaryCurr.currencyName as salary_currency_name,
                comp.company_name,
                comp.company_number,
                pos.posiiton_name as position_name,
                
                -- Suppliers
                offerSupp.supp_name as offerLetterSupplier_name,
                insurSupp.supp_name as insuranceSupplier_name,
                laborSupp.supp_name as laborCardSupplier_name,
                eVisaSupp.supp_name as eVisaSupplier_name,
                changeSupp.supp_name as changeStatusSupplier_name,
                medicalSupp.supp_name as medicalSupplier_name,
                eidSupp.supp_name as emiratesIDSupplier_name,
                stampSupp.supp_name as visaStampingSupplier_name,
                
                -- Accounts
                offerAcc.account_Name as offerLetterAccount_name,
                insurAcc.account_Name as insuranceAccount_name,
                laborAcc.account_Name as laborCardAccount_name,
                eVisaAcc.account_Name as eVisaAccount_name,
                changeAcc.account_Name as changeStatusAccount_name,
                medicalAcc.account_Name as medicalAccount_name,
                eidAcc.account_Name as emiratesIDAccount_name,
                stampAcc.account_Name as visaStampingAccount_name,
                
                -- Uploaders (Staff)
                s1.staff_name as step1_uploader_name,
                s2.staff_name as step2_uploader_name,
                s3.staff_name as step3_uploader_name,
                s4.staff_name as step4_uploader_name,
                s5.staff_name as step5_uploader_name,
                s6.staff_name as step6_uploader_name,
                s7.staff_name as step7_uploader_name,
                s8.staff_name as step8_uploader_name,
                s9.staff_name as step9_uploader_name,
                s10.staff_name as step10_uploader_name
                
            FROM residence r
            LEFT JOIN customer c ON r.customer_id = c.customer_id
            LEFT JOIN airports a ON r.Nationality = a.airport_id
            LEFT JOIN service s ON r.VisaType = s.serviceID
            LEFT JOIN currency curr ON r.saleCurID = curr.currencyID
            LEFT JOIN currency salaryCurr ON r.salaryCurID = salaryCurr.currencyID
            LEFT JOIN company comp ON r.company = comp.company_id
            LEFT JOIN position pos ON r.positionID = pos.position_id
            
            -- Suppliers
            LEFT JOIN supplier offerSupp ON r.offerLetterSupplier = offerSupp.supp_id
            LEFT JOIN supplier insurSupp ON r.insuranceSupplier = insurSupp.supp_id
            LEFT JOIN supplier laborSupp ON r.laborCardSupplier = laborSupp.supp_id
            LEFT JOIN supplier eVisaSupp ON r.eVisaSupplier = eVisaSupp.supp_id
            LEFT JOIN supplier changeSupp ON r.changeStatusSupplier = changeSupp.supp_id
            LEFT JOIN supplier medicalSupp ON r.medicalSupplier = medicalSupp.supp_id
            LEFT JOIN supplier eidSupp ON r.emiratesIDSupplier = eidSupp.supp_id
            LEFT JOIN supplier stampSupp ON r.visaStampingSupplier = stampSupp.supp_id
            
            -- Accounts
            LEFT JOIN accounts offerAcc ON r.offerLetterAccount = offerAcc.account_ID
            LEFT JOIN accounts insurAcc ON r.insuranceAccount = insurAcc.account_ID
            LEFT JOIN accounts laborAcc ON r.laborCardAccount = laborAcc.account_ID
            LEFT JOIN accounts eVisaAcc ON r.eVisaAccount = eVisaAcc.account_ID
            LEFT JOIN accounts changeAcc ON r.changeStatusAccount = changeAcc.account_ID
            LEFT JOIN accounts medicalAcc ON r.medicalAccount = medicalAcc.account_ID
            LEFT JOIN accounts eidAcc ON r.emiratesIDAccount = eidAcc.account_ID
            LEFT JOIN accounts stampAcc ON r.visaStampingAccount = stampAcc.account_ID
            
            -- Uploaders
            LEFT JOIN staff s1 ON r.StepOneUploader = s1.staff_id
            LEFT JOIN staff s2 ON r.stepTwoUploder = s2.staff_id
            LEFT JOIN staff s3 ON r.stepThreeUploader = s3.staff_id
            LEFT JOIN staff s4 ON r.stepfourUploader = s4.staff_id
            LEFT JOIN staff s5 ON r.stepfiveUploader = s5.staff_id
            LEFT JOIN staff s6 ON r.stepsixUploader = s6.staff_id
            LEFT JOIN staff s7 ON r.stepsevenUpploader = s7.staff_id
            LEFT JOIN staff s8 ON r.stepEightUploader = s8.staff_id
            LEFT JOIN staff s9 ON r.stepNineUpploader = s9.staff_id
            LEFT JOIN staff s10 ON r.steptenUploader = s10.staff_id
            
            WHERE r.residenceID = :residenceID";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindParam(':residenceID', $residenceID, PDO::PARAM_INT);
    $stmt->execute();
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$data) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
    }
    
    JWTHelper::sendResponse(200, true, 'Success', $data);
    
} catch (Exception $e) {
    JWTHelper::sendResponse(500, false, 'Error: ' . $e->getMessage());
}

