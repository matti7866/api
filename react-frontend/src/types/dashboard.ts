// Dashboard TypeScript Interfaces
// Updated: 2025-10-22

export interface TodayStats {
  Todays_Ticket: number;
  ticket_profit: number;
  Todays_Visa: number;
  Visa_Profit: number;
  Total_Expense: number;
}

export interface DailyEntry {
  EntryType: string;
  type: string;
  customer_name: string;
  passenger_name: string;
  Details: string;
  details: string;
  datetime: string;
  date: string;
  staff_name: string;
  amount: number;
}

export interface DashboardFilters {
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  eventDate: string;
  FormattedeventDate: string;
  assignedBy: string;
}

export interface UpcomingFlight {
  Pnr: string;
  ticketNumber: string;
  customer_name: string;
  passenger_name: string;
  date_of_travel: string;
  from_place: string;
  to_place: string;
  remarks: string;
}

export interface UpcomingCheque {
  cheque_id: number;
  cheque_number: string;
  cheque_amount: number;
  date: string;
  bank_name: string;
  customer_name?: string;
  supplier_name?: string;
  remarks: string;
}

