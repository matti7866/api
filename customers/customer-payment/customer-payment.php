<?php
// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';


ini_set('display_errors', 0);
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (!isset($_SESSION['user_id'])) {
    header('location:../../../login.php');
}
class CustomerPayment
{
    // Intailzing connection inside class constructor
    public function __construct($conn)
    {
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
            if (
                $records[0]['select'] == 0 && $records[0]['insert'] == 0 && $records[0]['update'] == 0 &&
                $records[0]['delete'] == 0
            ) {
                throw new \Exception('All Permissions for accounts are denied for the user ');
            }
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
    /* function to retrive customers payment datewise
           The function takes the date range
        */
    public function dateWise($fromdate, $todate)
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT `pay_id`, `datetime`, `customer_name`, `payment_amount`,
                IFNULL(remarks,'') As remarks, `currencyName`, `staff_name`,account_Name,CASE WHEN (SELECT 
                invoicedetails.invoiceDetailsID FROM invoicedetails WHERE invoicedetails.transactionID = pay_id AND 
                invoicedetails.transactionType = 'Payment') IS NOT NULL THEN (SELECT DISTINCT invoicedetails.invoiceID FROM
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment' ) ELSE 
                0 END AS invoiceDecision,CASE WHEN (SELECT invoicedetails.invoiceDetailsID FROM invoicedetails WHERE 
                invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment') IS NOT NULL THEN 
                IFNULL((SELECT DISTINCT documentName FROM invoice WHERE invoice.invoiceID = (SELECT invoicedetails.invoiceID FROM
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment')),'') 
                ELSE '' END AS invoiceFile  FROM `customer_payments` INNER JOIN customer ON customer.customer_id = 
                customer_payments.customer_id INNER JOIN staff ON staff.staff_id = customer_payments.staff_id INNER JOIN accounts
                ON accounts.account_ID = customer_payments.accountID INNER JOIN currency ON currency.currencyID = 
                customer_payments.currencyID WHERE DATE(datetime) BETWEEN :fromdate AND :todate ORDER BY pay_id DESC");
            // bind Params 
            $selectQuery->bindParam(':fromdate', $fromdate);
            $selectQuery->bindParam(':todate', $todate);
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
    /* function to retrive customers payment date and customer wise
           The function takes the date range and the customer id
        */
    public function dateAndCusWise($fromdate, $todate, $customerID)
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT `pay_id`, datetime, `customer_name`, `payment_amount`,
                IFNULL(remarks,'') As remarks,`currencyName`,`staff_name`,account_Name, CASE WHEN (SELECT 
                invoicedetails.invoiceDetailsID FROM invoicedetails WHERE invoicedetails.transactionID = pay_id AND 
                invoicedetails.transactionType = 'Payment') IS NOT NULL THEN (SELECT DISTINCT invoicedetails.invoiceID FROM 
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment' ) ELSE 
                0 END AS invoiceDecision,CASE WHEN (SELECT invoicedetails.invoiceDetailsID FROM invoicedetails WHERE 
                invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment') IS NOT NULL THEN 
                IFNULL((SELECT DISTINCT documentName FROM invoice WHERE invoice.invoiceID = (SELECT invoicedetails.invoiceID FROM
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment')),'') 
                ELSE '' END AS invoiceFile  FROM `customer_payments` INNER JOIN customer ON customer.customer_id = 
                customer_payments.customer_id INNER JOIN staff ON staff.staff_id = customer_payments.staff_id INNER JOIN accounts
                ON accounts.account_ID = customer_payments.accountID INNER JOIN currency ON currency.currencyID = 
                customer_payments.currencyID WHERE DATE(datetime) BETWEEN :fromdate AND :todate AND customer_payments.customer_id
                = :customer_id ORDER BY pay_id DESC");
            // bind Params 
            $selectQuery->bindParam(':fromdate', $fromdate);
            $selectQuery->bindParam(':todate', $todate);
            $selectQuery->bindParam(':customer_id', $customerID);
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
    /* function to retrive customers payment customer wise
           The function takes customer id
        */
    public function CusWise($customerID)
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT `pay_id`, `datetime`, `customer_name`, `payment_amount`, 
                IFNULL(remarks,'') As remarks, `currencyName`,`staff_name`,account_Name, CASE WHEN (SELECT 
                invoicedetails.invoiceDetailsID FROM invoicedetails WHERE invoicedetails.transactionID = pay_id AND 
                invoicedetails.transactionType = 'Payment') IS NOT NULL THEN (SELECT DISTINCT invoicedetails.invoiceID FROM 
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment' ) ELSE
                0 END AS invoiceDecision,CASE WHEN (SELECT invoicedetails.invoiceDetailsID FROM invoicedetails WHERE 
                invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment') IS NOT NULL THEN 
                IFNULL((SELECT DISTINCT documentName FROM invoice WHERE invoice.invoiceID = (SELECT invoicedetails.invoiceID FROM
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment')),'') 
                ELSE '' END AS invoiceFile  FROM `customer_payments` INNER JOIN customer ON customer.customer_id = 
                customer_payments.customer_id INNER JOIN staff ON staff.staff_id = customer_payments.staff_id INNER JOIN accounts
                ON accounts.account_ID = customer_payments.accountID INNER JOIN currency ON currency.currencyID = 
                customer_payments.currencyID WHERE customer_payments.customer_id = :customer_id ORDER BY pay_id DESC ");
            // bind Params 
            $selectQuery->bindParam(':customer_id', $customerID);
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
    // function to retrive today's customers payments
    public function TodaysPayment()
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT `pay_id`, `datetime`, `customer_name`, `payment_amount`, 
                IFNULL(remarks,'') As remarks, `currencyName`, `staff_name`,account_Name, CASE WHEN (SELECT 
                invoicedetails.invoiceDetailsID FROM invoicedetails WHERE invoicedetails.transactionID = pay_id AND 
                invoicedetails.transactionType = 'Payment') IS NOT NULL THEN (SELECT DISTINCT invoicedetails.invoiceID FROM 
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment' ) ELSE
                0 END AS invoiceDecision,CASE WHEN (SELECT invoicedetails.invoiceDetailsID FROM invoicedetails WHERE 
                invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment') IS NOT NULL THEN 
                IFNULL((SELECT DISTINCT documentName FROM invoice WHERE invoice.invoiceID = (SELECT invoicedetails.invoiceID FROM
                invoicedetails WHERE invoicedetails.transactionID = pay_id AND invoicedetails.transactionType = 'Payment')),'') 
                ELSE '' END AS invoiceFile  FROM `customer_payments` INNER JOIN customer ON customer.customer_id = 
                customer_payments.customer_id INNER JOIN staff ON staff.staff_id = customer_payments.staff_id INNER JOIN accounts
                ON accounts.account_ID = customer_payments.accountID INNER JOIN currency ON currency.currencyID = 
                customer_payments.currencyID WHERE DATE(datetime) = CURRENT_DATE() ORDER BY pay_id DESC ");
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
    /* function to retrive the given customer pending payment 
           The function takes customer id
        */
    public function GetCustomerPendingPayment($customerID)
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT curID,(SELECT currencyName FROM currency WHERE currency.currencyID = 
                curID) AS curName, (SELECT IFNULL(SUM(ticket.sale),0) FROM ticket WHERE ticket.customer_id = :customer_id AND 
                ticket.currencyID = curID) + (SELECT IFNULL(SUM(visa.sale),0) FROM visa WHERE visa.customer_id = :customer_id AND
                visa.saleCurrencyID = curID) + (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON 
                ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 1 AND 
                datechange.saleCurrencyID = curID) + (SELECT IFNULL(SUM(hotel.sale_price),0) FROM hotel WHERE hotel.customer_id = 
                :customer_id AND hotel.saleCurrencyID = curID) + (SELECT IFNULL(SUM(visaextracharges.salePrice),0) FROM 
                visaextracharges INNER JOIN visa ON visa.visa_id = visaextracharges.visa_id WHERE visa.customer_id = :customer_id
                AND visaextracharges.saleCurrencyID = curID) + (SELECT IFNULL(SUM(residence.sale_price),0) FROM residence WHERE 
                residence.customer_id = :customer_id AND residence.saleCurID =curID)+ (SELECT 
                IFNULL(SUM(servicedetails.salePrice),0) FROM servicedetails WHERE servicedetails.customer_id = :customer_id AND
                servicedetails.saleCurrencyID = curID)+ (SELECT IFNULL(SUM(car_rental.sale_price),0) FROM car_rental WHERE 
                car_rental.customer_id = :customer_id AND car_rental.saleCurrencyID = curID) + (SELECT IFNULL(SUM(loan.amount),0)
                FROM loan WHERE loan.customer_id = :customer_id AND loan.currencyID = curID) + (SELECT 
                IFNULL(SUM(residencefine.fineAmount),0) FROM residencefine INNER JOIN residence ON residence.residenceID = 
                residencefine.residenceID WHERE residence.customer_id = :customer_id AND residencefine.fineCurrencyID = curID) - 
                (SELECT IFNULL(SUM(datechange.sale_amount),0) FROM datechange INNER JOIN ticket ON ticket.ticket = 
                datechange.ticket_id WHERE ticket.customer_id = :customer_id AND datechange.ticketStatus = 2 AND 
                datechange.saleCurrencyID = curID) - (SELECT IFNULL(SUM(customer_payments.payment_amount),0) FROM 
                customer_payments WHERE customer_payments.customer_id = :customer_id AND customer_payments.currencyID = curID)
                AS total FROM (SELECT ticket.currencyID AS curID FROM ticket  WHERE ticket.customer_id = :customer_id UNION SELECT
                visa.saleCurrencyID AS curID FROM visa WHERE visa.customer_id = :customer_id UNION SELECT 
                visaextracharges.saleCurrencyID AS curID FROM visaextracharges INNER JOIN visa ON visa.visa_id = 
                visaextracharges.visa_id WHERE visa.customer_id = :customer_id UNION SELECT residence.saleCurID AS curID FROM 
                residence WHERE residence.customer_id = :customer_id UNION SELECT residencefine.fineCurrencyID AS curID FROM 
                residencefine INNER JOIN residence ON residence.residenceID = residencefine.residenceID WHERE 
                residence.customer_id = :customer_id UNION SELECT servicedetails.saleCurrencyID AS curID FROM servicedetails WHERE
                servicedetails.customer_id = :customer_id UNION SELECT datechange.saleCurrencyID AS curID FROM datechange 
                INNER JOIN ticket ON ticket.ticket = datechange.ticket_id WHERE ticket.customer_id = :customer_id UNION SELECT 
                loan.currencyID AS curID FROM loan WHERE loan.customer_id = :customer_id UNION SELECT hotel.saleCurrencyID AS 
                curID FROM hotel WHERE hotel.customer_id = :customer_id UNION SELECT car_rental.saleCurrencyID AS curID FROM 
                car_rental WHERE car_rental.customer_id = :customer_id UNION SELECT customer_payments.currencyID AS curID FROM 
                customer_payments WHERE customer_payments.customer_id = :customer_id) AS baseTable HAVING total != 0 ORDER BY 
                curName ASC  ");
            // bind Params 
            $selectQuery->bindParam(':customer_id', $customerID);
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
    // Insert Payment
    public function MakePayment($customerID, $paymentAmount, $accountID, $currencyID, $remarks)
    {
        try {
            if ($this->insert == 0) {
                throw new \Exception('The user has no permission to insert customer payment report');
            }
            // create prepared statement
            $sql = "INSERT INTO `customer_payments`(`customer_id`, `payment_amount`,`currencyID`,
                `staff_id`,remarks,accountID) VALUES (:customer_id, :payment_amount,:currencyID,:staff_id,:remarks,:accountID)";
            $stmt = $this->conn->prepare($sql);
            // bind parameters to statement
            $stmt->bindParam(':customer_id', $customerID);
            $stmt->bindParam(':payment_amount', $paymentAmount);
            $stmt->bindParam(':currencyID', $currencyID);
            $stmt->bindParam(':staff_id', $_SESSION['user_id']);
            $stmt->bindParam(':remarks', $remarks);
            $stmt->bindParam(':accountID',  $accountID);
            // execute the prepared statement
            $stmt->execute();
            return "Success";
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
    // edit customer payment
    public function EditCustomerPayment($paymentID)
    {
        try {
            if ($this->update == 0) {
                throw new \Exception('The user has no permission to update customer payment report');
            }
            $selectQuery = $this->conn->prepare("SELECT pay_id, customer.customer_id,customer.customer_name, payment_amount, 
                accounts.account_ID, accounts.account_Name, currency.currencyID, currency.currencyName, remarks FROM 
                `customer_payments` INNER JOIN customer ON customer.customer_id = customer_payments.customer_id INNER JOIN
                accounts ON accounts.account_ID = customer_payments.accountID INNER JOIN currency ON currency.currencyID = 
                customer_payments.currencyID WHERE pay_id = :pay_id");
            $selectQuery->bindParam(':pay_id', $paymentID);
            $selectQuery->execute();
            /* Fetch all of the remaining rows in the result set */
            $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
            // encoding array to json format
            return $result;
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
    // delete customer payment
    public function DeletePayment($paymentID)
    {
        try {
            if ($this->delete == 0) {
                throw new \Exception('The user has no permission to delete customer payment report');
            }
            // create prepared statement
            $sql = "DELETE FROM customer_payments WHERE pay_id = :pay_id";
            $stmt = $this->conn->prepare($sql);
            // bind parameters to statement
            $stmt->bindParam(':pay_id', $paymentID);
            // execute the prepared statement
            $stmt->execute();
            return "Success";
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
    // update Payment
    public function UpdatePayment($paymentID, $customerID, $paymentAmount, $accountID, $currencyID, $remarks)
    {
        try {
            if ($this->update == 0) {
                throw new \Exception('The user has no permission to update customer payment report');
            }
            // create prepared statement
            $sql = "UPDATE `customer_payments` SET `customer_id`= :customer_id,`payment_amount`= :payment_amount,
                `currencyID`=:currencyID,`staff_id`= :staff_id,`remarks`=:remarks,`accountID`=:accountID WHERE pay_id = :pay_id";
            $stmt = $this->conn->prepare($sql);
            // bind parameters to statement
            $stmt->bindParam(':customer_id', $customerID);
            $stmt->bindParam(':payment_amount', $paymentAmount);
            $stmt->bindParam(':currencyID', $currencyID);
            $stmt->bindParam(':staff_id', $_SESSION['user_id']);
            $stmt->bindParam(':remarks', $remarks);
            $stmt->bindParam(':accountID',  $accountID);
            $stmt->bindParam(':pay_id',  $paymentID);
            // execute the prepared statement
            $stmt->execute();
            return "Success";
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
    // function to retrive today's customers payments
    public function getcustomerAndCurrencyForReceipt($paymentID)
    {
        try {
            if ($this->select == 0) {
                throw new \Exception('The user has no permission to select customer payment report');
            }
            // prepare the query 
            $selectQuery = $this->conn->prepare("SELECT customer_id,currencyID FROM customer_payments WHERE pay_id = :pay_id ");
            // bind the param
            $selectQuery->bindParam(':pay_id', $paymentID);
            // execute the query
            $selectQuery->execute();
            /* Fetch all rows in the result set */
            $result = $selectQuery->fetch(\PDO::FETCH_ASSOC);
            // return the the result in json format
            return $result;
        } catch (\Throwable $th) {
            throw new \Exception($th->getMessage());
        }
    }
}
