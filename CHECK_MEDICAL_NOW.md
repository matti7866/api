# 🔍 MEDICAL DIAGNOSIS - Step by Step

## 📋 **Step 1: Run Diagnostic Query**

Visit this URL in your browser:
```
http://localhost/snt/api/accounts/diagnostic-medical.php
```

Or run this SQL in phpMyAdmin:

```sql
-- Check medical entries
SELECT 
    residenceID,
    passenger_name,
    medicalTCost,
    medicalAccount,
    medicalSupplier,
    medicalDate,
    CASE 
        WHEN medicalAccount IS NOT NULL THEN CONCAT('Account: ', medicalAccount)
        WHEN medicalSupplier IS NOT NULL THEN 'Supplier'
        ELSE 'NO CHARGE ENTITY ⚠️'
    END as charged_to,
    CASE
        WHEN medicalDate IS NULL THEN '❌ NO DATE'
        WHEN DATE(medicalDate) < '2025-10-01' THEN '❌ BEFORE RESET'
        ELSE '✅ VALID'
    END as status
FROM residence 
WHERE medicalTCost > 0
ORDER BY medicalDate DESC
LIMIT 20;
```

---

## 🎯 **Step 2: Check Results**

### ❌ If Status = "NO DATE":
**Problem**: medicalDate is NULL  
**Solution**: Update residence records to set medicalDate

```sql
-- Fix: Set medicalDate to current date where missing
UPDATE residence 
SET medicalDate = NOW() 
WHERE medicalTCost > 0 
AND medicalDate IS NULL;
```

### ❌ If Status = "BEFORE RESET":
**Problem**: Medical date is before 2025-10-01  
**Fix**: Either:
1. Change reset date (not recommended)
2. Update old medical dates to after reset
3. Accept that old data won't show

### ❌ If charged_to = "NO CHARGE ENTITY":
**Problem**: Both medicalAccount AND medicalSupplier are NULL  
**Solution**: Assign medical to an account or supplier

```sql
-- Check how many have no charge entity
SELECT COUNT(*) 
FROM residence 
WHERE medicalTCost > 0 
AND medicalAccount IS NULL 
AND medicalSupplier IS NULL;

-- Option: Assign all orphaned medical costs to default account (e.g., ID 1)
UPDATE residence 
SET medicalAccount = 1  -- Change 1 to your default account ID
WHERE medicalTCost > 0 
AND medicalAccount IS NULL 
AND medicalSupplier IS NULL
AND medicalDate >= '2025-10-01';
```

---

## 🧪 **Step 3: Test Specific Medical Entry**

Find one medical entry that SHOULD appear:

```sql
-- Get one valid medical entry
SELECT 
    residenceID,
    passenger_name,
    medicalTCost,
    medicalAccount,
    medicalSupplier,
    medicalDate,
    DATE(medicalDate) as date_only
FROM residence 
WHERE medicalTCost > 0
AND medicalDate IS NOT NULL
AND DATE(medicalDate) >= '2025-10-01'
AND (medicalAccount IS NOT NULL OR medicalSupplier IS NOT NULL)
LIMIT 1;
```

Take note of the `residenceID` and `medicalDate`.

---

## 🔍 **Step 4: Direct API Test**

Test if the new API returns this medical entry.

Visit in browser (replace DATE and ACCOUNT):
```
http://localhost/snt/api/accounts/transactions.php?fromDate=2025-10-01&toDate=2025-12-31&accountFilter=&typeFilter=
```

Or use this curl command:
```bash
curl -X POST "http://localhost/snt/api/accounts/transactions.php" \
  -H "Cookie: PHPSESSID=YOUR_SESSION_ID" \
  -F "fromDate=2025-10-01" \
  -F "toDate=2025-12-31" \
  -F "accountFilter=" \
  -F "typeFilter=" \
  -F "resetDate=2025-10-01"
```

Search the response for "Medical" transactions.

---

## 📊 **Step 5: Check Browser Console**

1. Open your page: `http://127.0.0.1:5174/accounts/report`
2. Open Browser Console (F12)
3. Click "Load Transactions"
4. Look for this in console:

```
📊 TRANSACTIONS DATA RECEIVED (STANDALONE API)
Transaction Types Breakdown:
  - Residence - Medical: X transactions  ← Should see this!
```

If you see `X transactions` for medical, it's working!

---

## ⚠️ **Step 6: Check Filters**

In your React page, make sure:
- ✅ **From Date** = `2025-10-01` or later
- ✅ **To Date** = Today or future
- ✅ **Account Filter** = Empty (ALL ACCOUNTS)
- ✅ **Type Filter** = Empty (ALL TYPES) or "Debits"

**If Account Filter is set**, only medical costs for THAT specific account will show.

---

## 🔧 **Quick SQL Fix Commands**

### Fix 1: Set Missing Dates
```sql
UPDATE residence 
SET medicalDate = NOW() 
WHERE medicalTCost > 0 
AND medicalDate IS NULL;
```

### Fix 2: Assign Orphaned Medical to Default Account
```sql
UPDATE residence 
SET medicalAccount = 1  -- Use your default account ID
WHERE medicalTCost > 0 
AND medicalAccount IS NULL 
AND medicalSupplier IS NULL 
AND medicalDate IS NOT NULL;
```

### Fix 3: Move Old Dates Forward (if needed)
```sql
UPDATE residence 
SET medicalDate = '2025-10-01' 
WHERE medicalTCost > 0 
AND medicalDate IS NOT NULL 
AND DATE(medicalDate) < '2025-10-01';
```

---

## 📞 **Tell Me What You Find**

Run the diagnostic query and tell me:
1. How many total medical entries?
2. How many with dates?
3. How many after reset date?
4. How many charged to account vs supplier?
5. Any with "NO CHARGE ENTITY"?

Then I can pinpoint the exact issue! 🎯


