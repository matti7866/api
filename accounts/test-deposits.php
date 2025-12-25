<?php
// Simple test file to check if deposits API is working
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Test Deposits API</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .success { color: green; }
        .error { color: red; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Test Deposits API</h1>
    
    <h2>1. Test Connection</h2>
    <?php
    try {
        require_once __DIR__ . '/../../connection.php';
        echo "<p class='success'>✓ Database connection successful</p>";
    } catch (Exception $e) {
        echo "<p class='error'>✗ Database connection failed: " . $e->getMessage() . "</p>";
        exit;
    }
    ?>
    
    <h2>2. Test Database Schema</h2>
    <?php
    try {
        $stmt = $pdo->query("DESCRIBE deposits");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "<p class='success'>✓ Deposits table exists</p>";
        echo "<pre>";
        print_r($columns);
        echo "</pre>";
    } catch (Exception $e) {
        echo "<p class='error'>✗ Error: " . $e->getMessage() . "</p>";
    }
    ?>
    
    <h2>3. Test Sample Query</h2>
    <?php
    try {
        $stmt = $pdo->prepare("SELECT d.deposit_ID, d.deposit_amount, d.currencyID, d.datetime, 
            d.depositBy, d.accountID, d.remarks, 
            c.currencyName, a.account_Name as accountName, s.staff_name as depositByName
            FROM deposits d 
            INNER JOIN currency c ON c.currencyID = d.currencyID
            INNER JOIN accounts a ON a.account_ID = d.accountID
            LEFT JOIN staff s ON s.staff_id = d.depositBy
            ORDER BY d.datetime DESC
            LIMIT 5");
        $stmt->execute();
        $deposits = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "<p class='success'>✓ Query successful - Found " . count($deposits) . " deposits</p>";
        echo "<pre>";
        print_r($deposits);
        echo "</pre>";
    } catch (Exception $e) {
        echo "<p class='error'>✗ Query error: " . $e->getMessage() . "</p>";
    }
    ?>
    
    <h2>4. Test JWT Helper</h2>
    <?php
    try {
        require_once __DIR__ . '/../auth/JWTHelper.php';
        echo "<p class='success'>✓ JWTHelper loaded successfully</p>";
    } catch (Exception $e) {
        echo "<p class='error'>✗ JWTHelper error: " . $e->getMessage() . "</p>";
    }
    ?>
    
    <h2>5. Test API Endpoint</h2>
    <p>Try calling the API with JavaScript:</p>
    <button onclick="testAPI()">Test API Call</button>
    <div id="api-result"></div>
    
    <script>
    async function testAPI() {
        const resultDiv = document.getElementById('api-result');
        resultDiv.innerHTML = '<p>Testing...</p>';
        
        try {
            const response = await fetch('/api/accounts/deposits.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'getDeposits'
                })
            });
            
            const data = await response.json();
            resultDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        } catch (error) {
            resultDiv.innerHTML = '<p class="error">Error: ' + error.message + '</p>';
        }
    }
    </script>
</body>
</html>

