export interface Cheque {
  id: number;
  number: string;
  type: 'payable' | 'receivable';
  payee: string;
  amount: number;
  date: string;
  status: string;
  bank?: string;
}

export interface Flight {
  ticket: number;
  ticketNumber: string;
  Pnr: string;
  passenger_name: string;
  from_place: string;
  to_place: string;
  date_of_travel: string;
  return_date?: string;
  flight_type: string;
  customer_name: string;
}

export interface CustomEvent {
  id: number;
  title: string;
  description?: string;
  date: string;
  time?: string;
  type: 'custom';
  subtype: 'meeting' | 'deadline' | 'task' | 'appointment' | 'reminder' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  status: 'pending' | 'completed' | 'cancelled';
  all_day: boolean;
  created_by?: string;
  assigned_to?: string;
}

export interface CalendarEvent {
  date: string;
  title: string;
  type: 'cheque' | 'flight' | 'custom';
  details: Cheque | Flight | CustomEvent;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEvent: boolean;
  hasCheque: boolean;
  hasFlight: boolean;
  hasCustomEvent: boolean;
  events: CalendarEvent[];
}

