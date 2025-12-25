import apiClient from './api';
import type { Agent, AgentFilters, CreateAgentRequest, UpdateAgentRequest } from '../types/agent';

export const agentService = {
  async searchAgents(filters: AgentFilters): Promise<{ data: Agent[]; pagination?: any }> {
    const response = await apiClient.post('/agent/agents.php', {
      action: 'searchAgents',
      ...filters
    });
    return {
      data: response.data.success ? response.data.data : [],
      pagination: response.data.pagination
    };
  },

  async addAgent(data: CreateAgentRequest): Promise<{ success: boolean; message: string; errors?: any }> {
    const response = await apiClient.post('/agent/agents.php', {
      action: 'addAgent',
      ...data
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Agent added successfully',
      errors: response.data.errors
    };
  },

  async updateAgent(data: UpdateAgentRequest): Promise<{ success: boolean; message: string; errors?: any }> {
    const response = await apiClient.post('/agent/agents.php', {
      action: 'updateAgent',
      ...data
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Agent updated successfully',
      errors: response.data.errors
    };
  },

  async deleteAgent(id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/agent/agents.php', {
      action: 'deleteAgent',
      id
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Agent deleted successfully'
    };
  },

  async getAgent(id: number): Promise<Agent> {
    const response = await apiClient.post('/agent/agents.php', {
      action: 'getAgent',
      id
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Agent not found');
  }
};

