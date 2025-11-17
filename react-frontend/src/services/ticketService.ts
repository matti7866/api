import apiClient from './api';
import type { 
  Ticket, 
  TicketFilters, 
  CreateTicketRequest,
  Airport,
  Customer,
  Supplier,
  Currency
} from '../types/ticket';

interface DropdownData {
  customers: Customer[];
  airports: Airport[];
  suppliers: Supplier[];
  currencies: Currency[];
  accounts: { accountID: number; accountName: string; accountType: string }[];
}

const ticketService = {
  // Get all tickets with optional filters
  getTickets: async (filters?: TicketFilters): Promise<Ticket[]> => {
    const params = new URLSearchParams();
    
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.customerId) params.append('customerId', filters.customerId.toString());
    if (filters?.supplierId) params.append('supplierId', filters.supplierId.toString());
    if (filters?.pnr) params.append('pnr', filters.pnr);
    if (filters?.passengerName) params.append('passengerName', filters.passengerName);
    if (filters?.ticketNumber) params.append('ticketNumber', filters.ticketNumber);
    if (filters?.flightType) params.append('flightType', filters.flightType);
    if (filters?.fromAirport) params.append('fromAirport', filters.fromAirport.toString());
    if (filters?.toAirport) params.append('toAirport', filters.toAirport.toString());
    
    const queryString = params.toString();
    const url = `/ticket/list.php${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiClient.get(url);
    return response.data.data || [];
  },

  // Get dropdown data for forms
  getDropdowns: async (): Promise<DropdownData> => {
    const response = await apiClient.get('/ticket/dropdowns.php');
    return response.data.data;
  },

  // Create new ticket(s)
  createTicket: async (data: CreateTicketRequest): Promise<{ ticket_ids: number[] }> => {
    const response = await apiClient.post('/ticket/create.php', data);
    return response.data.data;
  },

  // Delete ticket
  deleteTicket: async (ticketId: number): Promise<void> => {
    await apiClient.post('/ticket/delete.php', { ticket_id: ticketId });
  },

  // Update ticket
  updateTicket: async (ticketId: number, data: Partial<Ticket>): Promise<void> => {
    await apiClient.put('/ticket/update.php', { 
      ticket_id: ticketId,
      ...data 
    });
  },

  // Change travel date
  changeDate: async (ticketId: number, data: {
    extended_date: string;
    supplier_id: number;
    net_amount: number;
    net_currency_id: number;
    sale_amount: number;
    sale_currency_id: number;
    remarks?: string;
    changedTicket?: File;
  }): Promise<void> => {
    const formData = new FormData();
    formData.append('ticket_id', ticketId.toString());
    formData.append('extended_date', data.extended_date);
    formData.append('supplier_id', data.supplier_id.toString());
    formData.append('net_amount', data.net_amount.toString());
    formData.append('net_currency_id', data.net_currency_id.toString());
    formData.append('sale_amount', data.sale_amount.toString());
    formData.append('sale_currency_id', data.sale_currency_id.toString());
    if (data.remarks) formData.append('remarks', data.remarks);
    if (data.changedTicket) formData.append('changedTicket', data.changedTicket);
    
    await apiClient.post('/ticket/change-date.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Upload ticket copy
  uploadTicketCopy: async (ticketId: number, file: File): Promise<{ file_path: string }> => {
    const formData = new FormData();
    formData.append('ticket_id', ticketId.toString());
    formData.append('ticketCopy', file);
    
    const response = await apiClient.post('/ticket/upload-copy.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Refund ticket
  refundTicket: async (ticketId: number, data: {
    refund_net_amount: number;
    net_currency_id: number;
    refund_sale_amount: number;
    sale_currency_id: number;
    remarks?: string;
  }): Promise<void> => {
    await apiClient.post('/ticket/refund.php', { 
      ticket_id: ticketId,
      ...data
    });
  }
};

export default ticketService;

