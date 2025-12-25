<?php
/**
 * Helper function to get comprehensive account statement data
 * SYNCHRONIZED WITH statement.php - ALL QUERIES MUST MATCH
 */

function getComprehensiveAccountStatement($pdo, $accountId, $fromDate, $toDate) {
    $credits = [];
    $debits = [];
    
    // ============== GET ALL CREDITS ==============
    
    // 1. Customer Payments (Regular)
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Customer Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(cp.remarks, 'General payment')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND (cp.is_tawjeeh_payment IS NULL OR cp.is_tawjeeh_payment = 0)
                        AND (cp.is_insurance_payment IS NULL OR cp.is_insurance_payment = 0)
                        AND (cp.is_insurance_fine_payment IS NULL OR cp.is_insurance_fine_payment = 0)
                        AND (cp.residenceFinePayment IS NULL OR cp.residenceFinePayment = 0)
                        AND (cp.residenceCancelPayment IS NULL OR cp.residenceCancelPayment = 0)
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 2. Tawjeeh Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Tawjeeh Payment' as transaction_type,
                            cp.tawjeeh_payment_amount as amount,
                            CONCAT('Tawjeeh payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_tawjeeh_payment = 1 
                        AND cp.tawjeeh_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 3. Insurance Payments (ILOE)
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Insurance Payment (ILOE)' as transaction_type,
                            cp.insurance_payment_amount as amount,
                            CONCAT('Insurance payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_insurance_payment = 1 
                        AND cp.insurance_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 4. Insurance Fine Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Insurance Fine Payment' as transaction_type,
                            cp.insurance_fine_payment_amount as amount,
                            CONCAT('Insurance fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.PaymentFor, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.is_insurance_fine_payment = 1 
                        AND cp.insurance_fine_payment_amount > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 5. Residence Fine Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Residence Fine Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Residence fine payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Fine ID: ', IFNULL(cp.residenceFinePayment, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.residenceFinePayment IS NOT NULL 
                        AND cp.residenceFinePayment > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 6. Residence Cancellation Payments
    $stmt = $pdo->prepare("SELECT 
                            cp.datetime as date,
                            'Residence Cancellation Payment' as transaction_type,
                            cp.payment_amount as amount,
                            CONCAT('Residence cancellation payment from ', COALESCE(c.customer_name, 'Unknown Customer'), ' for Residence ID: ', IFNULL(cp.residenceCancelPayment, 'N/A')) as description
                        FROM customer_payments cp
                        LEFT JOIN customer c ON cp.customer_id = c.customer_id
                        WHERE cp.accountID = :accountId 
                        AND cp.accountID != 25
                        AND cp.residenceCancelPayment IS NOT NULL 
                        AND cp.residenceCancelPayment > 0
                        AND DATE(cp.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cp.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 7. Deposits
    $stmt = $pdo->prepare("SELECT 
                            d.datetime as date,
                            'Deposit' as transaction_type,
                            d.deposit_amount as amount,
                            CONCAT('Deposit - ', IFNULL(d.remarks, 'No remarks')) as description
                        FROM deposits d
                        WHERE d.accountID = :accountId 
                        AND d.accountID != 25
                        AND DATE(d.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY d.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 8. Transfer In
    $stmt = $pdo->prepare("SELECT 
                            t.datetime as date,
                            'Transfer In' as transaction_type,
                            t.amount as amount,
                            CONCAT('Transfer from Account ', t.from_account, ' - ', IFNULL(t.remarks, 'Transfer')) as description
                        FROM transfers t
                        WHERE t.to_account = :accountId 
                        AND DATE(t.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY t.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 9. Refunds
    $stmt = $pdo->prepare("SELECT 
                            r.datetime_created as date,
                            'Refund' as transaction_type,
                            r.amount as amount,
                            CONCAT('Refund - ', IFNULL(r.refund_type, 'No reason provided')) as description
                        FROM refunds r
                        WHERE r.account_id = :accountId 
                        AND DATE(r.datetime_created) BETWEEN :fromDate AND :toDate
                        ORDER BY r.datetime_created ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 10. Receivable Cheques
    $stmt = $pdo->prepare("SELECT 
                            c.date as date,
                            'Receivable Cheque' as transaction_type,
                            c.amount as amount,
                            CONCAT('Cheque from ', IFNULL(c.payee, 'Unknown'), ' - ', IFNULL(c.number, 'No number')) as description
                        FROM cheques c
                        WHERE c.account_id = :accountId 
                        AND c.type = 'receivable'
                        AND DATE(c.date) BETWEEN :fromDate AND :toDate
                        ORDER BY c.date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 11. Wallet Deposits/Refunds (Customer deposits to wallet = money IN to company)
    $stmt = $pdo->prepare("SELECT 
                            cwt.datetime as date,
                            CONCAT('Wallet ', CASE WHEN cwt.transaction_type = 'refund' THEN 'Refund' ELSE 'Deposit' END) as transaction_type,
                            cwt.amount as amount,
                            CONCAT('Wallet ', CASE WHEN cwt.transaction_type = 'refund' THEN 'Refund' ELSE 'Deposit' END, ' - ', COALESCE(c.customer_name, 'Unknown Customer'), ' (', IFNULL(c.wallet_account_number, 'N/A'), ')', IFNULL(CONCAT(' - ', cwt.remarks), '')) as description
                        FROM customer_wallet_transactions cwt
                        LEFT JOIN customer c ON cwt.customer_id = c.customer_id
                        WHERE cwt.account_id = :accountId 
                        AND cwt.account_id IS NOT NULL
                        AND cwt.transaction_type IN ('deposit', 'refund')
                        AND DATE(cwt.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cwt.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $credits = array_merge($credits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // ============== GET ALL DEBITS ==============
    
    // 1. Expenses
    $stmt = $pdo->prepare("SELECT 
                            e.time_creation as date,
                            'Expense' as transaction_type,
                            e.expense_amount as amount,
                            CONCAT('Expense: ', COALESCE(et.expense_type, 'Unknown Type'), ' - ', COALESCE(e.expense_remark, 'No remarks')) as description
                        FROM expense e
                        LEFT JOIN expense_type et ON e.expense_type_id = et.expense_type_id
                        WHERE e.accountID = :accountId 
                        AND e.accountID != 25
                        AND DATE(e.time_creation) BETWEEN :fromDate AND :toDate
                        ORDER BY e.time_creation ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 1b. Wallet Withdrawals (Customer withdraws from wallet = money OUT from company)
    $stmt = $pdo->prepare("SELECT 
                            cwt.datetime as date,
                            'Wallet Withdrawal' as transaction_type,
                            cwt.amount as amount,
                            CONCAT('Wallet Withdrawal - ', COALESCE(c.customer_name, 'Unknown Customer'), ' (', IFNULL(c.wallet_account_number, 'N/A'), ')', IFNULL(CONCAT(' - ', cwt.remarks), '')) as description
                        FROM customer_wallet_transactions cwt
                        LEFT JOIN customer c ON cwt.customer_id = c.customer_id
                        WHERE cwt.account_id = :accountId 
                        AND cwt.account_id IS NOT NULL
                        AND cwt.transaction_type = 'withdrawal'
                        AND DATE(cwt.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY cwt.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 2. Withdrawals
    $stmt = $pdo->prepare("SELECT 
                            w.datetime as date,
                            'Withdrawal' as transaction_type,
                            w.withdrawal_amount as amount,
                            CONCAT('Withdrawal - ', IFNULL(w.remarks, 'No remarks')) as description
                        FROM withdrawals w
                        WHERE w.accountID = :accountId 
                        AND w.accountID != 25
                        AND DATE(w.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY w.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 3. Transfer Out
    $stmt = $pdo->prepare("SELECT 
                            t.datetime as date,
                            'Transfer Out' as transaction_type,
                            t.amount as amount,
                            CONCAT('Transfer to Account ', t.to_account, ' - ', IFNULL(t.remarks, 'Transfer')) as description
                        FROM transfers t
                        WHERE t.from_account = :accountId 
                        AND DATE(t.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY t.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 4. Supplier Payments
    $stmt = $pdo->prepare("SELECT 
                            p.time_creation as date,
                            'Supplier Payment' as transaction_type,
                            p.payment_amount as amount,
                            CONCAT('Payment to ', COALESCE(s.supp_name, 'Unknown Supplier'), ' - ', IFNULL(p.payment_detail, 'No remarks')) as description
                        FROM payment p
                        LEFT JOIN supplier s ON p.supp_id = s.supp_id
                        WHERE p.accountID = :accountId 
                        AND p.accountID != 25
                        AND DATE(p.time_creation) BETWEEN :fromDate AND :toDate
                        ORDER BY p.time_creation ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 5. Loans
    $stmt = $pdo->prepare("SELECT 
                            l.datetime as date,
                            'Loan' as transaction_type,
                            l.amount as amount,
                            CONCAT('Loan to ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(l.remarks, 'No remarks')) as description
                        FROM loan l
                        LEFT JOIN customer c ON l.customer_id = c.customer_id
                        WHERE l.accountID = :accountId 
                        AND l.accountID != 25
                        AND DATE(l.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY l.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 6. Salaries
    $stmt = $pdo->prepare("SELECT 
                            sal.datetime as date,
                            'Salary Payment' as transaction_type,
                            sal.salary_amount as amount,
                            CONCAT('Salary to ', COALESCE(s.staff_name, 'Unknown Staff'), ' - Account: ', sal.paymentType) as description
                        FROM salaries sal
                        LEFT JOIN staff s ON sal.employee_id = s.staff_id
                        WHERE sal.paymentType = :accountId 
                        AND sal.paymentType != 25
                        AND DATE(sal.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY sal.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 7. Payable Cheques
    $stmt = $pdo->prepare("SELECT 
                            c.paid_date as date,
                            'Payable Cheque' as transaction_type,
                            c.amount as amount,
                            CONCAT('Cheque to ', IFNULL(c.payee, 'Unknown'), ' - ', IFNULL(c.number, 'No number')) as description
                        FROM cheques c
                        WHERE c.account_id = :accountId 
                        AND c.type = 'payable'
                        AND c.paid_date IS NOT NULL
                        AND DATE(c.paid_date) BETWEEN :fromDate AND :toDate
                        ORDER BY c.paid_date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 8. Amer Transactions
    $stmt = $pdo->prepare("SELECT 
                            a.datetime as date,
                            'Amer Transaction' as transaction_type,
                            a.cost_price as amount,
                            CONCAT('Amer transaction for ', COALESCE(c.customer_name, 'Unknown Customer'), ' - ', IFNULL(a.passenger_name, 'No remarks')) as description
                        FROM amer a
                        LEFT JOIN customer c ON a.customer_id = c.customer_id
                        WHERE a.account_id = :accountId 
                        AND DATE(a.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY a.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 9. Tasheel Transactions
    $stmt = $pdo->prepare("SELECT 
                            tt.created_at as date,
                            'Tasheel Transaction' as transaction_type,
                            tt.cost as amount,
                            CONCAT('Tasheel transaction - ', IFNULL(tt.transaction_number, 'No remarks')) as description
                        FROM tasheel_transactions tt
                        WHERE tt.account_id = :accountId 
                        AND DATE(tt.created_at) BETWEEN :fromDate AND :toDate
                        ORDER BY tt.created_at ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // 10. Service Payments
    $stmt = $pdo->prepare("SELECT 
                            sd.service_date as date,
                            'Service Payment' as transaction_type,
                            sd.salePrice as amount,
                            CONCAT('Service for ', COALESCE(sd.passenger_name, 'Unknown'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM servicedetails sd
                        LEFT JOIN customer c ON sd.customer_id = c.customer_id
                        WHERE sd.accoundID = :accountId 
                        AND sd.accoundID != 25
                        AND DATE(sd.service_date) BETWEEN :fromDate AND :toDate
                        ORDER BY sd.service_date ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // ============== RESIDENCE COSTS (All 8 Steps) - INCLUDING SUPPLIER-CHARGED ==============
    $residenceSteps = [
        ['account' => 'offerLetterAccount', 'supplier' => 'offerLetterSupplier', 'cost' => 'offerLetterCost', 'date' => 'offerLetterDate', 'name' => 'Offer Letter'],
        ['account' => 'insuranceAccount', 'supplier' => 'insuranceSupplier', 'cost' => 'insuranceCost', 'date' => 'insuranceDate', 'name' => 'Insurance'],
        ['account' => 'laborCardAccount', 'supplier' => 'laborCardSupplier', 'cost' => 'laborCardFee', 'date' => 'laborCardDate', 'name' => 'Labor Card'],
        ['account' => 'eVisaAccount', 'supplier' => 'eVisaSupplier', 'cost' => 'eVisaCost', 'date' => 'eVisaDate', 'name' => 'E-Visa'],
        ['account' => 'changeStatusAccount', 'supplier' => 'changeStatusSupplier', 'cost' => 'changeStatusCost', 'date' => 'changeStatusDate', 'name' => 'Change Status'],
        ['account' => 'medicalAccount', 'supplier' => 'medicalSupplier', 'cost' => 'medicalTCost', 'date' => 'medicalDate', 'name' => 'Medical'],
        ['account' => 'emiratesIDAccount', 'supplier' => 'emiratesIDSupplier', 'cost' => 'emiratesIDCost', 'date' => 'emiratesIDDate', 'name' => 'Emirates ID'],
        ['account' => 'visaStampingAccount', 'supplier' => 'visaStampingSupplier', 'cost' => 'visaStampingCost', 'date' => 'visaStampingDate', 'name' => 'Visa Stamping']
    ];
    
    foreach ($residenceSteps as $step) {
        $stmt = $pdo->prepare("SELECT 
                                {$step['date']} as date,
                                'Residence - {$step['name']}' as transaction_type,
                                {$step['cost']} as amount,
                                CONCAT('Residence {$step['name']} for ', COALESCE(r.passenger_name, 'Unknown'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')',
                                       CASE 
                                           WHEN r.{$step['supplier']} IS NOT NULL THEN ' [Charged to Supplier]'
                                           ELSE ''
                                       END) as description
                            FROM residence r
                            LEFT JOIN customer c ON r.customer_id = c.customer_id
                            WHERE ((r.{$step['account']} = :accountId AND r.{$step['account']} != 25) 
                                   OR (r.{$step['supplier']} IS NOT NULL AND r.{$step['account']} IS NULL))
                            AND r.{$step['cost']} > 0
                            AND r.{$step['date']} IS NOT NULL
                            AND DATE(r.{$step['date']}) BETWEEN :fromDate AND :toDate
                            ORDER BY r.{$step['date']} ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============== FAMILY RESIDENCE COSTS (5 Steps) ==============
    $familySteps = [
        ['account' => 'evisa_account', 'cost' => 'evisa_cost', 'date' => 'evisa_datetime', 'name' => 'E-Visa'],
        ['account' => 'change_status_account', 'cost' => 'change_status_cost', 'date' => 'change_status_datetime', 'name' => 'Change Status'],
        ['account' => 'medical_account', 'cost' => 'medical_cost', 'date' => 'medical_datetime', 'name' => 'Medical'],
        ['account' => 'eid_account', 'cost' => 'eid_cost', 'date' => 'eid_datetime', 'name' => 'Emirates ID'],
        ['account' => 'visa_stamping_account', 'cost' => 'visa_stamping_cost', 'date' => 'visa_stamping_datetime', 'name' => 'Visa Stamping']
    ];
    
    foreach ($familySteps as $step) {
        $stmt = $pdo->prepare("SELECT 
                                {$step['date']} as date,
                                'Dependent - {$step['name']}' as transaction_type,
                                {$step['cost']} as amount,
                                CONCAT('Dependent {$step['name']} for ', fr.passenger_name, ' (', fr.relation_type, ')') as description
                            FROM family_residence fr
                            WHERE fr.{$step['account']} = :accountId 
                            AND fr.{$step['account']} IS NOT NULL
                            AND fr.{$step['account']} != 25
                            AND fr.{$step['cost']} > 0
                            AND fr.{$step['date']} IS NOT NULL
                            AND DATE(fr.{$step['date']}) BETWEEN :fromDate AND :toDate
                            ORDER BY fr.{$step['date']} ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    
    // ============== SPECIAL CHARGES ==============
    
    // Residence Fines
    $stmt = $pdo->prepare("SELECT 
                            rf.datetime as date,
                            'Residence - Fine' as transaction_type,
                            rf.fineAmount as amount,
                            CONCAT('Fine for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                        FROM residencefine rf
                        LEFT JOIN residence r ON rf.residenceID = r.residenceID
                        LEFT JOIN customer c ON r.customer_id = c.customer_id
                        WHERE rf.accountID = :accountId 
                        AND rf.accountID != 25
                        AND DATE(rf.datetime) BETWEEN :fromDate AND :toDate
                        ORDER BY rf.datetime ASC");
    $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
    $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    
    // Tawjeeh Operations
    try {
        $stmt = $pdo->prepare("SELECT 
                                tc.charge_date as date,
                                'Tawjeeh Operation' as transaction_type,
                                tc.amount,
                                CONCAT('Tawjeeh performed for Residence ID: ', tc.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                            FROM tawjeeh_charges tc
                            LEFT JOIN residence r ON tc.residence_id = r.residenceID
                            WHERE tc.account_id = :accountId 
                            AND tc.account_id != 25
                            AND tc.status = 'paid'
                            AND DATE(tc.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY tc.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Tawjeeh charges query error: " . $e->getMessage());
    }
    
    // ILOE Insurance Operations
    try {
        $stmt = $pdo->prepare("SELECT 
                                ic.charge_date as date,
                                'ILOE Insurance Operation' as transaction_type,
                                ic.amount,
                                CONCAT('ILOE Insurance issued for Residence ID: ', ic.residence_id, ' - ', COALESCE(r.passenger_name, 'Unknown Passenger')) as description
                            FROM iloe_charges ic
                            LEFT JOIN residence r ON ic.residence_id = r.residenceID
                            WHERE ic.account_id = :accountId 
                            AND ic.account_id != 25
                            AND ic.charge_type = 'insurance'
                            AND ic.status = 'paid'
                            AND DATE(ic.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY ic.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("ILOE charges query error: " . $e->getMessage());
    }
    
    // eVisa Charges
    try {
        $stmt = $pdo->prepare("SELECT 
                                ec.charge_date as date,
                                'eVisa Charge' as transaction_type,
                                ec.amount,
                                CONCAT('eVisa application charge for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Residence ID: ', ec.residence_id, ')') as description
                            FROM evisa_charges ec
                            LEFT JOIN residence r ON ec.residence_id = r.residenceID
                            WHERE ec.account_id = :accountId 
                            AND ec.account_id != 25
                            AND ec.status = 'paid'
                            AND DATE(ec.charge_date) BETWEEN :fromDate AND :toDate
                            ORDER BY ec.charge_date ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("eVisa charges query error: " . $e->getMessage());
    }
    
    // Residence Custom Charges
    try {
        $stmt = $pdo->prepare("SELECT 
                                rcc.created_at as date,
                                'Residence - Extra Charge' as transaction_type,
                                rcc.net_cost as amount,
                                CONCAT('Extra Charge for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                            FROM residence_custom_charges rcc
                            LEFT JOIN residence r ON rcc.residence_id = r.residenceID
                            LEFT JOIN customer c ON r.customer_id = c.customer_id
                            WHERE rcc.account_id = :accountId 
                            AND rcc.account_id != 25
                            AND rcc.net_cost > 0
                            AND DATE(rcc.created_at) BETWEEN :fromDate AND :toDate
                            ORDER BY rcc.created_at ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Custom charges query error: " . $e->getMessage());
    }
    
    // Cancellation Transactions
    try {
        $stmt = $pdo->prepare("SELECT 
                                rc.internal_processed_at as date,
                                'Cancellation Transaction' as transaction_type,
                                rc.internal_net_cost as amount,
                                CONCAT('Internal cancellation processing for ', COALESCE(r.passenger_name, 'Unknown Passenger'), ' (Customer: ', COALESCE(c.customer_name, 'Unknown'), ')') as description
                            FROM residence_cancellation rc
                            LEFT JOIN residence r ON rc.residence = r.residenceID
                            LEFT JOIN customer c ON rc.customer_id = c.customer_id
                            WHERE rc.internal_account_id = :accountId 
                            AND rc.internal_account_id != 25
                            AND rc.internal_processed = 1
                            AND rc.internal_net_cost > 0
                            AND rc.internal_processed_at IS NOT NULL
                            AND DATE(rc.internal_processed_at) BETWEEN :fromDate AND :toDate
                            ORDER BY rc.internal_processed_at ASC");
        $stmt->execute(['accountId' => $accountId, 'fromDate' => $fromDate, 'toDate' => $toDate]);
        $debits = array_merge($debits, $stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Exception $e) {
        error_log("Cancellation query error: " . $e->getMessage());
    }
    
    return [
        'credits' => $credits,
        'debits' => $debits
    ];
}
?>
