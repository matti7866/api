<?php
// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';


    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        header('location:../../../login.php');
    }
    class Currency{
        // Intailzing connection inside class constructor
        public function __construct($conn){
            try {
                $this->conn = $conn;
                $sql = "SELECT permission.select,permission.update, permission.delete,permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Currency'";
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
        // function to retrive customer ID and name for populating dropdown
        // Get the search term from the q parameter that passess to the getCurrencyDropdownOptions function
        public function getCurrencyDropdownOptions($q){
            if($this->select == 0){
                throw new \Exception('The user has no permission to select currencies');
            }
            try {
                /* Get the search term from the q parameter, converter it to lower case and append % at start and end of it for SQL 
                format */
                $q = '%' . strtolower($q) . '%';
                $selectQuery = $this->conn->prepare("SELECT currencyID, currencyName FROM `currency` WHERE 
                LOWER(currencyName) LIKE :currencyName ORDER BY currencyName ASC ");
                $selectQuery->bindParam(':currencyName', $q);
                $selectQuery->execute();
                /* Fetch all of the remaining rows in the result set */
                $currencies = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // Convert the results to the format expected by the select2 function
                $result = array_map(function($currency) {
                    return [
                        'id' => $currency['currencyID'],
                        'name' => $currency['currencyName']
                    ];
                }, $currencies);
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get Currency Name by currency ID
        public function getCurrencyName($currencyID){
            if($this->select == 0){
                throw new \Exception('The user has no permission to select currencies');
            }
            try {
                // prepare the statement
                $selectQuery = $this->conn->prepare("SELECT DISTINCT currencyName FROM `currency` WHERE 
                currencyID = :currencyID ");
                // bind the param
                $selectQuery->bindParam(':currencyID', $currencyID);
                // execute the query
                $selectQuery->execute();
                // Fetch account name
                $result = $selectQuery->fetch(\PDO::FETCH_ASSOC);
                // return the account name
                return $result['currencyName'];
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get list of currencies
        public function getCurrencies(){
            if($this->select == 0){
                throw new \Exception('The user has no permission to select currencies');
            }
            try {
                // prepare the statement
                $selectQuery = $this->conn->prepare("SELECT currencyID,currencyName FROM `currency` ORDER BY currencyName ASC ");
                // bind the param
                // execute the query
                $selectQuery->execute();
                // Fetch account name
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the account name
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
    }


?>