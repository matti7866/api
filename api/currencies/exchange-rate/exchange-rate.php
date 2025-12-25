<?php
// Include CORS headers
require_once __DIR__ . '/../../cors-headers.php';


    class ExchangeRate{
        // Intailzing connection inside class constructor
        public function __construct($conn){
            try {
                $this->conn = $conn;
            } catch (\Throwable $th) {
                http_response_code(500);
                echo $h->getMessage();
            }
        }
        // Insert Exchange Rate
        public function InsertExchangeRate($currencyID, $exchange_rate,$datetime){
            try {
                // create prepared statement
                $sql = "INSERT INTO `exchange_rate`(`currencyID`, `exchange_rate`, `datetime`) VALUES
                 (:currencyID, :exchange_rate,:datetime)";
                $stmt = $this->conn->prepare($sql);
                // bind parameters to statement
                $stmt->bindParam(':currencyID', $currencyID);
                $stmt->bindParam(':exchange_rate', $exchange_rate);
                $stmt->bindParam(':datetime', $datetime);
                // execute the prepared statement
                $stmt->execute(); 
            } catch (\Throwable $th) {
                echo $th->getMessage();
            }
        }
        
    }


?>