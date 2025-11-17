// Ticket Types based on actual database schema

export interface Ticket {
  ticket: number; // Primary key
  ticketNumber?: string;
  Pnr: string;
  customer_id: number;
  passenger_name: string;
  date_of_travel: string;
  return_date?: string;
  from_id: number;
  to_id: number;
  sale: number;
  currencyID: number;
  staff_id: number;
  supp_id: number;
  net_price: number;
  net_CurrencyID: number;
  ticketCopy?: string;
  branchID: number;
  remarks?: string;
  flight_number?: string;
  return_flight_number?: string;
  departure_time?: string;
  arrival_time?: string;
  return_departure_time?: string;
  return_arrival_time?: string;
  flight_type: 'OW' | 'RT';
  datetime: string; // Created timestamp
  status?: number; // 1=Issued, 2=Date Changed, 3=Refunded
  
  // Joined data
  customer_name?: string;
  customer_phone?: string;
  from_code?: string;
  to_code?: string;
  currency_name?: string;
  net_currency_name?: string;
  supplier_name?: string;
  staff_name?: string;
}

export interface TicketFilters {
  startDate?: string;
  endDate?: string;
  customerId?: number;
  supplierId?: number;
  pnr?: string;
  passengerName?: string;
  ticketNumber?: string;
  flightType?: string;
  fromAirport?: number;
  toAirport?: number;
}

export interface TicketPassenger {
  passenger_name: string;
  ticketNumber: string;
  net_price: number;
  net_CurrencyID: number;
  sale: number;
  currencyID: number;
}

export interface CreateTicketRequest {
  pnr: string;
  customer_id: number;
  passengers: TicketPassenger[];
  date_of_travel: string;
  return_date?: string;
  from_id: number;
  to_id: number;
  supp_id: number;
  remarks?: string;
  flight_number?: string;
  return_flight_number?: string;
  departure_time?: string;
  arrival_time?: string;
  return_departure_time?: string;
  return_arrival_time?: string;
  flight_type: 'OW' | 'RT';
  ticketCopy?: File;
  
  // Payment fields
  customer_payment?: number;
  payment_currency_type?: number;
  account_id?: number;
}

export interface Airport {
  airport_id: number;
  airport_code: string;
  name: string;
}

export interface Customer {
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_whatsapp?: string;
  customer_address?: string;
  customer_email?: string;
}

export interface Supplier {
  supp_id: number;
  supp_name: string;
  supp_phone?: string;
  supp_email?: string;
}

export interface Currency {
  currencyID: number;
  currencyName: string;
}

export interface CustomerBalance {
  curID: number;
  curName: string;
  total: number;
}

export interface TicketStats {
  total_tickets: number;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  by_currency: {
    currency: string;
    sale: number;
    cost: number;
    profit: number;
  }[];
}

