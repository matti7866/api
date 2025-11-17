export interface AccountManagement {
  account_ID: number;
  account_Name: string;
  accountNum: string | null;
  accountType: 1 | 2 | 3; // 1=Personal, 2=Business, 3=Cash
  accountTypeName?: string; // 'Personal', 'Business', 'Cash'
  curID: number;
  currencyName?: string;
}

export interface Currency {
  currencyID: number;
  currencyName: string;
}

export interface CreateAccountRequest {
  account_name: string;
  account_number?: string;
  accountType: number;
  currency_type: number;
}

export interface UpdateAccountRequest {
  accountID: number;
  updaccount_name: string;
  updaccount_number?: string;
  updaccountType: number;
  updcurrency_type: number;
}

export interface AccountManagementResponse {
  status?: string;
  success?: boolean;
  message?: string;
  data?: AccountManagement | AccountManagement[];
  errors?: Record<string, string>;
}


