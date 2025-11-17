import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import './PermissionManagement.css';

interface Role {
  role_id: number;
  role_name: string;
}

interface Permission {
  page_name: string;
  select: number;
  insert: number;
  update: number;
  delete: number;
}

const PAGE_NAMES = [
  'Dashboard',
  'Ticket',
  'Visa',
  'Loan',
  'Hotel',
  'Rental Car',
  'Hawala',
  'Supplier',
  'Expense',
  'Customer',
  'Residence',
  'Service',
  'Staff',
  'Role',
  'Permission',
  'Customer Ledger',
  'Supplier Ledger',
  'Customer Payment',
  'Supplier Payment',
  'Customer Visa Prices',
  'Supplier Visa Prices',
  'Salary',
  'Accounts',
  'Deposit',
  'Cheques',
  'Currency',
  'Company Documents',
  'Pending Tasks',
  'Reminder'
];

export default function PermissionManagement() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [permissions, setPermissions] = useState<{ [key: string]: Permission }>({});
  
  // Initialize permissions
  useEffect(() => {
    const initialPermissions: { [key: string]: Permission } = {};
    PAGE_NAMES.forEach(pageName => {
      initialPermissions[pageName] = {
        page_name: pageName,
        select: 0,
        insert: 0,
        update: 0,
        delete: 0
      };
    });
    setPermissions(initialPermissions);
  }, []);
  
  // Fetch roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles-permissions'],
    queryFn: async () => {
      const response = await apiClient.post('/permission/permissions.php', {
        action: 'getRoles'
      });
      return response.data.success ? response.data.data : [];
    },
    staleTime: 30000
  });
  
  // Fetch permissions for selected role
  const { data: rolePermissions = [] } = useQuery<Permission[]>({
    queryKey: ['permissions', selectedRole],
    queryFn: async () => {
      const response = await apiClient.post('/permission/permissions.php', {
        action: 'getPermissions',
        role_id: selectedRole
      });
      return response.data.success ? response.data.data : [];
    },
    enabled: !!selectedRole,
    staleTime: 10000
  });
  
  // Update permissions when role permissions are loaded
  useEffect(() => {
    if (rolePermissions.length > 0) {
      const updatedPermissions: { [key: string]: Permission } = {};
      rolePermissions.forEach(perm => {
        updatedPermissions[perm.page_name] = perm;
      });
      
      // Merge with all page names to ensure all pages are shown
      PAGE_NAMES.forEach(pageName => {
        if (!updatedPermissions[pageName]) {
          updatedPermissions[pageName] = {
            page_name: pageName,
            select: 0,
            insert: 0,
            update: 0,
            delete: 0
          };
        }
      });
      
      setPermissions(updatedPermissions);
    }
  }, [rolePermissions]);
  
  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async (data: { role_id: number; permissions: Permission[] }) => {
      const response = await apiClient.post('/permission/permissions.php', {
        action: 'savePermissions',
        role_id: data.role_id,
        permissions: data.permissions
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to save permissions');
      }
    },
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Permissions saved successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to save permissions'
      });
    }
  });
  
  const handleCheckboxChange = (pageName: string, field: 'select' | 'insert' | 'update' | 'delete', value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [pageName]: {
        ...prev[pageName],
        [field]: value ? 1 : 0
      }
    }));
  };
  
  const handleSelectAll = () => {
    const updatedPermissions: { [key: string]: Permission } = {};
    Object.keys(permissions).forEach(pageName => {
      updatedPermissions[pageName] = {
        page_name: pageName,
        select: 1,
        insert: 1,
        update: 1,
        delete: 1
      };
    });
    setPermissions(updatedPermissions);
  };
  
  const handleSave = () => {
    if (!selectedRole) {
      Swal.fire('Validation Error!', 'Please select a role', 'error');
      return;
    }
    
    const permissionsArray = Object.values(permissions);
    savePermissionsMutation.mutate({
      role_id: Number(selectedRole),
      permissions: permissionsArray
    });
  };
  
  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
    // Reset permissions when role changes
    if (!value) {
      const initialPermissions: { [key: string]: Permission } = {};
      PAGE_NAMES.forEach(pageName => {
        initialPermissions[pageName] = {
          page_name: pageName,
          select: 0,
          insert: 0,
          update: 0,
          delete: 0
        };
      });
      setPermissions(initialPermissions);
    }
  };
  
  return (
    <div className="permission-management-page">
      <div className="card">
        <div className="card-header">
          <h1 className="text-center">
            <i>Permission</i>
          </h1>
        </div>
        <div className="card-body">
          <div className="filter-row">
            <div className="select-role">
              <SearchableSelect
                options={[
                  { value: '', label: '--Select Role--' },
                  ...roles.map(r => ({
                    value: String(r.role_id),
                    label: r.role_name
                  }))
                ]}
                value={selectedRole}
                onChange={handleRoleChange}
                placeholder="Select Role"
              />
            </div>
            <div className="button-group">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleSelectAll}
                disabled={!selectedRole}
              >
                Select All
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!selectedRole || savePermissionsMutation.isPending}
              >
                {savePermissionsMutation.isPending ? (
                  <>
                    <i className="fa fa-spinner fa-spin me-1"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="fa fa-save me-1"></i> Save Permissions
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="table-section">
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>S#</th>
                    <th>Page Name</th>
                    <th>Select</th>
                    <th>Insert</th>
                    <th>Update</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGE_NAMES.map((pageName, index) => {
                    const perm = permissions[pageName] || {
                      page_name: pageName,
                      select: 0,
                      insert: 0,
                      update: 0,
                      delete: 0
                    };
                    
                    // Dashboard only has select permission
                    const isDashboard = pageName === 'Dashboard';
                    
                    return (
                      <tr key={pageName}>
                        <th scope="row">{index + 1}</th>
                        <td>{pageName}</td>
                        <td>
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={perm.select === 1}
                              onChange={(e) => handleCheckboxChange(pageName, 'select', e.target.checked)}
                              disabled={!selectedRole}
                            />
                          </div>
                        </td>
                        <td>
                          <div className={`form-check ${isDashboard ? 'hidden' : ''}`}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={perm.insert === 1}
                              onChange={(e) => handleCheckboxChange(pageName, 'insert', e.target.checked)}
                              disabled={!selectedRole || isDashboard}
                            />
                          </div>
                        </td>
                        <td>
                          <div className={`form-check ${isDashboard ? 'hidden' : ''}`}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={perm.update === 1}
                              onChange={(e) => handleCheckboxChange(pageName, 'update', e.target.checked)}
                              disabled={!selectedRole || isDashboard}
                            />
                          </div>
                        </td>
                        <td>
                          <div className={`form-check ${isDashboard ? 'hidden' : ''}`}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={perm.delete === 1}
                              onChange={(e) => handleCheckboxChange(pageName, 'delete', e.target.checked)}
                              disabled={!selectedRole || isDashboard}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



