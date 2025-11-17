import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { config } from '../../utils/config';
import Swal from 'sweetalert2';
import staffService from '../../services/staffService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { Staff, CreateStaffRequest, UpdateStaffRequest } from '../../types/staff';
import './StaffManagement.css';

export default function StaffManagement() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  
  const [formData, setFormData] = useState<Partial<CreateStaffRequest>>({
    staff_name: '',
    staff_phone: '',
    staff_email: '',
    staff_address: '',
    branch_id: undefined,
    role_id: undefined,
    salary: 0,
    currency_id: undefined,
    status: 1,
    password: '',
    photo: undefined
  });
  
  const [editFormData, setEditFormData] = useState<Partial<UpdateStaffRequest>>({
    staff_id: 0,
    staff_name: '',
    staff_phone: '',
    staff_email: '',
    staff_address: '',
    branch_id: undefined,
    role_id: undefined,
    salary: 0,
    currency_id: undefined,
    status: 1,
    password: '',
    photo: undefined
  });
  
  // Fetch staff
  const { data: staff = [], isLoading } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: () => staffService.getStaff(),
    staleTime: 0,  // Always fetch fresh data to show updated photos
    refetchOnWindowFocus: true
  });
  
  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => staffService.getBranches(),
    staleTime: 300000
  });
  
  // Fetch roles
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => staffService.getRoles(),
    staleTime: 300000
  });
  
  // Fetch currencies
  const { data: currencies = [] } = useQuery({
    queryKey: ['currencies-staff'],
    queryFn: () => staffService.getCurrencies(),
    staleTime: 300000
  });
  
  // Auto-set currency when currencies load
  useEffect(() => {
    if (currencies.length > 0) {
      setFormData(prev => {
        if (!prev.currency_id) {
          return {
            ...prev,
            currency_id: currencies[0].currencyID
          };
        }
        return prev;
      });
    }
  }, [currencies.length]);
  
  // Add staff mutation
  const addStaffMutation = useMutation({
    mutationFn: (data: CreateStaffRequest) => staffService.addStaff(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Staff added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      setShowAddModal(false);
      resetForm();
      // Force image refresh with new timestamp
      setImageRefreshKey(Date.now());
      // Refetch staff data
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to add staff'
      });
    }
  });
  
  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: (data: UpdateStaffRequest) => staffService.updateStaff(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Staff updated successfully',
        timer: 1500,
        showConfirmButton: false
      });
      setShowEditModal(false);
      resetEditForm();
      // Force image refresh with new timestamp
      setImageRefreshKey(Date.now());
      // Refetch staff data to show new photo
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.refetchQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to update staff'
      });
    }
  });
  
  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: (staffId: number) => staffService.deleteStaff(staffId),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Staff deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to delete staff'
      });
    }
  });
  
  const resetForm = () => {
    setFormData({
      staff_name: '',
      staff_phone: '',
      staff_email: '',
      staff_address: '',
      branch_id: undefined,
      role_id: undefined,
      salary: 0,
      currency_id: currencies.length > 0 ? currencies[0].currencyID : undefined,
      status: 1,
      password: '',
      photo: undefined
    });
    setPhotoPreview(null);
  };
  
  const resetEditForm = () => {
    setEditFormData({
      staff_id: 0,
      staff_name: '',
      staff_phone: '',
      staff_email: '',
      staff_address: '',
      branch_id: undefined,
      role_id: undefined,
      salary: 0,
      currency_id: undefined,
      status: 1,
      password: '',
      photo: undefined
    });
    setEditPhotoPreview(null);
    setSelectedStaff(null);
  };
  
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2097152) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large!',
          text: 'File size must be less than 2 MB'
        });
        e.target.value = '';
        return;
      }
      setFormData({ ...formData, photo: file });
      setPhotoPreview(URL.createObjectURL(file));
    }
  };
  
  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2097152) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large!',
          text: 'File size must be less than 2 MB'
        });
        e.target.value = '';
        return;
      }
      setEditFormData({ ...editFormData, photo: file });
      setEditPhotoPreview(URL.createObjectURL(file));
    }
  };
  
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.staff_name || formData.staff_name.trim() === '') {
      Swal.fire('Validation Error!', 'Staff name is required', 'error');
      return;
    }
    if (!formData.staff_phone || formData.staff_phone.trim() === '') {
      Swal.fire('Validation Error!', 'Phone is required', 'error');
      return;
    }
    if (!formData.staff_email || formData.staff_email.trim() === '') {
      Swal.fire('Validation Error!', 'Email is required', 'error');
      return;
    }
    if (!formData.staff_address || formData.staff_address.trim() === '') {
      Swal.fire('Validation Error!', 'Address is required', 'error');
      return;
    }
    if (!formData.branch_id || formData.branch_id === -1) {
      Swal.fire('Validation Error!', 'Branch is required', 'error');
      return;
    }
    if (!formData.role_id || formData.role_id === -1) {
      Swal.fire('Validation Error!', 'Role is required', 'error');
      return;
    }
    if (!formData.salary || formData.salary <= 0) {
      Swal.fire('Validation Error!', 'Salary is required', 'error');
      return;
    }
    if (!formData.currency_id) {
      Swal.fire('Validation Error!', 'Currency is required', 'error');
      return;
    }
    if (!formData.password || formData.password.trim() === '') {
      Swal.fire('Validation Error!', 'Password is required', 'error');
      return;
    }
    
    // Prepare data with proper types
    const submitData: CreateStaffRequest = {
      staff_name: formData.staff_name!,
      staff_phone: formData.staff_phone!,
      staff_email: formData.staff_email!,
      staff_address: formData.staff_address!,
      branch_id: formData.branch_id!,
      role_id: formData.role_id!,
      salary: formData.salary!,
      currency_id: formData.currency_id!,
      status: formData.status!,
      password: formData.password!,
      photo: formData.photo
    };
    
    addStaffMutation.mutate(submitData);
  };
  
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.staff_name || String(editFormData.staff_name).trim() === '') {
      Swal.fire('Validation Error!', 'Staff name is required', 'error');
      return;
    }
    if (!editFormData.staff_phone || String(editFormData.staff_phone).trim() === '') {
      Swal.fire('Validation Error!', 'Phone is required', 'error');
      return;
    }
    if (!editFormData.staff_email || String(editFormData.staff_email).trim() === '') {
      Swal.fire('Validation Error!', 'Email is required', 'error');
      return;
    }
    if (!editFormData.staff_address || String(editFormData.staff_address).trim() === '') {
      Swal.fire('Validation Error!', 'Address is required', 'error');
      return;
    }
    if (!editFormData.branch_id || editFormData.branch_id === -1) {
      Swal.fire('Validation Error!', 'Branch is required', 'error');
      return;
    }
    if (!editFormData.role_id || editFormData.role_id === -1) {
      Swal.fire('Validation Error!', 'Role is required', 'error');
      return;
    }
    if (!editFormData.salary || editFormData.salary <= 0) {
      Swal.fire('Validation Error!', 'Salary is required', 'error');
      return;
    }
    if (!editFormData.currency_id) {
      Swal.fire('Validation Error!', 'Currency is required', 'error');
      return;
    }
    
    // Prepare data with proper types
    const submitData: UpdateStaffRequest = {
      staff_id: editFormData.staff_id!,
      staff_name: String(editFormData.staff_name!),
      staff_phone: String(editFormData.staff_phone!),
      staff_email: String(editFormData.staff_email!),
      staff_address: String(editFormData.staff_address!),
      branch_id: editFormData.branch_id!,
      role_id: editFormData.role_id!,
      salary: editFormData.salary!,
      currency_id: editFormData.currency_id!,
      status: editFormData.status!,
      password: editFormData.password ? String(editFormData.password) : undefined,
      photo: editFormData.photo
    };
    
    updateStaffMutation.mutate(submitData);
  };
  
  const handleEdit = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setEditFormData({
      staff_id: staffMember.staff_id,
      staff_name: staffMember.staff_name,
      staff_phone: staffMember.staff_phone,
      staff_email: staffMember.staff_email,
      staff_address: staffMember.staff_address,
      branch_id: staffMember.Branch_ID,
      role_id: staffMember.role_id,
      salary: staffMember.salary,
      currency_id: staffMember.currencyID,
      status: staffMember.status,
      password: '',
      photo: undefined
    });
    setEditPhotoPreview(staffMember.staff_pic ? `${config.baseUrl}/${staffMember.staff_pic}` : null);
    setShowEditModal(true);
  };
  
  const handleDelete = (staffId: number, staffName: string) => {
    Swal.fire({
      title: 'Delete!',
      text: `Do you want to delete ${staffName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteStaffMutation.mutate(staffId);
      }
    });
  };
  
  if (isLoading) {
    return (
      <div className="staff-management-page">
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="staff-management-page">
      <div className="page-header">
        <h2>
          <i className="fa fa-user me-2"></i>
          <i>Staff Report</i>
        </h2>
      </div>
      
      <div className="card">
        <div className="card-header">
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <i className="fa fa-plus me-2"></i>Add Employee
            </button>
          </div>
        </div>
        
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>S#</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Salary</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Branch</th>
                  <th>Photo</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center">No staff found</td>
                  </tr>
                ) : (
                  staff.map((staffMember, index) => (
                    <tr key={staffMember.staff_id}>
                      <td>{index + 1}</td>
                      <td className="text-capitalize">{staffMember.staff_name}</td>
                      <td>{staffMember.staff_phone}</td>
                      <td>{staffMember.staff_email}</td>
                      <td>{staffMember.staff_address}</td>
                      <td>{staffMember.salary} {staffMember.currencyName}</td>
                      <td>{staffMember.role_name}</td>
                      <td>
                        <span className={`badge ${staffMember.status === 1 ? 'badge-success' : 'badge-secondary'}`}>
                          {staffMember.status_text}
                        </span>
                      </td>
                      <td>{staffMember.Branch_Name}</td>
                      <td>
                        {staffMember.staff_pic ? (
                          <img 
                            key={`staff-photo-${staffMember.staff_id}-${imageRefreshKey}`}
                            src={`${config.baseUrl}/${staffMember.staff_pic}?v=${imageRefreshKey}`} 
                            alt="Staff" 
                            className="staff-photo"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAiIGhlaWdodD0iNzAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjcwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjZjhmYWZjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTAiIGZpbGw9IiM5NGEzYjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                              img.style.display = 'block';
                            }}
                          />
                        ) : (
                          <span className="text-muted" style={{ fontSize: '12px' }}>No Image</span>
                        )}
                      </td>
                      <td className="action-cell">
                        <button
                          className="btn btn-sm btn-outline-dark me-2"
                          onClick={() => handleEdit(staffMember)}
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(staffMember.staff_id, staffMember.staff_name)}
                        >
                          <i className="fa fa-trash"></i>
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
      
      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i>Add Staff</i>
              </h5>
              <button className="btn-close" onClick={() => { setShowAddModal(false); resetForm(); }}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddSubmit}>
                <div className="form-group row">
                  <label className="col-form-label">Employee Name:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={formData.staff_name}
                      onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                      placeholder="Employee Name"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Phone:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={formData.staff_phone}
                      onChange={(e) => setFormData({ ...formData, staff_phone: e.target.value })}
                      placeholder="Employee Phone"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Email:</label>
                  <div className="col-sm-9">
                    <input
                      type="email"
                      className="form-control"
                      value={formData.staff_email}
                      onChange={(e) => setFormData({ ...formData, staff_email: e.target.value })}
                      placeholder="Employee Email"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Address:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={formData.staff_address}
                      onChange={(e) => setFormData({ ...formData, staff_address: e.target.value })}
                      placeholder="Employee Address"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Branch:</label>
                  <div className="col-sm-9">
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Branch--' },
                        ...branches.map(b => ({
                          value: String(b.Branch_ID),
                          label: b.Branch_Name
                        }))
                      ]}
                      value={formData.branch_id ? String(formData.branch_id) : ''}
                      onChange={(value) => {
                        const branchId = value && value !== '-1' ? Number(value) : undefined;
                        setFormData({ ...formData, branch_id: branchId });
                      }}
                      placeholder="Select Branch"
                    />
                  </div>
                </div>
                
                <div className="form-group row salary-row">
                  <label className="col-form-label">Salary:</label>
                  <div className="col-lg-6">
                    <input
                      type="number"
                      className="form-control"
                      value={formData.salary || ''}
                      onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                      placeholder="Employee Salary"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-lg-3">
                    <SearchableSelect
                      options={currencies.map(c => ({
                        value: String(c.currencyID),
                        label: c.currencyName
                      }))}
                      value={formData.currency_id ? String(formData.currency_id) : ''}
                      onChange={(value) => {
                        const currencyId = value ? Number(value) : undefined;
                        setFormData({ ...formData, currency_id: currencyId });
                      }}
                      placeholder="Currency"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Role:</label>
                  <div className="col-sm-9">
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Role--' },
                        ...roles.map(r => ({
                          value: String(r.role_id),
                          label: r.role_name
                        }))
                      ]}
                      value={formData.role_id ? String(formData.role_id) : ''}
                      onChange={(value) => {
                        const roleId = value && value !== '-1' ? Number(value) : undefined;
                        setFormData({ ...formData, role_id: roleId });
                      }}
                      placeholder="Select Role"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Status:</label>
                  <div className="col-sm-9">
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: Number(e.target.value) })}
                    >
                      <option value="1">Active</option>
                      <option value="2">Deactive</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Password:</label>
                  <div className="col-sm-9">
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Employee Password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Photo:</label>
                  <div className="col-sm-9">
                    <input
                      type="file"
                      className="form-control"
                      onChange={handlePhotoChange}
                      accept="image/*"
                    />
                    {photoPreview && (
                      <img src={photoPreview} alt="Preview" className="photo-preview mt-2" />
                    )}
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addStaffMutation.isPending}
                  >
                    {addStaffMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-1"></i> Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Staff Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); resetEditForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i>Update Staff</i>
              </h5>
              <button className="btn-close" onClick={() => { setShowEditModal(false); resetEditForm(); }}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditSubmit}>
                <div className="form-group row">
                  <label className="col-form-label">Employee Name:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.staff_name}
                      onChange={(e) => setEditFormData({ ...editFormData, staff_name: e.target.value })}
                      placeholder="Employee Name"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Phone:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.staff_phone}
                      onChange={(e) => setEditFormData({ ...editFormData, staff_phone: e.target.value })}
                      placeholder="Employee Phone"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Email:</label>
                  <div className="col-sm-9">
                    <input
                      type="email"
                      className="form-control"
                      value={editFormData.staff_email}
                      onChange={(e) => setEditFormData({ ...editFormData, staff_email: e.target.value })}
                      placeholder="Employee Email"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Address:</label>
                  <div className="col-sm-9">
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.staff_address}
                      onChange={(e) => setEditFormData({ ...editFormData, staff_address: e.target.value })}
                      placeholder="Employee Address"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Branch:</label>
                  <div className="col-sm-9">
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Branch--' },
                        ...branches.map(b => ({
                          value: String(b.Branch_ID),
                          label: b.Branch_Name
                        }))
                      ]}
                      value={editFormData.branch_id ? String(editFormData.branch_id) : ''}
                      onChange={(value) => setEditFormData({ ...editFormData, branch_id: value ? Number(value) : undefined })}
                      placeholder="Select Branch"
                    />
                  </div>
                </div>
                
                <div className="form-group row salary-row">
                  <label className="col-form-label">Salary:</label>
                  <div className="col-lg-6">
                    <input
                      type="number"
                      className="form-control"
                      value={editFormData.salary || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, salary: Number(e.target.value) })}
                      placeholder="Employee Salary"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-lg-3">
                    <SearchableSelect
                      options={currencies.map(c => ({
                        value: String(c.currencyID),
                        label: c.currencyName
                      }))}
                      value={editFormData.currency_id ? String(editFormData.currency_id) : ''}
                      onChange={(value) => setEditFormData({ ...editFormData, currency_id: value ? Number(value) : undefined })}
                      placeholder="Currency"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Role:</label>
                  <div className="col-sm-9">
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Role--' },
                        ...roles.map(r => ({
                          value: String(r.role_id),
                          label: r.role_name
                        }))
                      ]}
                      value={editFormData.role_id ? String(editFormData.role_id) : ''}
                      onChange={(value) => setEditFormData({ ...editFormData, role_id: value ? Number(value) : undefined })}
                      placeholder="Select Role"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Status:</label>
                  <div className="col-sm-9">
                    <select
                      className="form-control"
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: Number(e.target.value) })}
                    >
                      <option value="1">Active</option>
                      <option value="2">Deactive</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Password:</label>
                  <div className="col-sm-9">
                    <input
                      type="password"
                      className="form-control"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                      placeholder="Leave blank to keep current password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                
                <div className="form-group row">
                  <label className="col-form-label">Photo:</label>
                  <div className="col-sm-9">
                    <input
                      type="file"
                      className="form-control"
                      onChange={handleEditPhotoChange}
                      accept="image/*"
                    />
                    {editPhotoPreview && (
                      <img src={editPhotoPreview} alt="Preview" className="photo-preview mt-2" />
                    )}
                  </div>
                </div>
                
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setShowEditModal(false); resetEditForm(); }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateStaffMutation.isPending}
                  >
                    {updateStaffMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-1"></i> Saving...
                      </>
                    ) : (
                      'Save'
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

