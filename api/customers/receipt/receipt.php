<?php
// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';


    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        header('location:../../../login.php');
    }
    class Receipt{
        // Intailzing connection inside class constructor
        public function __construct($conn){
            try {
                $this->conn = $conn;
                $sql = "SELECT permission.select,permission.update, permission.delete,permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Customer Payment'";
                $stmt = $conn->prepare($sql);
                $stmt->bindParam(':role_id', $_SESSION['role_id']);
                $stmt->execute();
                $records = $stmt->fetchAll(\PDO::FETCH_ASSOC);
                $this->select = $records[0]['select'];
                $this->insert = $records[0]['insert'];
                $this->update = $records[0]['update'];
                $this->delete = $records[0]['delete'];
                if($records[0]['select'] == 0 && $records[0]['insert'] == 0 && $records[0]['update'] == 0 && 
                $records[0]['delete'] == 0){
                    throw new \Exception('All Permissions for accounts are denied for the user ');
                }
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // Insert Receipt
        public function SaveReceipt($customerID, $invoiceNumber, $invoiceCurrency){
            try {
                if($this->insert == 0){
                    throw new \Exception('The user has no permission to store receipt');
                }
                // insert the receipt number into the database
                $InsertReceiptSql = "INSERT INTO `invoice`(`customerID`, `invoiceNumber`,`invoiceCurrency`) VALUES 
                (:customerID,:invoiceNumber,:invoiceCurrency)";
                // bind params
                $InsertReceiptStmt = $this->conn->prepare($InsertReceiptSql);
                $InsertReceiptStmt->bindParam(':customerID', $customerID);
                $InsertReceiptStmt->bindParam(':invoiceNumber', $invoiceNumber);
                $InsertReceiptStmt->bindParam(':invoiceCurrency', $invoiceCurrency);
                // execute
                $InsertReceiptStmt->execute();
                // get the auto-generated ID of the new row
                $new_id = $this->conn->lastInsertId();
                return $new_id;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // Insert Receipt Details
        public function SaveReceiptDetails($invoiceID, $transactionID, $transactionType){
            try {
                if($this->insert == 0){
                    throw new \Exception('The user has no permission to store receipt details');
                }
                // insert the receipt number into the database
                 $InvDetailSql = "INSERT INTO `invoicedetails`(`invoiceID`, `transactionID`, `transactionType`) VALUES 
                (:invoiceID,:transactionID,:transactionType)";
                $InvDetailStmt = $this->conn->prepare($InvDetailSql);
                $InvDetailStmt->bindParam(':invoiceID', $invoiceID);
                $InvDetailStmt->bindParam(':transactionID', $transactionID );
                $InvDetailStmt->bindParam(':transactionType', $transactionType);
                $InvDetailStmt->execute();
                return 'Success';
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // Insert Receipt File
        public function SaveReceiptFile($invoiceID, $fileName, $originalName){
            try {
                if($this->insert == 0){
                    throw new \Exception('The user has no permission to store receipt file');
                }
                // insert the receipt number into the database
                $sqlQuery = "UPDATE invoice SET  documentName = :documentName, orginalName = :orginalName WHERE
                invoiceID = :invoiceID";
                $Stmt = $this->conn->prepare($sqlQuery);
                $Stmt->bindParam(':documentName', $fileName);
                $Stmt->bindParam(':orginalName', $originalName );
                $Stmt->bindParam(':invoiceID', $invoiceID);
                $Stmt->execute();
                return 'Success';
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // Delete Payment Receipt 
        public function DeletePaymentReceipt($ReceiptID){
            try {
                if($this->delete == 0){
                    throw new \Exception('The user has no permission to delete receipt file');
                }
                // insert the receipt details with the given id
                $sqlQuery = "DELETE FROM `invoicedetails` WHERE invoiceID = :ReceiptID AND transactionType = 'Payment'";
                $Stmt = $this->conn->prepare($sqlQuery);
                $Stmt->bindParam(':ReceiptID', $ReceiptID);
                $Stmt->execute();
                // insert the receipt with the given id
                $sqlQuery = "DELETE FROM `invoice` WHERE invoiceID = :ReceiptID";
                $Stmt = $this->conn->prepare($sqlQuery);
                $Stmt->bindParam(':ReceiptID', $ReceiptID);
                $Stmt->execute();
                return 'Success';
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
         // Get document name of specific invoice  
         public function GetReceiptDocumentName($ReceiptID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select receipt file');
                }
                 // prepare the query 
                 $selectQuery = $this->conn->prepare("SELECT documentName FROM invoice WHERE invoiceID
                 = :invoiceID");
                 // bind Params 
                 $selectQuery->bindParam(':invoiceID', $ReceiptID);
                 // execute the query
                 $selectQuery->execute();
                 /* Fetch all rows in the result set */
                 $result = $selectQuery->fetch(\PDO::FETCH_ASSOC);
                 if ($result) {
                     return $result['documentName'];
                 } else {
                     return '';
                 }
            } catch (\Throwable $th) {
                return '';
            }
        }
        // Get document name of specific invoice  
        public function GetReceiptIDByPaymentID($paymentID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select receipt');
                }
                 // prepare the query 
                 $selectQuery = $this->conn->prepare("SELECT DISTINCT invoiceID FROM `invoicedetails` WHERE transactionID =
                :paymentID AND transactionType = 'Payment'");
                 // bind Params 
                 $selectQuery->bindParam(':paymentID', $paymentID);
                 // execute the query
                 $selectQuery->execute();
                 /* Fetch all rows in the result set */
               // check if the query returned a result
                if ($selectQuery->rowCount() > 0) {

                    
                    /* Fetch the first row in the result set */
                    $result = $selectQuery->fetch(\PDO::FETCH_ASSOC);
                    return $result['invoiceID'];
                } else {
                  
                    // handle the case where no rows were returned
                  
                    return null;
                }   
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
         // Delete Payment Receipt File
         public function DeletePaymentReceiptFile($ReceiptID){
            try {
                if($this->delete == 0){
                    throw new \Exception('The user has no permission to delete receipt file');
                }
                // insert the receipt with the given id
                $sqlQuery = "UPDATE  `invoice` SET documentName = NULL, orginalName = NULL WHERE invoiceID = :ReceiptID";
                $Stmt = $this->conn->prepare($sqlQuery);
                $Stmt->bindParam(':ReceiptID', $ReceiptID);
                $Stmt->execute();
                return 'Success';
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get the customer information of the given receipt 
        public function getPaymentReceiptCusInfo($receiptID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT invoiceNumber,invoiceCurrency,invoice.customerID,customer_name,
                DATE_FORMAT(DATE(invoiceDate),'%d-%b-%Y') AS invoiceDate, currencyName  FROM `invoice` INNER JOIN customer ON 
                customer.customer_id = invoice.customerID INNER JOIN currency ON currency.currencyID = invoice.invoiceCurrency
                WHERE invoiceID = :id");
                $selectQuery->bindParam(':id', $receiptID);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get the customer receipt details
        public function getCusPaymentReceiptDetails($receiptID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT * FROM (SELECT invoicedetails.transactionType AS transactionType, 
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS 
                serviceInfo,ticket.passenger_name AS PassengerName,DATE_FORMAT(DATE(ticket.datetime),'%d-%b-%Y') AS 
                formatedDate,ticket.datetime AS datetime, ticket.sale AS salePrice FROM invoicedetails INNER JOIN ticket ON 
                ticket.ticket = invoicedetails.transactionID INNER JOIN airports ON airports.airport_id=ticket.from_id INNER JOIN
                airports AS to_airports ON to_airports.airport_id=ticket.to_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Ticket'
                UNION ALL
                SELECT invoicedetails.transactionType AS transactionType,country_names AS serviceInfo,passenger_name AS 
                PassengerName,DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, visa.datetime AS datetime,visa.sale AS
                salePrice FROM visa INNER JOIN country_name ON country_name.country_id=visa.country_id INNER JOIN invoicedetails
                ON invoicedetails.transactionID = visa.visa_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Visa'
                UNION ALL
                SELECT  CASE WHEN visaextracharges.typeID = 1 THEN 'Visa Fine' WHEN visaextracharges.typeID = :id THEN 
                'Escape Report' WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' END AS transactionType,country_names AS 
                serviceInfo,visa.passenger_name AS PassengerName,DATE_FORMAT(DATE(visaextracharges.datetime),'%d-%b-%Y') AS 
                formatedDate,visaextracharges.datetime AS datetime,visaextracharges.salePrice AS salePrice FROM visaextracharges
                INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id INNER JOIN country_name ON country_name.country_id=
                visa.country_id INNER JOIN invoicedetails ON invoicedetails.transactionID = visaextracharges.visaExtraChargesID
                WHERE invoicedetails.invoiceID = :id AND invoicedetails.transactionType AND invoicedetails.transactionType 
                IN('Visa Fine','Escape Report','Escape Removal') 
                UNION ALL
                SELECT 'Residence' AS transactionType,country_names AS serviceInfo, passenger_name AS PassengerName,
                DATE_FORMAT(DATE(residence.datetime) ,'%d-%b-%Y') formatedDate, residence.datetime AS datetime, sale_price AS
                salePrice FROM residence INNER JOIN country_name ON country_name.country_id= residence.VisaType INNER JOIN 
                invoicedetails ON invoicedetails.transactionID = residence.residenceID WHERE invoicedetails.invoiceID = :id AND
                invoicedetails.transactionType = 'Residence'
                UNION ALL
                SELECT 'Residence Fine' AS transactionType,country_names AS serviceInfo,passenger_name AS PassengerName,
                DATE_FORMAT(DATE(residencefine.datetime) ,'%d-%b-%Y') AS formatedDate, residencefine.datetime AS datetime,
                residencefine.fineAmount AS salePrice FROM residencefine INNER JOIN residence ON residence.residenceID = 
                residencefine.residenceID INNER JOIN country_name ON country_name.country_id = residence.VisaType INNER JOIN 
                invoicedetails ON invoicedetails.transactionID = residencefine.residenceFineID WHERE invoicedetails.invoiceID =
                :id AND invoicedetails.transactionType = 'Residence Fine'
                UNION ALL
                SELECT serviceName AS transactionType, service_details AS serviceInfo,passenger_name AS  PassengerName,
                DATE_FORMAT(DATE(service_date),'%d-%b-%Y') AS formatedDate, service_date AS datetime, salePrice AS salePrice 
                FROM servicedetails INNER JOIN service ON service.serviceID= servicedetails.serviceID INNER JOIN invoicedetails
                ON invoicedetails.transactionID = servicedetails.serviceDetailsID WHERE invoicedetails.invoiceID = :id AND
                invoicedetails.transactionType = service.serviceName
                UNION ALL
                SELECT 'Payment' AS transactionType, CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN 'For Residence' 
                WHEN customer_payments.residenceFinePayment IS NOT NULL THEN 'For Residence Fine' ELSE customer_payments.remarks 
                END AS serviceInfo, CASE WHEN customer_payments.PaymentFor IS NOT NULL THEN (SELECT DISTINCT passenger_name FROM
                residence WHERE residence.residenceID = customer_payments.PaymentFor) WHEN customer_payments.residenceFinePayment
                IS NOT NULL THEN (SELECT DISTINCT passenger_name FROM residence INNER JOIN residencefine ON residence.residenceID
                = residencefine.residenceID WHERE residencefine.residenceFineID = customer_payments.residenceFinePayment)
                ELSE '' END AS PassengerName, DATE_FORMAT(DATE(customer_payments.datetime),'%d-%b-%Y') AS formatedDate, 
                customer_payments.datetime AS datetime, customer_payments.payment_amount AS salePrice FROM customer_payments 
                INNER JOIN invoicedetails ON invoicedetails.transactionID = customer_payments.pay_id WHERE
                invoicedetails.invoiceID = :id AND invoicedetails.transactionType = 'Payment' 
                UNION ALL 
                SELECT 'Hotel Reservation' AS transactionType,country_names AS serviceInfo,hotel.passenger_name AS PassengerName,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate,hotel.datetime AS datetime,sale_price AS salePrice FROM 
                hotel INNER JOIN country_name ON country_name.country_id = hotel.country_id INNER JOIN invoicedetails ON 
                invoicedetails.transactionID = hotel.hotel_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Hotel Reservation'
                UNION ALL
                SELECT 'Car Reservation' AS transactionType,CONCAT('Car Description: ',car_description) AS serviceInfo, 
                car_rental.passenger_name AS PassengerName, DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, 
                car_rental.datetime as datetime,sale_price AS salePrice FROM car_rental INNER JOIN invoicedetails ON 
                invoicedetails.transactionID = car_rental.car_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Car Reservation'
                UNION ALL
                SELECT 'Date Extension' AS transactionType,
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS 
                serviceInfo,passenger_name AS PassengerName,DATE_FORMAT(extended_Date,'%d-%b-%Y') AS formatedDate,
                datechange.datetime as datetime, datechange.sale_amount AS salePrice From datechange INNER JOIN ticket ON 
                ticket.ticket = datechange.ticket_id INNER JOIN airports ON airports.airport_id=ticket.from_id INNER JOIN 
                airports AS to_airports ON to_airports.airport_id=ticket.to_id INNER JOIN invoicedetails ON 
                invoicedetails.transactionID = datechange.change_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Date Extension' AND ticket.status = 1
                UNION ALL
                SELECT 'Loan' AS transactionType,remarks AS serviceInfo,'' AS PassengerName,
                DATE_FORMAT(DATE(datetime),'%d-%b-%Y') AS formatedDate, loan.datetime AS datetime,amount AS salePrice From loan 
                INNER JOIN invoicedetails ON invoicedetails.transactionID = loan.loan_id WHERE invoicedetails.invoiceID = :id 
                AND invoicedetails.transactionType = 'Loan'
                UNION ALL
                SELECT 'Refund' AS transactionType,
                CONCAT(CONCAT(CONCAT(CONCAT('From: ',airports.airport_code),' '),'To: ') , to_airports.airport_code) AS 
                serviceInfo,passenger_name AS PassengerName,DATE_FORMAT(extended_Date,'%d-%b-%Y') AS formatedDate,
                datechange.datetime as datetime, datechange.sale_amount AS salePrice From datechange INNER JOIN ticket ON 
                ticket.ticket = datechange.ticket_id INNER JOIN airports ON airports.airport_id=ticket.from_id INNER JOIN 
                airports AS to_airports ON to_airports.airport_id=ticket.to_id INNER JOIN invoicedetails ON 
                invoicedetails.transactionID = datechange.change_id WHERE invoicedetails.invoiceID = :id AND 
                invoicedetails.transactionType = 'Refund' AND ticket.status = 2) AS baseTable ORDER BY datetime ASC
                ");
                $selectQuery->bindParam(':id', $receiptID);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get statement information  by customer and currency for receipt report
        public function getStatmentInfoForReceiptByCusAndCur($customerID, $currencyID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT `customer_id`,referenceDate,referenceID FROM `statement` WHERE  
                customer_id = :id AND referenceCurrencyID = :CurID ORDER BY DATE(statement.Entrydate), statementID DESC LIMIT 1");
                $selectQuery->bindParam(':id', $customerID);
                $selectQuery->bindParam(':CurID', $currencyID);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get the customer all transactions
        public function getCustomerAllTransactions($customerID, $currencyID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT * FROM (SELECT ticket.ticket AS refID, 'Ticket' AS 
                TRANSACTION_Type,ticket.datetime AS datetime,DATE(ticket.datetime) AS nonFormatedDate, sale AS Debit, 0 AS Credit 
                FROM ticket WHERE ticket.customer_id = :id AND ticket.currencyID = :CurID 
                UNION ALL
                SELECT visa.visa_id AS refID,'Visa'  AS TRANSACTION_Type,visa.datetime AS datetime,DATE(visa.datetime) AS 
                nonFormatedDate, sale AS Debit, 0 AS Credit FROM visa WHERE visa.customer_id=:id AND visa.saleCurrencyID = :CurID 
                UNION ALL 
                SELECT visaextracharges.visaExtraChargesID AS refID, CASE WHEN visaextracharges.typeID = 1 THEN 'Visa Fine' WHEN
                visaextracharges.typeID = 2 THEN 'Escape Report' WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' END AS 
                TRANSACTION_Type,visaextracharges.datetime AS datetime,DATE(visaextracharges.datetime) AS nonFormatedDate,
                visaextracharges.salePrice AS Debit, 0 AS Credit FROM visaextracharges INNER JOIN visa ON visa.visa_id = 
                visaextracharges.visa_id WHERE visa.customer_id= :id AND visaextracharges.saleCurrencyID = :CurID
                UNION ALL
                SELECT residence.residenceID AS refID,'Residence' AS TRANSACTION_Type,residence.datetime AS datetime,
                DATE(residence.datetime) AS nonFormatedDate, sale_price AS Debit, 0 AS Credit FROM residence WHERE 
                residence.customer_id =:id AND residence.saleCurID = :CurID 
                UNION ALL
                SELECT residenceFineID AS refID, 'Residence Fine' AS transactionType,residencefine.datetime AS datetime,
                DATE(residencefine.datetime) AS nonFormatedDate, residencefine.fineAmount AS Debit, 0 AS Credit FROM
                residencefine INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE 
                residence.customer_id = :id AND fineCurrencyID = :CurID
                UNION ALL
                SELECT servicedetails.serviceDetailsID AS refID, serviceName AS TRANSACTION_Type,service_date AS datetime, 
                DATE(service_date) AS nonFormatedDate, salePrice AS Debit, 0 AS Credit FROM servicedetails INNER JOIN service ON 
                service.serviceID = servicedetails.serviceID WHERE servicedetails.customer_id=:id AND 
                servicedetails.saleCurrencyID = :CurID 
                UNION ALL
                SELECT customer_payments.pay_id AS refID, 'Payment' AS TRANSACTION_Type,customer_payments.datetime AS datetime,
                DATE(customer_payments.datetime) AS nonFormatedDate, 0 AS Debit, IFNULL(payment_amount,0) AS Credit from 
                customer_payments WHERE customer_payments.customer_id=:id AND customer_payments.currencyID = :CurID
                UNION ALL 
                SELECT hotel.hotel_id AS refID, 'Hotel Reservation' AS TRANSACTION_Type,hotel.datetime AS datetime,
                DATE(hotel.datetime) AS nonFormatedDate, sale_price AS Debit, 0 AS Credit from hotel WHERE hotel.customer_id=:id
                AND hotel.saleCurrencyID = :CurID
                UNION ALL 
                SELECT  car_rental.car_id AS refID,'Car Reservation' AS TRANSACTION_Type, car_rental.datetime as datetime,
                DATE(car_rental.datetime) AS nonFormatedDate,sale_price AS Debit, 0 AS Credit from car_rental WHERE 
                car_rental.customer_id=:id AND car_rental.saleCurrencyID = :CurID 
                UNION ALL 
                SELECT  datechange.change_id AS refID,'Date Extension' AS TRANSACTION_Type,datechange.datetime as datetime,
                DATE(datechange.datetime) AS nonFormatedDate,datechange.sale_amount AS Debit, 0 AS Credit From datechange 
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id=:id AND ticketStatus = 1 
                AND datechange.saleCurrencyID = :CurID
                UNION ALL 
                SELECT loan.loan_id AS refID, 'Loan' AS TRANSACTION_Type,loan.datetime AS datetime, DATE(loan.datetime) AS 
                nonFormatedDate,amount AS Debit, 0 AS Credit From loan WHERE loan.customer_id=:id AND loan.currencyID = :CurID
                UNION ALL 
                SELECT datechange.change_id AS refID, 'Refund' AS TRANSACTION_Type,datechange.datetime AS datetime,
                DATE(datechange.datetime) AS nonFormatedDate, 0 AS Debit,datechange.sale_amount AS Credit FROM datechange 
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id=:id AND ticketStatus = 2 
                AND datechange.saleCurrencyID = :CurID) baseTable ORDER BY datetime ASC");
                $selectQuery->bindParam(':id', $customerID);
                $selectQuery->bindParam(':CurID', $currencyID);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get statement information  by customer and currency for receipt report
        public function getStatmentInfoForReceiptByCusRefNdTrans($CustomerID, $refID,$TRANSACTION_Type){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT customer_id, referenceID, statementFor FROM statement WHERE 
                customer_id = :cusID AND referenceID = :refID AND statementFor = :stateFor");
                $selectQuery->bindParam(':cusID', $CustomerID);
                $selectQuery->bindParam(':refID', $refID);
                $selectQuery->bindParam(':stateFor', $TRANSACTION_Type);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetch(PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // Insert statment info
        public function SaveStatementInfo($customerID, $referenceID, $referenceDate,$statementFor,$referenceCurrencyID){
            try {
                if($this->insert == 0){
                    throw new \Exception('The user has no permission to store receipt');
                }
                // insert the receipt number into the database
                $insertQuery = "INSERT INTO `statement`(`customer_id`, `referenceID`, `referenceDate`, `statementFor`,
                `referenceCurrencyID`) VALUES (:customer_id, :referenceID,:referenceDate,:statementFor,
                :referenceCurrencyID)";
                // bind params
                $insertQueryStmt = $this->conn->prepare($insertQuery);
                $insertQueryStmt->bindParam(':customer_id', $customerID);
                $insertQueryStmt->bindParam(':referenceID', $referenceID);
                $insertQueryStmt->bindParam(':referenceDate', $referenceDate);
                $insertQueryStmt->bindParam(':statementFor',$statementFor);
                $insertQueryStmt->bindParam(':referenceCurrencyID', $referenceCurrencyID);
                // execute
                $insertQueryStmt->execute();
                return "Success";
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
         // get the customer all transactions
         public function getCusTransactionsDateCusCurWise($customerID,$currencyID,$fromDate){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select customer payment report');
                }
                // prepare the query 
                $selectQuery = $this->conn->prepare("SELECT * FROM (SELECT ticket.ticket AS refID, 'Ticket' AS TRANSACTION_Type,
                ticket.datetime AS datetime,DATE(ticket.datetime) AS nonFormatedDate, sale AS Debit, 0 AS Credit FROM ticket 
                WHERE ticket.customer_id=:id AND ticket.currencyID = :CurID AND DATE(ticket.datetime) BETWEEN :from_date AND 
                CURDATE()
                UNION ALL
                SELECT visa.visa_id AS refID,'Visa'  AS TRANSACTION_Type,visa.datetime AS datetime,DATE(visa.datetime) AS
                nonFormatedDate, sale AS Debit, 0 AS Credit FROM visa WHERE visa.customer_id=:id AND visa.saleCurrencyID = 
                :CurID AND DATE(visa.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL 
                SELECT visaextracharges.visaExtraChargesID AS refID, CASE WHEN visaextracharges.typeID = 1 THEN 'Visa Fine' WHEN
                visaextracharges.typeID = 2 THEN 'Escape Report' WHEN visaextracharges.typeID = 3 THEN 'Escape Removal' END AS 
                TRANSACTION_Type,visaextracharges.datetime AS datetime,DATE(visaextracharges.datetime) AS nonFormatedDate,
                visaextracharges.salePrice AS Debit, 0 AS Credit FROM visaextracharges INNER JOIN visa ON visa.visa_id = 
                visaextracharges.visa_id WHERE visa.customer_id= :id AND visaextracharges.saleCurrencyID = :CurID AND 
                DATE(visaextracharges.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT residence.residenceID AS refID,'Residence' AS TRANSACTION_Type,residence.datetime AS datetime,
                DATE(residence.datetime) AS nonFormatedDate, sale_price AS Debit, 0 AS Credit FROM residence WHERE 
                residence.customer_id=:id AND residence.saleCurID = :CurID AND DATE(residence.datetime) BETWEEN :from_date AND
                CURDATE() 
                UNION ALL
                SELECT residenceFineID AS refID, 'Residence Fine' AS transactionType,residencefine.datetime AS datetime,
                DATE(residencefine.datetime) AS nonFormatedDate, residencefine.fineAmount AS Debit, 0 AS Credit FROM 
                residencefine INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE 
                residence.customer_id = :id AND fineCurrencyID = :CurID AND DATE(residencefine.datetime) BETWEEN :from_date
                AND CURDATE() 
                UNION ALL
                SELECT servicedetails.serviceDetailsID AS refID, serviceName AS TRANSACTION_Type,service_date AS datetime,
                DATE(service_date) AS nonFormatedDate, salePrice AS Debit, 0 AS Credit FROM servicedetails INNER JOIN service 
                ON service.serviceID = servicedetails.serviceID WHERE servicedetails.customer_id=:id AND 
                servicedetails.saleCurrencyID = :CurID AND DATE(servicedetails.service_date) BETWEEN :from_date AND CURDATE()
                UNION ALL
                SELECT customer_payments.pay_id AS refID, 'Payment' AS TRANSACTION_Type,customer_payments.datetime AS datetime,
                DATE(customer_payments.datetime) AS nonFormatedDate, 0 AS Debit, IFNULL(payment_amount,0) AS Credit from 
                customer_payments WHERE customer_payments.customer_id=:id AND customer_payments.currencyID = :CurID AND 
                DATE(customer_payments.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL 
                SELECT hotel.hotel_id AS refID, 'Hotel Reservation' AS TRANSACTION_Type,hotel.datetime AS datetime, 
                DATE(hotel.datetime) AS nonFormatedDate ,sale_price AS Debit, 0 AS Credit from hotel WHERE hotel.customer_id=:id
                AND hotel.saleCurrencyID = :CurID AND DATE(hotel.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL 
                SELECT  car_rental.car_id AS refID,'Car Reservation' AS TRANSACTION_Type, car_rental.datetime as datetime,
                DATE(car_rental.datetime) AS nonFormatedDate, sale_price AS Debit, 0 AS Credit from car_rental WHERE 
                car_rental.customer_id=:id AND car_rental.saleCurrencyID = :CurID AND DATE(car_rental.datetime) BETWEEN 
                :from_date AND CURDATE() 
                UNION ALL 
                SELECT  datechange.change_id AS refID,'Date Extension' AS TRANSACTION_Type,datechange.datetime as datetime,
                DATE(datechange.datetime) AS nonFormatedDate, datechange.sale_amount AS Debit, 0 AS Credit From datechange 
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id=:id AND ticketStatus = 1 AND
                datechange.saleCurrencyID = :CurID AND DATE(datechange.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL 
                SELECT loan.loan_id AS refID, 'Loan' AS TRANSACTION_Type,loan.datetime AS datetime, DATE(loan.datetime) AS
                nonFormatedDate,amount AS Debit, 0 AS Credit From loan WHERE loan.customer_id=:id AND loan.currencyID = :CurID
                AND DATE(loan.datetime) BETWEEN :from_date AND CURDATE()
                UNION ALL 
                SELECT datechange.change_id AS refID, 'Refund' AS TRANSACTION_Type,datechange.datetime AS datetime,
                DATE(datechange.datetime) AS nonFormatedDate, 0 AS Debit,datechange.sale_amount AS Credit FROM datechange
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id=:id AND ticketStatus = 2 AND
                datechange.saleCurrencyID = :CurID AND DATE(datechange.datetime) BETWEEN :from_date AND CURDATE()) baseTable 
                ORDER BY datetime ASC ");
                $selectQuery->bindParam(':id', $customerID);
                $selectQuery->bindParam(':CurID', $currencyID);
                $selectQuery->bindParam(':from_date', $fromDate);
                // execute the query
                $selectQuery->execute();
                /* Fetch all rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the the result in json format
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
    }
?>