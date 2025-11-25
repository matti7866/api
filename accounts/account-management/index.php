<?php
    // Include CORS headers
    require_once __DIR__ . '/../../cors-headers.php';
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        header('location:../../../login.php');
    }
    class Account{
        // Intailzing connection inside class constructor
        public function __construct($conn){
            try {
                
                $this->conn = $conn;
                $sql = "SELECT permission.select,permission.update, permission.delete,permission.insert FROM `permission` WHERE role_id = :role_id AND page_name = 'Accounts'";
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
        // Get the search term from the q parameter that passess to the getAccountDropdownOptions function
        public function getAccountDropdownOptions($q){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select accounts');
                }
                /* Get the search term from the q parameter, converter it to lower case and append % at start and end of it for SQL 
                format */
                $q = '%' . strtolower($q) . '%';
                $selectQuery = $this->conn->prepare("SELECT account_ID, account_Name FROM `accounts` WHERE 
                LOWER(account_Name) LIKE :account_Name ORDER BY account_Name ASC ");
                $selectQuery->bindParam(':account_Name', $q);
                $selectQuery->execute();
                /* Fetch all of the remaining rows in the result set */
                $accounts = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // Convert the results to the format expected by the select2 function
                $result = array_map(function($account) {
                    return [
                        'id' => $account['account_ID'],
                        'name' => $account['account_Name']
                    ];
                }, $accounts);
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get Account Name by Account ID
        public function getAccountName($accountID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select accounts');
                }
                // prepare the statement
                $selectQuery = $this->conn->prepare("SELECT DISTINCT account_Name FROM `accounts` WHERE 
                account_ID = :account_ID ");
                // bind the param
                $selectQuery->bindParam(':account_ID', $accountID);
                // execute the query
                $selectQuery->execute();
                // Fetch account name
                $result = $selectQuery->fetch(\PDO::FETCH_ASSOC);
                // return the account name
                return $result['account_Name'];
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        // get Account currency By Account ID
        public function getAccCurrencyByAccID($accountID){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select accounts');
                }
                // prepare the statement
                $selectQuery = $this->conn->prepare("SELECT currency.currencyID, currency.currencyName FROM currency INNER JOIN
                accounts ON accounts.curID = currency.currencyID WHERE accounts.account_ID = :account_ID ");
                // bind the param
                $selectQuery->bindParam(':account_ID', $accountID);
                // execute the query
                $selectQuery->execute();
                /* Fetch all of the remaining rows in the result set */
                $result = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // return the account name
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
        
        // Get all accounts for dropdown (fallback when search doesn't work on server)
        public function getAllAccounts(){
            try {
                if($this->select == 0){
                    throw new \Exception('The user has no permission to select accounts');
                }
                $selectQuery = $this->conn->prepare("SELECT account_ID, account_Name FROM `accounts` ORDER BY account_Name ASC");
                $selectQuery->execute();
                /* Fetch all of the remaining rows in the result set */
                $accounts = $selectQuery->fetchAll(\PDO::FETCH_ASSOC);
                // Convert the results to the format expected by the select2 function
                $result = array_map(function($account) {
                    return [
                        'id' => $account['account_ID'],
                        'name' => $account['account_Name']
                    ];
                }, $accounts);
                return $result;
            } catch (\Throwable $th) {
                throw new \Exception($th->getMessage());
            }
        }
    
    }


?>