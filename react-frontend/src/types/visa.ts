// Visa Types based on actual database schema

export interface Visa {
  visa_id: number;
  customer_id: number;
  passenger_name: string;
  datetime: string;
  supp_id: number;
  country_id: number;
  staff_id: number;
  net_price: number;
  netCurrencyID: number;
  sale: number;
  saleCurrencyID: number;
  gaurantee: string;
  address: string;
  pendingvisa?: number;
  visaCopy?: string;
  branchID: number;
  PassportNum?: string;
  nationalityID: number;
  
  // Joined data
  customer_name?: string;
  customer_phone?: string;
  supplier_name?: string;
  country_name?: string;
  net_currency_name?: string;
  sale_currency_name?: string;
  staff_name?: string;
  nationality?: string;
}

export interface VisaFilters {
  startDate?: string;
  endDate?: string;
  customerId?: number;
  passportNum?: string;
  passengerName?: string;
  countryId?: number;
}

export interface Country {
  country_id: number;
  country_names: string;
}

export interface Nationality {
  nationalityID: number;
  nationality: string;
}

export interface Customer {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
}

export interface Supplier {
  supp_id: number;
  supp_name: string;
}

export interface Currency {
  currencyID: number;
  currencyName: string;
}

export interface Account {
  accountID: number;
  accountName: string;
}

export interface VisaDropdowns {
  customers: Customer[];
  suppliers: Supplier[];
  countries: Country[];
  nationalities: Nationality[];
  currencies: Currency[];
  accounts: Account[];
}














