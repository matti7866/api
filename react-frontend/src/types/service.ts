export interface Service {
  serviceDetailsID: number;
  serviceName: string;
  customer_name: string;
  passenger_name: string;
  service_date: string;
  service_details: string;
  salePrice: number;
  currencyName: string;
  chargeFlag: 'bySupplier' | 'byAccount';
  ChargedEntity: string;
  staff_name: string;
  serviceID: number;
  customer_id: number;
  Supplier_id: number | null;
  accoundID: number | null;
  netPrice: number;
  netCurrencyID: number;
  saleCurrencyID: number;
}

export interface ServiceFilters {
  customer_id?: number;
  service_id?: number;
  passenger_name?: string;
  start_date?: string;
  end_date?: string;
}

export interface CreateServiceRequest {
  service_id: number;
  customer_id: number;
  passenger_name: string;
  service_details: string;
  sale_price: number;
  sale_currency_id: number;
}

export interface ServiceDropdownData {
  customers: { customer_id: number; customer_name: string }[];
  services: { serviceID: number; serviceName: string }[];
  suppliers: { supp_id: number; supp_name: string }[];
  currencies: { currencyID: number; currencyName: string }[];
  accounts: { account_ID: number; account_Name: string }[];
}

export interface ServiceDocument {
  document_id: number;
  detailServiceID: number;
  file_name: string;
  original_name: string;
}

