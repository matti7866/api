export interface Agent {
  id: number;
  company: string;
  customer_id: number;
  customer_name?: string;
  email: string;
  status: number;
}

export interface AgentFilters {
  search?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface CreateAgentRequest {
  company: string;
  customer_id: number;
  email: string;
}

export interface UpdateAgentRequest extends CreateAgentRequest {
  id: number;
}

