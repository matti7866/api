import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import residenceService from '../../services/residenceService';
import Swal from 'sweetalert2';
import { EVisaModal, ChangeStatusModal, MedicalModal, EmiratesIDModal, VisaStampingModal } from '../../components/residence/tasks/StepModals';
import AttachmentsModal from '../../components/residence/AttachmentsModal';
import RemarksModal from '../../components/residence/RemarksModal';
import './ResidenceTasks.css';

interface FamilyTask {
  familyResidenceID: number;
  residenceID: number; // Reference to main residence
  datetime: string;
  passenger_name: string;
  customer_name: string;
  company_name: string;
  company_number: string;
  username: string;
  password: string;
  passportNumber: string;
  countryName: string;
  countryCode: string;
  uid: string;
  mb_number: string;
  mohreStatus: string;
  document_verify: string;
  document_verify_datetime: string;
  document_verify_message: string;
  LabourCardNumber: string;
  hold: number;
  remarks: string;
  sale_price: number;
  paid_amount: number;
  offerLetterStatus: string;
  eVisaStatus: string;
  insideOutside: string;
  tawjeeh_charge: number;
  iloe_charge: number;
}

interface StepInfo {
  name: string;
  count: number;
  icon: string;
  showAccess?: boolean;
}

const steps: Record<string, StepInfo> = {
  '1': { name: 'E-Visa', count: 0, icon: 'fa fa-ticket', showAccess: true },
  '2': { name: 'Change Status', count: 0, icon: 'fa fa-exchange', showAccess: true },
  '3': { name: 'Medical', count: 0, icon: 'fa fa-medkit' },
  '4': { name: 'Emirates ID', count: 0, icon: 'fa fa-id-card' },
  '5': { name: 'Visa Stamping', count: 0, icon: 'fas fa-stamp' },
  '6': { name: 'Completed', count: 0, icon: 'fa fa-check-circle' },
};

export default function FamilyTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const currentStep = searchParams.get('step') || '1';
  const companyId = searchParams.get('company_id') || '';
  const searchQuery = searchParams.get('search') || '';
  
  const [families, setFamilies] = useState<FamilyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Array<{ company_id: number; company_name: string; company_number: string; totalEmployees: number; starting_quota: number }>>([]);
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [selectedCompany, setSelectedCompany] = useState<string>(companyId);
  
  // Lookups for dropdowns
  const [lookups, setLookups] = useState<{
    currencies: Array<{ currencyID: number; currencyName: string }>;
    accounts: Array<{ account_ID: number; account_Name: string }>;
    suppliers: Array<{ supp_id: number; supp_name: string }>;
    customers: Array<{ customer_id: number; customer_name: string }>;
    positions: Array<{ position_id: number; posiiton_name: string }>;
    nationalities: Array<{ airport_id: number; countryName: string }>;
  }>({
    currencies: [],
    accounts: [],
    suppliers: [],
    customers: [],
    positions: [],
    nationalities: []
  });
  
  // Modal states
  const [showEVisaModal, setShowEVisaModal] = useState(false);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [showEmiratesIDModal, setShowEmiratesIDModal] = useState(false);
  const [showVisaStampingModal, setShowVisaStampingModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [showRemarksHistory, setShowRemarksHistory] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadCompanies();
    loadLookups();
  }, []);

  useEffect(() => {
    loadTasks();
    setCurrentPage(1);
  }, [currentStep, companyId, searchQuery]);

  useEffect(() => {
    if (companyId !== selectedCompany) {
      setSelectedCompany(companyId);
    }
  }, [companyId]);
  
  const totalPages = Math.ceil(families.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFamilies = families.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const loadLookups = async () => {
    try {
      const data = await residenceService.getLookups();
      setLookups({
        currencies: Array.isArray(data.currencies) ? data.currencies : [],
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
        customers: Array.isArray(data.customers) ? data.customers : [],
        positions: Array.isArray(data.positions) ? data.positions : [],
        nationalities: Array.isArray(data.nationalities) 
          ? data.nationalities.map((n: any) => ({
              airport_id: n.nationality_id || n.airport_id,
              countryName: n.nationality_name || n.countryName
            }))
          : []
      });
    } catch (error) {
      console.error('Error loading lookups:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await residenceService.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await residenceService.getFamilyTasks({ 
        step: currentStep, 
        company_id: companyId || undefined, 
        search: searchQuery || undefined 
      });
      
      console.log('Family tasks data received:', data);
      console.log('Families array:', data?.families);
      console.log('Step counts:', data?.stepCounts);
      
      if (data && data.families) {
        setFamilies(Array.isArray(data.families) ? data.families : []);
      } else {
        setFamilies([]);
      }
      
      if (data && data.stepCounts) {
        setStepCounts(data.stepCounts);
      }
    } catch (error: any) {
      console.error('Error loading family tasks:', error);
      console.error('Error response:', error.response);
      setFamilies([]);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load tasks';
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (step: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', step);
    if (searchQuery) params.set('search', searchQuery);
    else params.delete('search');
    if (selectedCompany && selectedCompany !== '0') params.set('company_id', selectedCompany);
    else params.delete('company_id');
    setSearchParams(params, { replace: false });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get('search') as string;
    const params = new URLSearchParams(searchParams);
    params.set('search', search);
    params.set('step', currentStep);
    if (selectedCompany) params.set('company_id', selectedCompany);
    setSearchParams(params);
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompany(companyId);
    const params = new URLSearchParams(searchParams);
    params.set('step', currentStep);
    if (searchQuery) params.set('search', searchQuery);
    if (companyId && companyId !== '0') {
      params.set('company_id', companyId);
    } else {
      params.delete('company_id');
    }
    setSearchParams(params);
  };

  const getActionButtons = (family: FamilyTask) => {
    const buttons: JSX.Element[] = [];
    const step = currentStep;

    if (step === '1') {
      buttons.push(
        <button key="continue" className="btn btn-success btn-sm" onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowEVisaModal(true); }}>
          Continue
        </button>
      );
    } else if (step === '2') {
      buttons.push(
        <button key="continue" className="btn btn-success btn-sm" onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowChangeStatusModal(true); }}>
          Continue
        </button>
      );
    } else if (step === '3') {
      buttons.push(
        <button key="continue" className="btn btn-success btn-sm" onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowMedicalModal(true); }}>
          Continue
        </button>
      );
    } else if (step === '4') {
      buttons.push(
        <button key="continue" className="btn btn-success btn-sm" onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowEmiratesIDModal(true); }}>
          Continue
        </button>
      );
    } else if (step === '5') {
      buttons.push(
        <button key="continue" className="btn btn-success btn-sm" onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowVisaStampingModal(true); }}>
          Continue
        </button>
      );
    }

    if (family.hold === 0) {
      buttons.push(
        <a key="file" href={`/residence/family/${family.familyResidenceID}?stp=${step}`} target="_blank" className="btn btn-sm btn-primary">
          <i className="fa fa-file"></i>
        </a>
      );
    }
    
    buttons.push(
      <button key="move" className="btn btn-sm btn-primary" onClick={() => handleMoveToStep(family.familyResidenceID, step)}>
        Move
      </button>
    );

    buttons.push(
      <button 
        key="attachments" 
        className="btn btn-info btn-sm" 
        onClick={() => { setSelectedFamilyId(family.familyResidenceID); setShowAttachmentsModal(true); }}
        title="View/Upload Attachments"
      >
        <i className="fa fa-paperclip"></i>
      </button>
    );

    return buttons;
  };


  const handleMoveToStep = async (id: number, currentStep: string) => {
    const stepToCompletedStep: Record<string, number> = {
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6
    };

    const currentCompletedStep = stepToCompletedStep[currentStep] || 0;

    const allSteps = [
      { value: '1', label: '1 - E-Visa', completedStep: 1 },
      { value: '2', label: '2 - Change Status', completedStep: 2 },
      { value: '3', label: '3 - Medical', completedStep: 3 },
      { value: '4', label: '4 - Emirates ID', completedStep: 4 },
      { value: '5', label: '5 - Visa Stamping', completedStep: 5 },
      { value: '6', label: '6 - Completed', completedStep: 6 }
    ];

    const availableSteps = allSteps.filter(step => step.completedStep > currentCompletedStep);

    if (availableSteps.length === 0) {
      Swal.fire('Info', 'No steps available to move forward. This family residence is already at the final step.', 'info');
      return;
    }

    const optionsHtml = availableSteps.map(step => 
      `<option value="${step.value}">${step.label}</option>`
    ).join('');

    const excludedSteps = allSteps
      .filter(step => step.completedStep <= currentCompletedStep)
      .map(step => step.value)
      .join(', ');

    const { value: targetStep } = await Swal.fire({
      title: 'Move Family Residence to Step',
      html: `
        <div class="text-start">
          <label class="form-label mb-2">Select Target Step:</label>
          <select id="targetStep" class="form-select">
            ${optionsHtml}
          </select>
          <small class="text-muted d-block mt-2">
            <strong>Current step:</strong> ${currentStep}<br>
            <strong>Cannot move back to:</strong> ${excludedSteps}
          </small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Move',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#007bff',
      cancelButtonColor: '#6c757d',
      didOpen: () => {
        const select = document.getElementById('targetStep') as HTMLSelectElement;
        if (select) {
          select.focus();
        }
      },
      preConfirm: () => {
        const select = document.getElementById('targetStep') as HTMLSelectElement;
        if (!select || !select.value) {
          Swal.showValidationMessage('Please select a target step');
          return false;
        }
        const selectedStep = allSteps.find(s => s.value === select.value);
        if (selectedStep && selectedStep.completedStep <= currentCompletedStep) {
          Swal.showValidationMessage('Cannot move back to a completed step');
          return false;
        }
        return select.value;
      }
    });

    if (targetStep) {
      try {
        await residenceService.moveFamilyToStep(id, targetStep);
        await loadTasks();
        Swal.fire('Success', `Family residence moved to step ${targetStep} successfully`, 'success');
      } catch (error: any) {
        Swal.fire('Error', error.response?.data?.message || error.message || 'Failed to move family residence', 'error');
      }
    }
  };

  return (
    <div className="residence-tasks-page">
      {/* Header */}
      <div className="mb-6">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h1 className="mb-2" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#000000' }}>
              <i className="fa fa-users me-2"></i>
              Family Residence Tasks
            </h1>
            <p style={{ color: '#000000' }}>Manage family residence processing steps</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddFamilyModal(true)}
          >
            <i className="fa fa-plus me-2"></i>
            Add New Family Residence
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="card p-4">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search by name or Passport Number"
            />
            <button type="submit" className="btn btn-primary">
              <i className="fa fa-search mr-2"></i>
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Step Navigation */}
      <div className="mb-6">
        <div className="btn-group btn-group-block w-100">
          {(['1', '2', '3', '4', '5', '6'] as const).map((key) => {
            const step = steps[key];
            if (!step) return null;
            return (
              <button
                key={key}
                type="button"
                className={`btn btn-white btn-block step-nav-link ${currentStep === key ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleStepChange(key);
                }}
              >
                <span>{step.name}</span>
                {stepCounts[key] > 0 && (
                  <span className="badge bg-red ms-1">{stepCounts[key]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Establishment Filter */}
      {currentStep !== '1' && (
        <div className="mb-6">
          <div className="card p-4">
            <label className="form-label mb-2" style={{ color: '#374151', fontWeight: 500 }}>Establishment</label>
            <select
              className="form-select"
              value={selectedCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
            >
              <option value="0">All</option>
              {companies.filter(company => company && company.company_id).map((company) => (
                <option key={company.company_id} value={String(company.company_id || '')}>
                  {company.company_name || 'Unknown'} ({(company.starting_quota || 0) - (company.totalEmployees || 0)})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="mb-0" style={{ color: '#1f2937', fontWeight: 600 }}>Family Resident</h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <i className="fa fa-spinner fa-spin fa-2x" style={{ color: '#9ca3af' }}></i>
              <p className="mt-2" style={{ color: '#6b7280' }}>Loading family residences...</p>
            </div>
          ) : families.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: '#6b7280' }}>No family residences found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle text-nowrap">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>App. Date</th>
                    <th>Passenger Name</th>
                    <th>Customer</th>
                    <th>Establishment</th>
                    <th>Passport</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFamilies.map((family) => (
                    <tr key={family.familyResidenceID} className={family.hold === 1 ? 'bg-hold' : ''}>
                      <td>{family.familyResidenceID}</td>
                      <td>{new Date(family.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <img
                          src={`https://flagpedia.net/data/flags/h24/${family.countryCode?.toLowerCase()}.png`}
                          alt={family.countryName}
                          height="12"
                          className="me-2"
                        />
                        <strong>{family.passenger_name.toUpperCase()}</strong>
                        {family.uid && <><br /><strong>UID: </strong>{family.uid}</>}
                        <br />
                        <strong>Sale Price: </strong>{family.sale_price.toLocaleString()}
                        <br />
                        <strong>Paid Amount: </strong>{family.paid_amount.toLocaleString()}
                        {' '}
                        <span className={family.paid_amount === family.sale_price ? 'text-success' : 'text-danger'}>
                          ({family.paid_amount === 0 ? 0 : Math.round((family.paid_amount / family.sale_price) * 100)}%)
                        </span>
                      </td>
                      <td>{family.customer_name}</td>
                      <td>
                        {family.company_name && (
                          <>
                            <strong>{family.company_name}</strong>
                            {family.company_number && <> - {family.company_number}</>}
                          </>
                        )}
                        {family.mb_number && <><br /><strong>MB Number: </strong>{family.mb_number}</>}
                        {family.mohreStatus && (
                          <><br /><strong>MOHRE Status: </strong>
                            <span className={family.mb_number ? 'text-primary' : 'text-danger'}>
                              {family.mb_number ? family.mohreStatus : 'Provide MB Number'}
                            </span>
                          </>
                        )}
                        {steps[currentStep]?.showAccess && family.username && (
                          <>
                            <br /><strong>Username: </strong>{family.username}
                            {family.password && <><br /><strong>Password: </strong>{family.password}</>}
                          </>
                        )}
                      </td>
                      <td>
                        {family.passportNumber}
                        {family.insideOutside && (
                          <span className={`badge bg-${family.insideOutside === 'inside' ? 'success' : 'danger'} ms-2`}>
                            {family.insideOutside.toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td>
                        {family.remarks && (
                          <div className="remarks-content" style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                            <strong>Current Remarks:</strong><br />
                            <span className="text-info">{family.remarks}</span>
                            <br />
                            <button 
                              className="btn btn-sm btn-outline-primary btn-view-remarks-history mt-1"
                              onClick={() => { 
                                setSelectedFamilyId(family.familyResidenceID); 
                                setShowRemarksHistory(true);
                                setShowRemarksModal(true); 
                              }}
                            >
                              <i className="fa fa-history"></i> History
                            </button>
                          </div>
                        )}
                        <button
                          className="btn btn-sm btn-outline-success btn-add-remarks"
                          onClick={() => { 
                            setSelectedFamilyId(family.familyResidenceID); 
                            setShowRemarksHistory(false);
                            setShowRemarksModal(true); 
                          }}
                        >
                          <i className="fa fa-plus"></i> {family.remarks ? 'Edit' : 'Add'} Remarks
                        </button>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {getActionButtons(family)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && families.length > 0 && (
            <div className="pagination-container" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '16px 20px',
              borderTop: '1px solid #e5e7eb',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Show</span>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  entries (Showing {startIndex + 1}-{Math.min(endIndex, families.length)} of {families.length})
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: currentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  <i className="fa fa-angle-double-left"></i>
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: currentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  <i className="fa fa-angle-left"></i>
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: currentPage === pageNum ? '#000000' : '#ffffff',
                        color: currentPage === pageNum ? '#ffffff' : '#374151',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: currentPage === pageNum ? '600' : '400',
                        minWidth: '36px'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151'
                  }}
                >
                  <i className="fa fa-angle-right"></i>
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151'
                  }}
                >
                  <i className="fa fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedFamilyId && (
        <>
          <EVisaModal
            isOpen={showEVisaModal}
            onClose={() => { setShowEVisaModal(false); setSelectedFamilyId(null); }}
            residenceId={selectedFamilyId}
            onSuccess={loadTasks}
            currencies={lookups.currencies}
            accounts={lookups.accounts}
            suppliers={lookups.suppliers}
            isFamily={true}
          />

          <ChangeStatusModal
            isOpen={showChangeStatusModal}
            onClose={() => { setShowChangeStatusModal(false); setSelectedFamilyId(null); }}
            residenceId={selectedFamilyId}
            onSuccess={loadTasks}
            currencies={lookups.currencies}
            accounts={lookups.accounts}
            suppliers={lookups.suppliers}
            isFamily={true}
          />

          <MedicalModal
            isOpen={showMedicalModal}
            onClose={() => { setShowMedicalModal(false); setSelectedFamilyId(null); }}
            residenceId={selectedFamilyId}
            onSuccess={loadTasks}
            currencies={lookups.currencies}
            accounts={lookups.accounts}
            suppliers={lookups.suppliers}
            isFamily={true}
          />

          <EmiratesIDModal
            isOpen={showEmiratesIDModal}
            onClose={() => { setShowEmiratesIDModal(false); setSelectedFamilyId(null); }}
            residenceId={selectedFamilyId}
            onSuccess={loadTasks}
            currencies={lookups.currencies}
            accounts={lookups.accounts}
            suppliers={lookups.suppliers}
            isFamily={true}
          />

          <VisaStampingModal
            isOpen={showVisaStampingModal}
            onClose={() => { setShowVisaStampingModal(false); setSelectedFamilyId(null); }}
            residenceId={selectedFamilyId}
            onSuccess={loadTasks}
            currencies={lookups.currencies}
            accounts={lookups.accounts}
            suppliers={lookups.suppliers}
            isFamily={true}
          />
          
          {families.find(f => f.familyResidenceID === selectedFamilyId) && (
            <AttachmentsModal
              isOpen={showAttachmentsModal}
              onClose={() => { setShowAttachmentsModal(false); setSelectedFamilyId(null); }}
              residence={{
                ...families.find(f => f.familyResidenceID === selectedFamilyId),
                familyResidenceID: selectedFamilyId
              } as any}
              onLoadAttachments={async (residenceID) => {
                const data = await residenceService.getFamilyAttachments(residenceID);
                return Array.isArray(data) ? data : [];
              }}
              onUploadAttachment={async (residenceID, stepNumber, file, fileType) => {
                await residenceService.uploadFamilyAttachment(residenceID, stepNumber, file, fileType);
              }}
              onDeleteAttachment={async (attachmentId) => {
                await residenceService.deleteFamilyAttachment(attachmentId);
              }}
            />
          )}
          
          {selectedFamilyId && (
            <RemarksModal
              isOpen={showRemarksModal}
              onClose={() => { 
                setShowRemarksModal(false); 
                setShowRemarksHistory(false);
                setSelectedFamilyId(null); 
              }}
              residenceId={selectedFamilyId}
              currentRemarks={families.find(f => f.familyResidenceID === selectedFamilyId)?.remarks || ''}
              currentStep={currentStep}
              onSuccess={loadTasks}
              showHistoryByDefault={showRemarksHistory}
              isFamily={true}
            />
          )}
        </>
      )}

      {/* Add Family Residence Modal */}
      <AddFamilyResidenceModal
        isOpen={showAddFamilyModal}
        onClose={() => setShowAddFamilyModal(false)}
        onSuccess={loadTasks}
        customers={lookups.customers}
        nationalities={lookups.nationalities}
        currencies={lookups.currencies}
      />
    </div>
  );
}

// Add Family Residence Modal Component
function AddFamilyResidenceModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  customers,
  nationalities,
  currencies
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customers: Array<{ customer_id: number; customer_name: string }>;
  nationalities: Array<{ airport_id: number; countryName: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
}) {
  const [formData, setFormData] = useState({
    customer_id: '',
    residence_id: '',
    passenger_name: '',
    passport_number: '',
    passport_expiry: '',
    date_of_birth: '',
    gender: '',
    nationality: '',
    relation_type: '',
    inside_outside: '',
    sale_price: '0',
    sale_currency: 'AED',
    remarks: ''
  });
  const [documents, setDocuments] = useState<{
    passport_doc: File | null;
    photo_doc: File | null;
    id_front_doc: File | null;
    id_back_doc: File | null;
    birth_certificate_doc: File | null;
    marriage_certificate_doc: File | null;
    other_doc: File | null;
  }>({
    passport_doc: null,
    photo_doc: null,
    id_front_doc: null,
    id_back_doc: null,
    birth_certificate_doc: null,
    marriage_certificate_doc: null,
    other_doc: null
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        customer_id: '',
        residence_id: '',
        passenger_name: '',
        passport_number: '',
        passport_expiry: '',
        date_of_birth: '',
        gender: '',
        nationality: '',
        relation_type: '',
        inside_outside: '',
        sale_price: '0',
        sale_currency: 'AED',
        remarks: ''
      });
      setDocuments({
        passport_doc: null,
        photo_doc: null,
        id_front_doc: null,
        id_back_doc: null,
        birth_certificate_doc: null,
        marriage_certificate_doc: null,
        other_doc: null
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.customer_id) newErrors.customer_id = 'Customer is required';
    if (!formData.passenger_name) newErrors.passenger_name = 'Passenger Name is required';
    if (!formData.passport_number) newErrors.passport_number = 'Passport Number is required';
    if (!formData.relation_type) newErrors.relation_type = 'Relation Type is required';
    if (!formData.inside_outside) newErrors.inside_outside = 'Location is required';
    if (!formData.nationality) newErrors.nationality = 'Nationality is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await residenceService.addFamilyResidence({
        customer_id: parseInt(formData.customer_id),
        residence_id: formData.residence_id ? parseInt(formData.residence_id) : undefined,
        passenger_name: formData.passenger_name,
        passport_number: formData.passport_number,
        passport_expiry: formData.passport_expiry || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        nationality: parseInt(formData.nationality),
        relation_type: formData.relation_type,
        inside_outside: formData.inside_outside,
        sale_price: parseFloat(formData.sale_price),
        sale_currency: formData.sale_currency,
        remarks: formData.remarks || undefined,
        documents: documents
      });

      Swal.fire('Success', 'Family residence added successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add family residence', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-plus"></i> Add New Family Residence</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <div className="modal-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Customer <span className="text-danger">*</span></label>
                <select
                  className={`form-select ${errors.customer_id ? 'is-invalid' : ''}`}
                  value={formData.customer_id}
                  onChange={(e) => { setFormData(prev => ({ ...prev, customer_id: e.target.value })); setErrors(prev => ({ ...prev, customer_id: '' })); }}
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
                  ))}
                </select>
                {errors.customer_id && <div className="invalid-feedback">{errors.customer_id}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Residence ID (Optional)</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.residence_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, residence_id: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Passenger Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.passenger_name ? 'is-invalid' : ''}`}
                  value={formData.passenger_name}
                  onChange={(e) => { setFormData(prev => ({ ...prev, passenger_name: e.target.value })); setErrors(prev => ({ ...prev, passenger_name: '' })); }}
                  required
                />
                {errors.passenger_name && <div className="invalid-feedback">{errors.passenger_name}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Passport Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.passport_number ? 'is-invalid' : ''}`}
                  value={formData.passport_number}
                  onChange={(e) => { setFormData(prev => ({ ...prev, passport_number: e.target.value })); setErrors(prev => ({ ...prev, passport_number: '' })); }}
                  required
                />
                {errors.passport_number && <div className="invalid-feedback">{errors.passport_number}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Passport Expiry</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.passport_expiry}
                  onChange={(e) => setFormData(prev => ({ ...prev, passport_expiry: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Gender</label>
                <select
                  className="form-select"
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Nationality <span className="text-danger">*</span></label>
                <select
                  className={`form-select ${errors.nationality ? 'is-invalid' : ''}`}
                  value={formData.nationality}
                  onChange={(e) => { setFormData(prev => ({ ...prev, nationality: e.target.value })); setErrors(prev => ({ ...prev, nationality: '' })); }}
                  required
                >
                  <option value="">Select Nationality</option>
                  {nationalities.map((n) => (
                    <option key={n.airport_id} value={n.airport_id}>{n.countryName}</option>
                  ))}
                </select>
                {errors.nationality && <div className="invalid-feedback">{errors.nationality}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Relation Type <span className="text-danger">*</span></label>
                <select
                  className={`form-select ${errors.relation_type ? 'is-invalid' : ''}`}
                  value={formData.relation_type}
                  onChange={(e) => { setFormData(prev => ({ ...prev, relation_type: e.target.value })); setErrors(prev => ({ ...prev, relation_type: '' })); }}
                  required
                >
                  <option value="">Select</option>
                  <option value="spouse">Spouse</option>
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="brother">Brother</option>
                  <option value="sister">Sister</option>
                  <option value="other">Other</option>
                </select>
                {errors.relation_type && <div className="invalid-feedback">{errors.relation_type}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Location <span className="text-danger">*</span></label>
                <select
                  className={`form-select ${errors.inside_outside ? 'is-invalid' : ''}`}
                  value={formData.inside_outside}
                  onChange={(e) => { setFormData(prev => ({ ...prev, inside_outside: e.target.value })); setErrors(prev => ({ ...prev, inside_outside: '' })); }}
                  required
                >
                  <option value="">Select</option>
                  <option value="inside">Inside UAE</option>
                  <option value="outside">Outside UAE</option>
                </select>
                {errors.inside_outside && <div className="invalid-feedback">{errors.inside_outside}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Sale Price</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={formData.sale_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, sale_price: e.target.value }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Currency</label>
                <select
                  className="form-select"
                  value={formData.sale_currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, sale_currency: e.target.value }))}
                >
                  {currencies.map((c) => (
                    <option key={c.currencyID} value={c.currencyName}>{c.currencyName}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </div>
              
              {/* Document Upload Section */}
              <div className="col-md-12 mb-3">
                <hr />
                <h5 className="mb-3"><i className="fa fa-file me-2"></i>Documents</h5>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Passport Copy</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocuments(prev => ({ ...prev, passport_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Photo</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setDocuments(prev => ({ ...prev, photo_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">ID Front</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocuments(prev => ({ ...prev, id_front_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">ID Back</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocuments(prev => ({ ...prev, id_back_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Birth Certificate</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocuments(prev => ({ ...prev, birth_certificate_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Marriage Certificate</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocuments(prev => ({ ...prev, marriage_certificate_doc: e.target.files?.[0] || null }))}
                />
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Other Document</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocuments(prev => ({ ...prev, other_doc: e.target.files?.[0] || null }))}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Add Family Residence
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

