export interface PendingCustomer {
  main_customer: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_whatsapp?: string;
  total: number;
}

export interface CustomerOption {
  customer_id: number;
  customer_name: string;
}

export interface CurrencyOption {
  currencyID: number;
  currencyName: string;
}

export interface TotalCharges {
  total: number;
}

export interface AddPaymentRequest {
  customer_id: number;
  payment_amount: number;
  currency_id: number;
  account_id: number;
  remarks?: string;
}

export interface CustomerLedgerTransaction {
  TRANSACTION_Type: string;
  Passenger_Name: string;
  date: string;
  Identification: string;
  Orgin: string;
  Destination: string;
  Debit: number;
  Credit: number;
}

export interface CustomerInfo {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
}
