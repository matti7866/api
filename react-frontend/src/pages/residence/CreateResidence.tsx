import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import residenceService from '../../services/residenceService';
import Swal from 'sweetalert2';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import './CreateResidence.css';

interface FormData {
  // Step 1: Basic Information
  customer_id: number | null;
  insideOutside: string;
  res_type: string;
  uid: string;
  salary_amount: number | null;
  position: number | null;
  sale_amount: number | null;
  sale_currency_type: number | null;
  tawjeeh_included: boolean;
  insurance_included: boolean;
  
  // Step 2: Passport Information
  passengerName: string;
  nationality: number | null;
  passportNumber: string;
  passportExpiryDate: string;
  gender: string;
  dob: string;
  
  // Files
  passportFile: File | null;
  photoFile: File | null;
  emiratesIdFrontFile: File | null;
  emiratesIdBackFile: File | null;
}

export default function CreateResidence() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    customer_id: null,
    insideOutside: '',
    res_type: 'mainland',
    uid: '',
    salary_amount: null,
    position: null,
    sale_amount: null,
    sale_currency_type: null,
    tawjeeh_included: false,
    insurance_included: false,
    passengerName: '',
    nationality: null,
    passportNumber: '',
    passportExpiryDate: '',
    gender: '',
    dob: '',
    passportFile: null,
    photoFile: null,
    emiratesIdFrontFile: null,
    emiratesIdBackFile: null,
  });

  const [lookups, setLookups] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLookups();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  const loadLookups = async () => {
    try {
      const data = await residenceService.getLookups();
      setLookups(data);
    } catch (err: any) {
      Swal.fire('Error', 'Failed to load form data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: 'passportFile' | 'photoFile' | 'emiratesIdFrontFile' | 'emiratesIdBackFile', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validateStep1 = (): boolean => {
    if (!formData.customer_id) {
      Swal.fire('Validation Error', 'Please select a customer', 'error');
      return false;
    }
    if (!formData.insideOutside) {
      Swal.fire('Validation Error', 'Please select Inside/Outside', 'error');
      return false;
    }
    if (formData.insideOutside === 'Inside' && !formData.uid.trim()) {
      Swal.fire('Validation Error', 'UID is required for Inside passengers', 'error');
      return false;
    }
    if (!formData.salary_amount || formData.salary_amount <= 0) {
      Swal.fire('Validation Error', 'Please enter a valid salary amount', 'error');
      return false;
    }
    if (!formData.sale_amount || formData.sale_amount <= 0) {
      Swal.fire('Validation Error', 'Please enter a valid sale amount', 'error');
      return false;
    }
    if (!formData.sale_currency_type) {
      Swal.fire('Validation Error', 'Please select currency', 'error');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!formData.passportFile) {
      Swal.fire('Validation Error', 'Please upload passport document', 'error');
      return false;
    }
    if (!formData.photoFile) {
      Swal.fire('Validation Error', 'Please upload passport photo', 'error');
      return false;
    }
    if (!formData.passengerName.trim()) {
      Swal.fire('Validation Error', 'Passenger name is required', 'error');
      return false;
    }
    if (!formData.nationality) {
      Swal.fire('Validation Error', 'Please select nationality', 'error');
      return false;
    }
    if (!formData.passportNumber.trim()) {
      Swal.fire('Validation Error', 'Passport number is required', 'error');
      return false;
    }
    if (!formData.passportExpiryDate) {
      Swal.fire('Validation Error', 'Passport expiry date is required', 'error');
      return false;
    }
    if (!formData.gender) {
      Swal.fire('Validation Error', 'Please select gender', 'error');
      return false;
    }
    if (!formData.dob) {
      Swal.fire('Validation Error', 'Date of birth is required', 'error');
      return false;
    }
    return true;
  };

  const nextStep = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (currentStep === 1) {
      if (!validateStep1()) return;
    } else if (currentStep === 2) {
      if (!validateStep2()) return;
    }
    // Don't submit form, just move to next step
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep2()) return;

    setSaving(true);

    try {
      const submitData: any = {
        customer_id: formData.customer_id,
        passengerName: formData.passengerName,
        nationality: formData.nationality,
        passportNumber: formData.passportNumber,
        passportExpiryDate: formData.passportExpiryDate,
        gender: formData.gender,
        dob: formData.dob,
        visaType: 17, // Residence visa type
        sale_amount: formData.sale_amount,
        sale_currency_type: formData.sale_currency_type,
        insideOutside: formData.insideOutside,
        uid: formData.uid || null,
        salary_amount: formData.salary_amount,
        position: formData.position || 0,
        res_type: formData.res_type,
        tawjeeh_included: formData.tawjeeh_included ? 1 : 0,
        insurance_included: formData.insurance_included ? 1 : 0,
        passportFile: formData.passportFile,
        photoFile: formData.photoFile,
        emiratesIdFrontFile: formData.emiratesIdFrontFile,
        emiratesIdBackFile: formData.emiratesIdBackFile,
      };

      const response = await residenceService.createResidence(submitData);
      
      Swal.fire({
        title: 'Residence Created Successfully!',
        html: `<div class="alert alert-success">
                <strong>New Residence ID: ${response.data?.residenceID}</strong><br>
                Basic information has been saved. What would you like to do next?
              </div>`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Continue Editing',
        cancelButtonText: 'Stay in Report',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#10b981',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate(`/residence/${response.data?.residenceID}`);
        } else {
          navigate('/residence');
        }
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'An error occurred while creating residence';
      
      // Handle duplicate error
      if (errorMsg.includes('DUPLICATE_ACTIVE')) {
        const parts = errorMsg.split('|');
        const existingId = parts[1];
        const existingName = parts[2];
        Swal.fire({
          title: 'Duplicate Record',
          html: `A residence record already exists for this passport:<br><strong>${existingName}</strong> (ID: ${existingId})`,
          icon: 'warning',
          confirmButtonText: 'OK'
        });
      } else {
        Swal.fire('Error', errorMsg, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customerSearch
    ? (lookups?.customers && Array.isArray(lookups.customers) ? lookups.customers.filter((c: any) => 
        c.customer_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.customer_phone?.includes(customerSearch) ||
        c.customer_email?.toLowerCase().includes(customerSearch.toLowerCase())
      ) : [])
    : (lookups?.customers && Array.isArray(lookups.customers) ? lookups.customers : []);

  const getSelectedCustomer = () => {
    if (!formData.customer_id) return null;
    return filteredCustomers && Array.isArray(filteredCustomers)
      ? filteredCustomers.find((c: any) => c.customer_id === formData.customer_id)
      : null;
  };

  const getSelectedCustomerDisplay = () => {
    const customer = getSelectedCustomer();
    if (!customer) return 'Select Customer';
    return customer.customer_phone 
      ? `${customer.customer_name} - ${customer.customer_phone}`
      : customer.customer_name;
  };

  const getSelectedNationality = () => {
    return lookups?.nationalities && Array.isArray(lookups.nationalities)
      ? lookups.nationalities.find((n: any) => n.nationality_id === formData.nationality)
      : null;
  };

  const getSelectedCurrency = () => {
    return lookups?.currencies && Array.isArray(lookups.currencies)
      ? lookups.currencies.find((c: any) => c.currencyID === formData.sale_currency_type)
      : null;
  };

  const getSelectedPosition = () => {
    return lookups?.positions && Array.isArray(lookups.positions)
      ? lookups.positions.find((p: any) => p.position_id === formData.position)
      : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const progressWidth = (currentStep / 3) * 100;
  const stepTitles = {
    1: 'Step 1: Basic Information',
    2: 'Step 2: Documents & Passport',
    3: 'Step 3: Confirmation'
  };

  return (
    <div className="create-residence-page">
      <div className="container-fluid p-4">
        <div className="card bg-gray-800 border-0">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <i className="fa fa-plus-circle me-2"></i>
              Add New Residence - <span id="modalStepTitle">{stepTitles[currentStep as keyof typeof stepTitles]}</span>
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={() => navigate('/residence')}
              aria-label="Close"
            ></button>
          </div>

          {/* Progress Bar */}
          <div className="progress" style={{ height: '4px', borderRadius: 0 }}>
            <div
              className="progress-bar bg-primary"
              role="progressbar"
              style={{ width: `${progressWidth}%` }}
            ></div>
          </div>

          <form 
            id="addResidenceForm" 
            onSubmit={(e) => {
              // Only allow form submission on Step 3 when user explicitly clicks "Create Residence"
              if (currentStep !== 3) {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }
              handleSubmit(e);
            }}
          >
            <div className="card-body p-4">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="modal-step">
                  <div className="alert alert-info">
                    <i className="fa fa-info-circle me-2"></i>
                    <strong>Step 1:</strong> Fill in the basic customer and financial information.
                  </div>

                  {/* Customer Selection */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Customer <span className="text-danger">*</span>
                      </label>
                      <div className="position-relative" ref={customerDropdownRef}>
                        <div
                          className="form-select"
                          onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          {getSelectedCustomerDisplay()}
                        </div>
                        {showCustomerDropdown && (
                          <div 
                            className="position-absolute w-100 bg-white border rounded mt-1 shadow-lg"
                            style={{ 
                              zIndex: 1000, 
                              maxHeight: '300px', 
                              overflow: 'hidden',
                              borderColor: '#d1d5db',
                              backgroundColor: '#ffffff'
                            }}
                          >
                            <div className="p-2 border-bottom" style={{ borderColor: '#e5e7eb' }}>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Search customer..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                autoFocus
                                style={{ backgroundColor: '#ffffff', color: '#2d353c' }}
                              />
                            </div>
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                              {filteredCustomers && Array.isArray(filteredCustomers) && filteredCustomers.length > 0 ? (
                                filteredCustomers.map((c: any) => (
                                  <div
                                    key={c.customer_id}
                                    className="px-3 py-2 cursor-pointer"
                                    style={{
                                      cursor: 'pointer',
                                      backgroundColor: formData.customer_id === c.customer_id ? '#e3f2fd' : 'transparent'
                                    }}
                                    onClick={() => {
                                      handleChange('customer_id', c.customer_id);
                                      setShowCustomerDropdown(false);
                                      setCustomerSearch('');
                                    }}
                                    onMouseEnter={(e) => {
                                      if (formData.customer_id !== c.customer_id) {
                                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (formData.customer_id !== c.customer_id) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                      }
                                    }}
                                  >
                                    <div className="fw-semibold" style={{ color: '#2d353c' }}>{c.customer_name}</div>
                                    {c.customer_phone && (
                                      <div className="text-muted small" style={{ fontSize: '11px' }}>{c.customer_phone}</div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-muted text-center">No customers found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">
                        Inside/Outside <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.insideOutside}
                        onChange={(e) => {
                          handleChange('insideOutside', e.target.value);
                          if (e.target.value !== 'Inside') {
                            handleChange('uid', '');
                          }
                        }}
                        required
                      >
                        <option value="">Choose</option>
                        <option value="Inside">Inside</option>
                        <option value="Outside">Outside</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">
                        Residence Type <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.res_type}
                        onChange={(e) => handleChange('res_type', e.target.value)}
                        required
                      >
                        <option value="mainland">Mainland</option>
                        <option value="freezone">Freezone</option>
                      </select>
                    </div>
                  </div>

                  {/* Basic Details */}
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <label className="form-label">
                        UID {formData.insideOutside === 'Inside' && <span className="text-danger">*</span>}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.uid}
                        onChange={(e) => handleChange('uid', e.target.value)}
                        placeholder={formData.insideOutside === 'Inside' ? 'Enter UID (Required)' : 'UID (Optional)'}
                        required={formData.insideOutside === 'Inside'}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">
                        Salary Amount <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.salary_amount || ''}
                        onChange={(e) => handleChange('salary_amount', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Enter Salary Amount"
                        required
                        min="1"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Position</label>
                      <select
                        className="form-select"
                        value={formData.position || ''}
                        onChange={(e) => handleChange('position', e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">Select Position</option>
                        {lookups?.positions && Array.isArray(lookups.positions) && lookups.positions.map((p: any) => (
                          <option key={p.position_id} value={p.position_id}>
                            {p.position_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">
                        Sale Price <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.sale_amount || ''}
                        onChange={(e) => handleChange('sale_amount', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Enter Sale Amount"
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Currency and Charges */}
                  <div className="row mb-3">
                    <div className="col-md-4">
                      <label className="form-label">
                        Currency <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.sale_currency_type || ''}
                        onChange={(e) => handleChange('sale_currency_type', e.target.value ? parseInt(e.target.value) : null)}
                        required
                      >
                        <option value="">Select Currency</option>
                        {lookups?.currencies && Array.isArray(lookups.currencies) && lookups.currencies.map((c: any) => (
                          <option key={c.currencyID} value={c.currencyID}>
                            {c.currencyName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-8">
                      <label className="form-label fw-bold">
                        <i className="fa fa-money-bill me-2"></i>Additional Charges Configuration
                      </label>
                      <div className="card border-primary">
                        <div className="card-body">
                          <div className="row">
                            <div className="col-md-6">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={formData.tawjeeh_included}
                                  onChange={(e) => handleChange('tawjeeh_included', e.target.checked)}
                                  id="tawjeehIncluded"
                                />
                                <label className="form-check-label fw-bold text-primary" htmlFor="tawjeehIncluded">
                                  <i className="fa fa-check-circle me-2"></i>TAWJEEH Service (150 AED)
                                </label>
                                <small className="form-text text-muted d-block ms-4">
                                  Check if TAWJEEH service cost is included in the sale price
                                </small>
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={formData.insurance_included}
                                  onChange={(e) => handleChange('insurance_included', e.target.checked)}
                                  id="insuranceIncluded"
                                />
                                <label className="form-check-label fw-bold text-primary" htmlFor="insuranceIncluded">
                                  <i className="fa fa-shield-alt me-2"></i>ILOE Insurance (126 AED)
                                </label>
                                <small className="form-text text-muted d-block ms-4">
                                  Check if ILOE insurance cost is included in the sale price
                                </small>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Documents & Passport Information */}
              {currentStep === 2 && (
                <div className="modal-step">
                  <div className="alert alert-info">
                    <i className="fa fa-passport me-2"></i>
                    <strong>Step 2:</strong> Upload passport document for automatic data extraction, plus photo and Emirates ID.
                  </div>

                  {/* Passport Information */}
                  <div className="row mb-4">
                    <div className="col-12">
                      <h6 className="text-primary mb-3">
                        <i className="fa fa-passport"></i> Passport Information
                        <small className="text-muted"> (Auto-filled from document or enter manually)</small>
                      </h6>
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">
                        Passenger Name <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        value={formData.passengerName}
                        onChange={(e) => handleChange('passengerName', e.target.value)}
                        placeholder="Enter or auto-filled from passport"
                        required
                      />
                    </div>
                    <div className="col-lg-3">
                      <label className="form-label">
                        Nationality <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.nationality || ''}
                        onChange={(e) => handleChange('nationality', e.target.value ? parseInt(e.target.value) : null)}
                        required
                      >
                        <option value="">Select Nationality</option>
                        {lookups?.nationalities && Array.isArray(lookups.nationalities) && lookups.nationalities.map((n: any) => (
                          <option key={n.nationality_id} value={n.nationality_id}>
                            {n.nationality_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">
                        Passport # <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.passportNumber}
                        onChange={(e) => handleChange('passportNumber', e.target.value)}
                        placeholder="Enter passport number"
                        required
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">
                        Passport Expiry <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.passportExpiryDate}
                        onChange={(e) => handleChange('passportExpiryDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">
                        Gender <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.gender}
                        onChange={(e) => handleChange('gender', e.target.value)}
                        required
                      >
                        <option value="">Choose gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">
                        Date of Birth <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.dob}
                        onChange={(e) => handleChange('dob', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* File Uploads */}
                  <div className="row mb-3">
                    <div className="col-lg-3">
                      <label className="form-label">
                        Passport <span className="text-danger">*</span>
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => handleFileChange('passportFile', e.target.files?.[0] || null)}
                        required
                      />
                      <small className="text-muted">Upload JPG/PNG/PDF passport documents</small>
                    </div>

                    <div className="col-lg-3">
                      <label className="form-label">
                        Photo <span className="text-danger">*</span>
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/jpeg,image/png"
                        onChange={(e) => handleFileChange('photoFile', e.target.files?.[0] || null)}
                        required
                      />
                      <small className="text-muted">Upload passport photo</small>
                    </div>

                    <div className="col-lg-3">
                      <label className="form-label">Emirates ID Front</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => handleFileChange('emiratesIdFrontFile', e.target.files?.[0] || null)}
                      />
                      <small className="text-muted">Upload Emirates ID front (optional)</small>
                    </div>

                    <div className="col-lg-3">
                      <label className="form-label">Emirates ID Back</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => handleFileChange('emiratesIdBackFile', e.target.files?.[0] || null)}
                      />
                      <small className="text-muted">Upload Emirates ID back (optional)</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {currentStep === 3 && (
                <div className="modal-step">
                  <div className="alert alert-success">
                    <i className="fa fa-check-circle me-2"></i>
                    <strong>Step 3:</strong> Review all information before creating the residence.
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <h6 className="text-primary mb-3">Basic Information</h6>
                      <div className="card">
                        <div className="card-body">
                          <p><strong>Customer:</strong> {getSelectedCustomer()?.customer_name || 'N/A'}</p>
                          <p><strong>Inside/Outside:</strong> {formData.insideOutside}</p>
                          <p><strong>Residence Type:</strong> {formData.res_type}</p>
                          <p><strong>UID:</strong> {formData.uid || (formData.insideOutside === 'Inside' ? 'Required but not provided' : 'Not required')}</p>
                          <p><strong>Salary Amount:</strong> {formData.salary_amount?.toLocaleString() || 'N/A'}</p>
                          <p><strong>Position:</strong> {getSelectedPosition()?.position_name || 'N/A'}</p>
                          <p><strong>Sale Price:</strong> {formData.sale_amount?.toLocaleString() || 'N/A'} {getSelectedCurrency()?.currencyName || ''}</p>
                          <p><strong>TAWJEEH:</strong> {formData.tawjeeh_included ? 'Included in sale price' : 'To be charged separately (150 AED)'}</p>
                          <p><strong>ILOE Insurance:</strong> {formData.insurance_included ? 'Included in sale price' : 'To be charged separately (126 AED)'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <h6 className="text-primary mb-3">Passport Information</h6>
                      <div className="card">
                        <div className="card-body">
                          <p><strong>Passenger Name:</strong> {formData.passengerName || 'N/A'}</p>
                          <p><strong>Nationality:</strong> {getSelectedNationality()?.nationality_name || 'N/A'}</p>
                          <p><strong>Passport Number:</strong> {formData.passportNumber || 'N/A'}</p>
                          <p><strong>Passport Expiry:</strong> {formData.passportExpiryDate || 'N/A'}</p>
                          <p><strong>Gender:</strong> {formData.gender || 'N/A'}</p>
                          <p><strong>Date of Birth:</strong> {formData.dob || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row mt-3">
                    <div className="col-md-6">
                      <h6 className="text-primary mb-3">Financial Information</h6>
                      <div className="card">
                        <div className="card-body">
                          <p><strong>Sale Price:</strong> {formData.sale_amount?.toLocaleString() || 'N/A'} {getSelectedCurrency()?.currencyName || ''}</p>
                          <p><strong>TAWJEEH:</strong> {formData.tawjeeh_included ? 'Included in sale price' : 'To be charged separately (150 AED)'}</p>
                          <p><strong>ILOE Insurance:</strong> {formData.insurance_included ? 'Included in sale price' : 'To be charged separately (126 AED)'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <h6 className="text-primary mb-3">Uploaded Documents</h6>
                      <div className="card">
                        <div className="card-body">
                          <p><strong>Passport:</strong> {formData.passportFile?.name || 'Not uploaded'}</p>
                          <p><strong>Photo:</strong> {formData.photoFile?.name || 'Not uploaded'}</p>
                          <p><strong>Emirates ID Front:</strong> {formData.emiratesIdFrontFile?.name || 'Not uploaded'}</p>
                          <p><strong>Emirates ID Back:</strong> {formData.emiratesIdBackFile?.name || 'Not uploaded'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card-footer d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/residence')}
              >
                Cancel
              </button>
              <div className="d-flex gap-2">
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={previousStep}
                    disabled={saving}
                  >
                    <i className="fa fa-arrow-left me-2"></i>Previous
                  </button>
                )}
                {currentStep < 3 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={nextStep}
                    onKeyDown={(e) => {
                      // Prevent Enter key from submitting form when not on Step 3
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        nextStep();
                      }
                    }}
                  >
                    Next <i className="fa fa-arrow-right ms-2"></i>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>Create Residence
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
