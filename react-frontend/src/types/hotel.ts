export interface Hotel {
  hotel_id: number;
  customer_id: number;
  customer_name: string;
  passenger_name: string;
  supplier_id: number | null;
  supp_name: string | null;
  account_name: string | null;
  hotel_name: string;
  checkin_date: string;
  checkout_date: string;
  net_price: number;
  netCurrency: string;
  netCurrencyID: number;
  sale_price: number;
  saleCurrency: string;
  saleCurrencyID: number;
  country_id: number;
  country_names: string;
  datetime: string;
  staff_name: string;
  account_id: number | null;
}

export interface HotelFilters {
  customer?: number;
  start_date?: string;
  end_date?: string;
  search_by_date?: boolean;
}

export interface CreateHotelRequest {
  customer_id: number;
  passenger_name: string;
  hotel_name: string;
  supplier_id?: number | null;  // Optional - can be NULL when paying directly through account
  checkin_date: string;
  checkout_date: string;
  net_price: number;
  net_currency_id: number;
  sale_price: number;
  sale_currency_id: number;
  country_id: number;
  cus_payment?: number;
  cus_payment_currency?: number;
  account_id?: number;  // Used only for customer_payments table
}

export interface HotelDropdownData {
  customers: { customer_id: number; customer_name: string }[];
  suppliers: { supp_id: number; supp_name: string }[];
  currencies: { currencyID: number; currencyName: string }[];
  countries: { country_id: number; country_names: string }[];
  accounts: { account_ID: number; account_Name: string }[];
}

