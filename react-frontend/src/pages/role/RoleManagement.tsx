import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import apiClient from '../../services/api';
import './RoleManagement.css';

interface Role {
  role_id: number;
  role_name: string;
}

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState('');
  
  // Fetch roles
  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles-management'],
    queryFn: async () => {
      const response = await apiClient.post('/role/roles.php', {
        action: 'getRoles'
      });
      return response.data.success ? response.data.data : [];
    },
    staleTime: 30000
  });
  
  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async (role_name: string) => {
      const response = await apiClient.post('/role/roles.php', {
        action: 'addRole',
        role_name
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to add role');
      }
    },
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Role added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      setRoleName('');
      queryClient.invalidateQueries({ queryKey: ['roles-management'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to add role'
      });
    }
  });
  
  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (role_id: number) => {
      const response = await apiClient.post('/role/roles.php', {
        action: 'deleteRole',
        role_id
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to delete role');
      }
    },
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Role deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['roles-management'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to delete role'
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roleName || roleName.trim() === '') {
      Swal.fire('Validation Error!', 'Role name is required', 'error');
      return;
    }
    
    addRoleMutation.mutate(roleName);
  };
  
  const handleDelete = (role_id: number, role_name: string) => {
    Swal.fire({
      title: 'Delete!',
      text: `Do you want to delete role "${role_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteRoleMutation.mutate(role_id);
      }
    });
  };
  
  if (isLoading) {
    return (
      <div className="role-management-page">
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="role-management-page">
      <div className="card">
        <div className="card-header">
          <h1 className="text-center">
            <i>Role</i>
          </h1>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <div className="input-group-prepend">
                  <span className="input-group-text">
                    <i className="fa fa-user"></i>
                  </span>
                </div>
                <input
                  type="text"
                  className="form-control"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Role Name"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-dark"
                disabled={addRoleMutation.isPending}
              >
                {addRoleMutation.isPending ? (
                  <>
                    <i className="fa fa-spinner fa-spin me-1"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="fa fa-plus me-1"></i> Save
                  </>
                )}
              </button>
            </div>
          </form>
          
          <div className="table-section">
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>S#</th>
                    <th>Role ID</th>
                    <th>Role Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center">No roles found</td>
                    </tr>
                  ) : (
                    roles.map((role, index) => (
                      <tr key={role.role_id}>
                        <th scope="row">{index + 1}</th>
                        <td className="text-capitalize">{role.role_id}</td>
                        <td className="text-capitalize">{role.role_name}</td>
                        <td>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleDelete(role.role_id, role.role_name)}
                          >
                            <i className="fa fa-trash text-danger fa-2x"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



