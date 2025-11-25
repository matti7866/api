<?php
// Include CORS headers
require_once __DIR__ . '/../cors-headers.php';


/**
 * Generate NOC or Salary Certificate Letter
 * Endpoint: /api/residence/generate-letter.php
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
    exit;
}

// Get parameters
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$type = isset($_GET['type']) ? $_GET['type'] : '';
$bank_id = isset($_GET['bank_id']) ? intval($_GET['bank_id']) : 0;

if (!$id || !$type) {
    JWTHelper::sendResponse(400, false, 'Missing required parameters: id and type');
    exit;
}

if ($type === 'salary_certificate' && !$bank_id) {
    JWTHelper::sendResponse(400, false, 'Bank ID is required for salary certificate');
    exit;
}

try {
        // Database connection check
    if (!isset($pdo) || $pdo === null) {
        throw new Exception('Database connection not available');
    }
    
// Fetch residence data
    $sql = "SELECT residence.*, airports.countryName AS nationality, position.posiiton_name AS profession
            FROM residence 
            LEFT JOIN airports ON airports.airport_id = residence.nationality
            LEFT JOIN position ON position.position_id = residence.positionID
            WHERE residenceID = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $residence = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$residence) {
        JWTHelper::sendResponse(404, false, 'Residence not found');
        exit;
    }

    // Fetch company data with letterhead, signature, and stamp
    $company = null;
    if ($residence['company']) {
        $sql = "SELECT company_id, company_name, letterhead, signature, stamp FROM company WHERE company_id = :company_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':company_id' => $residence['company']]);
        $company = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Fetch bank data (for salary certificate)
    $bank = null;
    if ($bank_id) {
        $sql = "SELECT * FROM banks WHERE id = :bank_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':bank_id' => $bank_id]);
        $bank = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Generate content based on type
    $title = "";
    $content = "";

    if ($type === 'salary_certificate' && $bank) {
        $title = "Salary Certificate";
        $content = '
            <div class="date">Date: ' . date("M, d Y") . '</div>
            <h1>' . $title . '</h1>
            <p><strong>THE MANAGER<br>' . htmlspecialchars($bank['bank_name'] ?? 'N/A') . '<br>Dubai, UAE</strong></p>
            <p><strong>Dear Sir/Madam,</strong><br>Subject: Application for Bank Account Opening</p>
            <p style="line-height: 1.1; margin: 0 0 2mm 0;">
                <strong>Employee Name: </strong>' . htmlspecialchars($residence['passenger_name'] ?? 'N/A') . '<br>
                <strong>Designation: </strong>' . htmlspecialchars($residence['profession'] ?? 'N/A') . '<br>
                <strong>Date of Joining: </strong>' . date("M d, Y", strtotime($residence['datetime'] ?? 'now')) . '<br>
                <strong>Salary: </strong>' . number_format($residence['salary_amount'] ?? 0) . ' AED<br>
                <strong>Gratuity/Termination Benefits: </strong>AS PER UAE LABOUR LAW<br>
                <strong>Visa Status: </strong>STAMP<br>
                <strong>Passport No: </strong>' . htmlspecialchars($residence['passportNumber'] ?? 'N/A') . '<br>
                <strong>Nationality: </strong>' . htmlspecialchars($residence['nationality'] ?? 'N/A') . '
            </p>
            <p>This is to certify that the above person is employed by us. We are under instruction from this employee to credit his salary with you every month and will continue to do so until we receive a clearance from you.</p>
            <p class="signature-stamp-label"><strong>Manager Director</strong></p>
        ';
    } elseif ($type === 'noc') {
        $title = "No Objection Certificate";
        
        // Get optional NOC parameters
        $purpose = isset($_GET['purpose']) ? $_GET['purpose'] : 'general';
        $destination = isset($_GET['destination']) ? htmlspecialchars($_GET['destination']) : '';
        $from_date = isset($_GET['from_date']) ? $_GET['from_date'] : '';
        $to_date = isset($_GET['to_date']) ? $_GET['to_date'] : '';
        
        // Build purpose-specific content
        $purposeContent = '';
        if ($purpose === 'travel' && $destination && $from_date && $to_date) {
            $purposeContent = '<p>This letter is issued for the purpose of <strong>travel to ' . $destination . '</strong> from <strong>' . date("F d, Y", strtotime($from_date)) . '</strong> to <strong>' . date("F d, Y", strtotime($to_date)) . '</strong>.</p>';
        } elseif ($purpose === 'visa') {
            $purposeContent = '<p>This letter is issued for the purpose of <strong>visa application</strong>.</p>';
        } elseif ($purpose === 'employment') {
            $purposeContent = '<p>This letter is issued to confirm that we have no objection to the employee seeking additional employment opportunities.</p>';
        }
        
        $content = '
            <div class="date">Date: ' . date("F d, Y") . '</div>
            <h1>' . $title . '</h1>
            <p><strong>TO WHOM IT MAY CONCERN</strong></p>
            <p>Dear Sir/Madam,</p>
            ' . $purposeContent . '
            <p>This is to certify that <strong>' . htmlspecialchars($residence['passenger_name'] ?? 'N/A') . '</strong>, holder of <strong>' . htmlspecialchars($residence['nationality'] ?? 'N/A') . '</strong> passport, Passport No: <strong>' . htmlspecialchars($residence['passportNumber'] ?? 'N/A') . '</strong>, working as <strong>' . htmlspecialchars($residence['profession'] ?? 'N/A') . '</strong>, is a confirmed employee of <strong>' . htmlspecialchars($company['company_name'] ?? 'N/A') . '</strong>.</p>
            <p>We hereby confirm that we have no objection to the above-mentioned employee for the stated purpose. The employee is in good standing with our organization and is authorized to travel/proceed as required.</p>
            <p>Should you require any further information, please do not hesitate to contact us.</p>
            <p>Thank you for your attention to this matter.</p>
            <p style="margin-top: 8mm;"><strong>Yours faithfully,</strong></p>
            <p style="margin-top: 8mm;"><strong>For ' . htmlspecialchars($company['company_name'] ?? 'N/A') . '</strong></p>
            <p class="signature-stamp-label"><strong>Authorized Signatory</strong></p>
        ';
    } else {
        JWTHelper::sendResponse(400, false, 'Invalid type. Use "noc" or "salary_certificate"');
        exit;
    }

    // Return HTML content (frontend will render it)
    JWTHelper::sendResponse(200, true, 'Letter generated successfully', [
        'title' => $title,
        'content' => $content,
        'html' => getLetterHTML($title, $content, $company)
    ]);

} catch (PDOException $e) {
    error_log("Error generating letter: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'Failed to generate letter', null, $e->getMessage());
} catch (Exception $e) {
    error_log("Error in generate-letter.php: " . $e->getMessage());
    JWTHelper::sendResponse(500, false, 'An error occurred');
}

function getLetterHTML($title, $content, $company) {
    $letterheadStyle = '';
    if (!empty($company['letterhead'])) {
        // Get base URL from config
        $baseUrl = str_replace('/api', '', 'http://localhost/snt'); // Adjust as needed
        $letterheadStyle = "background-image: url('" . $baseUrl . "/letters/" . htmlspecialchars($company['letterhead']) . "');";
    }
    
    $signatureStampHtml = '';
    if (!empty($company['signature']) || !empty($company['stamp'])) {
        $baseUrl = str_replace('/api', '', 'http://localhost/snt');
        $signatureStampHtml = '<div class="signature-stamp">';
        if (!empty($company['signature'])) {
            $signatureStampHtml .= '<img src="' . $baseUrl . '/letters/' . htmlspecialchars($company['signature']) . '" class="signature" alt="Signature">';
        }
        if (!empty($company['stamp'])) {
            $signatureStampHtml .= '<img src="' . $baseUrl . '/letters/' . htmlspecialchars($company['stamp']) . '" class="stamp" alt="Stamp">';
        }
        $signatureStampHtml .= '</div>';
    }
    
    return '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . htmlspecialchars($title) . '</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700&display=swap" rel="stylesheet">
    <style type="text/css">
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #e0e0e0;
            font-family: "Noto Sans", Arial, sans-serif;
        }
        .container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px 0;
        }
        .letter {
            background: white;
            width: 210mm;
            height: 297mm;
            padding: 0;
            background-size: 100% auto;
            background-position: top left;
            background-repeat: no-repeat;
            position: relative;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
            margin: 0;
            box-sizing: border-box;
            overflow: hidden;
            ' . $letterheadStyle . '
        }
        .letter::before {
            content: "";
            display: block;
            width: 100%;
            height: 58mm;
        }
        .content {
            font-family: "Noto Sans", sans-serif;
            font-size: 10.5pt;
            color: #000;
            text-align: left;
            padding: 0 15mm 15mm 15mm;
        }
        .date {
            text-align: right;
            font-size: 9.5pt;
            margin-bottom: 5mm;
        }
        h1 {
            font-size: 14pt;
            font-weight: 700;
            text-align: center;
            margin: 0 0 6mm 0;
        }
        p {
            margin: 0 0 4mm 0;
            line-height: 1.25;
            font-size: 10.5pt;
        }
        .signature-stamp-label {
            margin: 6mm 0 3mm 0;
        }
        .signature-stamp {
            display: flex;
            justify-content: flex-start;
            align-items: flex-end;
            gap: 10mm;
            margin-top: 3mm;
        }
        .signature {
            width: 100px;
            height: auto;
            max-height: 70px;
            object-fit: contain;
        }
        .stamp {
            width: 150px;
            height: auto;
            max-height: 105px;
            object-fit: contain;
        }
        .print-btn {
            display: block;
            margin: 10px auto;
            padding: 12px 35px;
            font-size: 14pt;
            font-family: "Noto Sans", sans-serif;
            color: #fff;
            background-color: #28a745;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .print-btn:hover {
            background-color: #218838;
        }
        @media print {
            @page {
                size: A4 portrait;
                margin: 0mm;
            }
            html {
                margin: 0;
                padding: 0;
            }
            body {
                width: 210mm;
                height: 297mm;
                margin: 0 !important;
                padding: 0 !important;
                background-color: #fff;
            }
            .container {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                height: 297mm;
            }
            .letter {
                box-shadow: none;
                page-break-inside: avoid !important;
                page-break-after: avoid !important;
                page-break-before: avoid !important;
                break-inside: avoid !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 297mm;
                width: 210mm;
                box-sizing: border-box;
                background-size: 100% auto !important;
            }
            .content {
                padding: 0 15mm 15mm 15mm !important;
            }
            .print-btn {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <button class="print-btn" onclick="window.print()">Print ' . htmlspecialchars($title) . '</button>
        <div class="letter">
            <div class="content">
                ' . $content . '
                ' . $signatureStampHtml . '
            </div>
        </div>
    </div>
</body>
</html>';
}

