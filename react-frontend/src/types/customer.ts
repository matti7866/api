export interface Customer {
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  customer_email?: string;
  cust_password?: string;
  status: number | string;
  affliate_supp_id?: number | null;
  affiliate_supplier_name?: string;
}

export interface CustomerFilters {
  page?: number;
  per_page?: number;
  filter_name?: string;
  filter_phone?: string;
  filter_email?: string;
  filter_status?: string;
  filter_supplier?: number;
}

export interface CreateCustomerRequest {
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  customer_email?: string;
  customer_password?: string;
  customer_status: number;
  supplier_id?: number | null;
}

export interface UpdateCustomerRequest extends CreateCustomerRequest {
  customer_id: number;
}

