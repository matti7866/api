<?php
/**
 * Wallet Helper Functions
 * Handles wallet account number generation and other utilities
 */

class WalletHelper {
    
    /**
     * Generate unique wallet account number for customer
     * Format: WAL-XXXXXX (e.g., WAL-000001)
     */
    public static function generateWalletAccountNumber($pdo, $customerID) {
        // NOTE: This function should be called within an existing transaction
        // Do NOT start a new transaction here
        
        try {
            // Get and increment sequence
            $stmt = $pdo->prepare("
                UPDATE wallet_account_sequence 
                SET last_number = last_number + 1 
                WHERE id = 1
            ");
            $stmt->execute();
            
            // Get the new number
            $stmt = $pdo->prepare("
                SELECT last_number, prefix 
                FROM wallet_account_sequence 
                WHERE id = 1
            ");
            $stmt->execute();
            $sequence = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$sequence) {
                throw new Exception('Wallet sequence not initialized');
            }
            
            $number = $sequence['last_number'];
            $prefix = $sequence['prefix'];
            
            // Format: WAL-000001
            $walletAccountNumber = $prefix . '-' . str_pad($number, 6, '0', STR_PAD_LEFT);
            
            // Update customer with wallet account number
            $stmt = $pdo->prepare("
                UPDATE customer 
                SET wallet_account_number = :walletAccountNumber 
                WHERE customer_id = :customerID
            ");
            $stmt->bindParam(':walletAccountNumber', $walletAccountNumber);
            $stmt->bindParam(':customerID', $customerID);
            $stmt->execute();
            
            return $walletAccountNumber;
            
        } catch (Exception $e) {
            throw $e;
        }
    }
    
    /**
     * Get or create wallet account number for customer
     */
    public static function getOrCreateWalletAccountNumber($pdo, $customerID) {
        // Check if customer already has wallet account number
        $stmt = $pdo->prepare("
            SELECT wallet_account_number 
            FROM customer 
            WHERE customer_id = :customerID
        ");
        $stmt->bindParam(':customerID', $customerID);
        $stmt->execute();
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($customer && !empty($customer['wallet_account_number'])) {
            return $customer['wallet_account_number'];
        }
        
        // Generate new wallet account number
        return self::generateWalletAccountNumber($pdo, $customerID);
    }
    
    /**
     * Record account transaction for wallet deposit/withdrawal
     * This creates a corresponding entry in the accounts system
     */
    public static function recordAccountTransaction($pdo, $data) {
        // This will link the wallet transaction with the company account system
        // For now, we'll just store the account_id with the transaction
        // Future enhancement: Create actual account ledger entries
        
        // The account_id is already stored in customer_wallet_transactions
        // Additional accounting entries can be added here as needed
        
        return true;
    }
}

