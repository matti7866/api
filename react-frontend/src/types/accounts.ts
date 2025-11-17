export interface Account {
  account_ID: number;
  account_Name: string;
  Account_Balance?: number;
  currency?: string;
}

export interface Transaction {
  date: string;
  transaction_type: string;
  type_category?: string; // 'credit', 'debit', or 'transfer' for color coding
  account: string;
  description: string;
  reference: string;
  credit: number;
  debit: number;
  currency_info: string;
  staff_name: string;
  remarks: string;
}

export interface AccountBalance {
  account_ID: number;
  account_Name: string;
  total_credits: number;
  total_debits: number;
  balance: number;
  status: string;
  currency: string;
}

export interface TransactionSummary {
  totalCredits: string;
  totalDebits: string;
  totalTransfers: string;
  netBalance: string;
}

export interface TransactionsResponse {
  html: string;
  summary: TransactionSummary;
  transactions: Transaction[];
}

export interface AccountBalancesResponse {
  html: string;
  balances: AccountBalance[];
}

export interface Currency {
  currencyID: number;
  currencyName: string;
}

export interface TransactionFilter {
  fromDate: string;
  toDate: string;
  accountFilter: string;
  typeFilter: string;
  resetDate: string;
}

export interface DepositRequest {
  depositAccount: number;
  depositAmount: number;
  depositCurrency: number;
  depositRemarks: string;
}

export interface WithdrawRequest {
  withdrawAccount: number;
  withdrawAmount: number;
  withdrawCurrency: number;
  withdrawRemarks: string;
}

export interface TransferRequest {
  transferDate: string;
  transferFromAccount: number;
  transferToAccount: number;
  transferAmount: number;
  transferAmountConfirm: number;
  transferCharges: number;
  transferExchangeRate: number;
  transferTrxNumber?: string;
  transferRemarks?: string;
}

export interface AccountStatementData {
  success: boolean;
  totalCredits: number;
  totalDebits: number;
  balance: number;
  currency: string;
  transactions: Transaction[];
  message?: string;
}

export interface ValidationReport {
  total_expected: number;
  total_valid: number;
  valid_tables: Array<{
    table: string;
    type: string;
  }>;
  missing_tables: Array<{
    table: string;
    type: string;
    error: string;
  }>;
  invalid_tables: Array<{
    table: string;
    type: string;
    missing_columns: string[];
  }>;
}

