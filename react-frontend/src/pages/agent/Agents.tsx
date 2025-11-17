import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { agentService } from '../../services/agentService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { Agent, AgentFilters, CreateAgentRequest, UpdateAgentRequest } from '../../types/agent';
import './Agents.css';

interface Customer {
  customer_id: number;
  customer_name: string;
}

export default function Agents() {
  const [filters, setFilters] = useState<AgentFilters>({
    page: 1,
    per_page: 20
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState<Partial<CreateAgentRequest>>({
    company: '',
    customer_id: undefined,
    email: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const queryClient = useQueryClient();
  
  // Load customers for dropdown
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers-dropdown'],
    queryFn: async () => {
      try {
        const response = await apiClient.post('/customer/customers.php', {
          action: 'getCustomers',
          page: 1,
          per_page: 1000
        });
        return response.data.success ? response.data.data : [];
      } catch (error) {
        return [];
      }
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load agents
  const { data: agentsResult, refetch: refetchAgents } = useQuery({
    queryKey: ['agents', filters],
    queryFn: () => agentService.searchAgents(filters),
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  const agents = agentsResult?.data || [];
  const pagination = agentsResult?.pagination;
  
  // Add agent mutation
  const addAgentMutation = useMutation({
    mutationFn: (data: CreateAgentRequest) => agentService.addAgent(data),
    onSuccess: (result) => {
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: result.message,
          timer: 1500,
          showConfirmButton: false
        });
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        setShowAddModal(false);
        resetForm();
      } else if (result.errors) {
        setFormErrors(result.errors);
      }
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: error.response?.data?.message || 'Failed to add agent'
        });
      }
    }
  });
  
  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: (data: UpdateAgentRequest) => agentService.updateAgent(data),
    onSuccess: (result) => {
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: result.message,
          timer: 1500,
          showConfirmButton: false
        });
        queryClient.invalidateQueries({ queryKey: ['agents'] });
        setEditingAgent(null);
        resetForm();
      } else if (result.errors) {
        setFormErrors(result.errors);
      }
    },
    onError: (error: any) => {
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error!',
          text: error.response?.data?.message || 'Failed to update agent'
        });
      }
    }
  });
  
  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: (id: number) => agentService.deleteAgent(id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Agent deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to delete agent'
      });
    }
  });
  
  const resetForm = () => {
    setFormData({
      company: '',
      customer_id: undefined,
      email: ''
    });
    setFormErrors({});
  };
  
  const handleAddAgent = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleEditAgent = async (agent: Agent) => {
    try {
      const fullAgent = await agentService.getAgent(agent.id);
      setFormData({
        company: fullAgent.company || '',
        customer_id: fullAgent.customer_id,
        email: fullAgent.email || ''
      });
      setFormErrors({});
      setEditingAgent(agent);
    } catch (error) {
      console.error('Error fetching agent:', error);
      // Fallback to using agent data from table
      setFormData({
        company: agent.company || '',
        customer_id: agent.customer_id,
        email: agent.email || ''
      });
      setFormErrors({});
      setEditingAgent(agent);
    }
  };
  
  const handleDeleteAgent = (id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Are you sure you want to delete this agent record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteAgentMutation.mutate(id);
      }
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    if (!formData.company || !formData.customer_id || !formData.email) {
      const errors: Record<string, string> = {};
      if (!formData.company) errors.company = 'Company name is required';
      if (!formData.customer_id) errors.customer_id = 'Customer is required';
      if (!formData.email) errors.email = 'Email is required';
      setFormErrors(errors);
      return;
    }
    
    if (editingAgent) {
      updateAgentMutation.mutate({
        ...formData as CreateAgentRequest,
        id: editingAgent.id
      });
    } else {
      addAgentMutation.mutate(formData as CreateAgentRequest);
    }
  };
  
  const handleSearch = () => {
    setFilters(prev => ({ 
      ...prev, 
      search: searchTerm || undefined,
      page: 1 
    }));
  };
  
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };
  
  const handlePerPageChange = (newPerPage: number) => {
    setFilters(prev => ({ ...prev, per_page: newPerPage, page: 1 }));
  };
  
  useEffect(() => {
    refetchAgents();
  }, [filters]);
  
  return (
    <div className="agents-page">
      <div className="page-header">
        <h1><i className="fa fa-users me-2"></i>Manage Agents</h1>
        <button className="btn btn-success" onClick={handleAddAgent}>
          <i className="fa fa-plus me-2"></i>Add Agent
        </button>
      </div>
      
      {/* Search Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-search me-2"></i>Search Agents</h3>
        </div>
        <div className="panel-body">
          <div className="search-form-row">
            <div className="search-form-group">
              <label htmlFor="search" className="form-label">Search</label>
              <input
                type="text"
                className="form-control"
                id="search"
                placeholder="Search by company or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </div>
            <div className="search-form-group">
              <label htmlFor="status" className="form-label">Status</label>
              <select
                className="form-control"
                id="status"
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="0">Suspended</option>
              </select>
            </div>
            <div className="search-button-group">
              <button type="button" onClick={handleSearch} className="btn btn-primary">
                <i className="fa fa-filter me-2"></i>Search
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Agents Table */}
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-list me-2"></i>Agents</h3>
        </div>
        <div className="panel-body">
          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Agency / Company Name / Customer</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center">No agents found</td>
                  </tr>
                ) : (
                  agents.map((agent, index) => (
                    <tr key={agent.id}>
                      <td>{agent.id}</td>
                      <td>
                        <strong>{agent.company}</strong>
                        <br />
                        <small className="text-muted">Customer: {agent.customer_name || 'N/A'}</small>
                      </td>
                      <td>{agent.email}</td>
                      <td>
                        <span className={`badge ${agent.status == 1 ? 'badge-active' : 'badge-inactive'} rounded-pill`}>
                          {agent.status == 1 ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            onClick={() => handleEditAgent(agent)}
                            className="btn btn-sm btn-primary me-2"
                          >
                            <i className="fa fa-edit"></i> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="btn btn-sm btn-danger"
                          >
                            <i className="fa fa-trash"></i> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} entries
              </div>
              <div className="pagination-controls">
                <select
                  className="form-control per-page-select"
                  value={filters.per_page || 20}
                  onChange={(e) => handlePerPageChange(Number(e.target.value))}
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                <div className="pagination-buttons">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <i className="fa fa-chevron-left"></i> Previous
                  </button>
                  <span className="page-info">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                  >
                    Next <i className="fa fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Add/Edit Modal */}
      {(showAddModal || editingAgent) && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          setEditingAgent(null);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <i className="fa fa-users me-2"></i>
                {editingAgent ? 'Edit Agent' : 'New Agent'}
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAgent(null);
                  resetForm();
                }}
              >×</button>
            </div>
            <div className="modal-body">
              {((addAgentMutation.isError && addAgentMutation.error?.response?.data?.errors) || 
                (updateAgentMutation.isError && updateAgentMutation.error?.response?.data?.errors) ||
                Object.keys(formErrors).length > 0) && (
                <div className="alert alert-danger">
                  Please fix the errors below
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">
                    Agent / Company Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className={`form-control ${formErrors.company ? 'is-invalid' : ''}`}
                    name="company"
                    value={formData.company || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, company: e.target.value });
                      if (formErrors.company) {
                        setFormErrors({ ...formErrors, company: '' });
                      }
                    }}
                    placeholder="Agent / Company Name"
                    required
                  />
                  {formErrors.company && (
                    <div className="invalid-feedback">{formErrors.company}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Select Customer Account <span className="text-danger">*</span>
                  </label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Select' },
                      ...(customers?.map(c => ({
                        value: String(c.customer_id),
                        label: c.customer_name
                      })) || [])
                    ]}
                    value={formData.customer_id ? String(formData.customer_id) : ''}
                    onChange={(value) => {
                      setFormData({ ...formData, customer_id: value ? Number(value) : undefined });
                      if (formErrors.customer_id) {
                        setFormErrors({ ...formErrors, customer_id: '' });
                      }
                    }}
                    placeholder="Select Customer"
                  />
                  {formErrors.customer_id && (
                    <div className="invalid-feedback" style={{ display: 'block' }}>{formErrors.customer_id}</div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    className={`form-control ${formErrors.email ? 'is-invalid' : ''}`}
                    name="email"
                    value={formData.email || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (formErrors.email) {
                        setFormErrors({ ...formErrors, email: '' });
                      }
                    }}
                    placeholder="Email"
                    required
                  />
                  {formErrors.email && (
                    <div className="invalid-feedback">{formErrors.email}</div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingAgent(null);
                      resetForm();
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={addAgentMutation.isPending || updateAgentMutation.isPending}
                  >
                    {(addAgentMutation.isPending || updateAgentMutation.isPending) ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        {editingAgent ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>
                        {editingAgent ? 'Update' : 'Save'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

