import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import freezoneService from '../../services/freezoneService';
import Swal from 'sweetalert2';
import { FreezoneEVisaModal, FreezoneEVisaAcceptModal, FreezoneChangeStatusModal, FreezoneMedicalModal, FreezoneEmiratesIDModal, FreezoneVisaStampingModal } from '../../components/freezone/FreezoneStepModals';
import FreezoneAttachmentsModal from '../../components/freezone/FreezoneAttachmentsModal';
import './FreezoneTasks.css';

interface FreezoneTask {
  id: number;
  residenceID: number;
  datetime: string;
  passenger_name: string;
  customer_name: string;
  company_name: string;
  company_number: string;
  passportNumber: string;
  passportExpiryDate: string;
  countryName: string;
  countryCode: string;
  uid: string;
  positionID: number;
  position_name: string;
  evisaStatus: string;
  insideOutside: string;
  salePrice: number;
  saleCurrency: number;
  completedSteps: number;
}

interface StepInfo {
  name: string;
  count: number;
  icon: string;
}

const steps: Record<string, StepInfo> = {
  '1': { name: 'eVisa', count: 0, icon: 'fa fa-ticket' },
  '1a': { name: 'eVisa (Submitted)', count: 0, icon: 'fa fa-file-ticket' },
  '2': { name: 'Change Status', count: 0, icon: 'fa fa-exchange' },
  '3': { name: 'Medical', count: 0, icon: 'fa fa-medkit' },
  '4': { name: 'Emirates ID', count: 0, icon: 'fa fa-id-card' },
  '5': { name: 'Visa Stamping', count: 0, icon: 'fas fa-stamp' },
  '6': { name: 'Completed', count: 0, icon: 'fa fa-check-circle' },
};

export default function FreezoneTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStep = searchParams.get('step') || '1';
  
  const [residences, setResidences] = useState<FreezoneTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Array<{ company_id: number; company_name: string; company_number: string }>>([]);
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  
  // Lookups
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
  const [showNewResidenceModal, setShowNewResidenceModal] = useState(false);
  const [showEVisaModal, setShowEVisaModal] = useState(false);
  const [showEVisaAcceptModal, setShowEVisaAcceptModal] = useState(false);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [showEmiratesIDModal, setShowEmiratesIDModal] = useState(false);
  const [showVisaStampingModal, setShowVisaStampingModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [selectedResidenceId, setSelectedResidenceId] = useState<number | null>(null);
  const [selectedResidence, setSelectedResidence] = useState<FreezoneTask | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadCompanies();
    loadLookups();
  }, []);

  useEffect(() => {
    console.log('useEffect triggered - currentStep:', currentStep);
    loadTasks();
    setCurrentPage(1);
  }, [currentStep]);

  const loadLookups = async () => {
    try {
      const data = await freezoneService.getLookups();
      console.log('Lookups API response:', data);
      
      // Map positions to match expected format (position_name -> posiiton_name)
      const positions = Array.isArray(data.positions) ? data.positions.map((pos: any) => ({
        position_id: pos.position_id,
        posiiton_name: pos.position_name || pos.posiiton_name || ''
      })) : [];
      
      setLookups({
        currencies: Array.isArray(data.currencies) ? data.currencies : [],
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        suppliers: Array.isArray(data.suppliers) ? data.suppliers : [],
        customers: Array.isArray(data.customers) ? data.customers : [],
        positions: positions,
        nationalities: Array.isArray(data.nationalities) ? data.nationalities : []
      });
      console.log('Set lookups:', { positions: positions.length, accounts: data.accounts?.length, suppliers: data.suppliers?.length });
    } catch (error) {
      console.error('Error loading lookups:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await freezoneService.getCompanies();
      console.log('Companies API response in component:', data);
      console.log('Is array?', Array.isArray(data));
      const companiesArray = Array.isArray(data) ? data : [];
      console.log('Setting companies array:', companiesArray);
      console.log('Companies count:', companiesArray.length);
      if (companiesArray.length > 0) {
        console.log('First company:', companiesArray[0]);
      }
      setCompanies(companiesArray);
    } catch (error) {
      console.error('Error loading companies:', error);
      Swal.fire('Error', 'Failed to load establishments. Please check console for details.', 'error');
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await freezoneService.getTasks({ step: currentStep });
      console.log('Freezone tasks data received:', data);
      
      if (data && data.residences) {
        const residencesArray = Array.isArray(data.residences) ? data.residences : [];
        console.log('Setting residences:', residencesArray.length);
        setResidences(residencesArray);
      } else {
        console.log('No residences in data, setting empty array');
        setResidences([]);
      }
      
      if (data && data.stepCounts) {
        console.log('Setting stepCounts:', data.stepCounts);
        setStepCounts(data.stepCounts);
      } else {
        setStepCounts({});
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      console.error('Error response:', error.response);
      setResidences([]);
      setStepCounts({});
      Swal.fire('Error', error.response?.data?.message || error.message || 'Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (step: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', step);
    setSearchParams(params, { replace: false });
  };

  const handleEVisa = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      console.log('Opening eVisa modal - companies:', companies.length, 'positions:', lookups.positions?.length);
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowEVisaModal(true);
    }
  };

  const handleEVisaAccept = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowEVisaAcceptModal(true);
    }
  };

  const handleEVisaReject = async (id: number) => {
    const result = await Swal.fire({
      title: 'Reject eVisa',
      text: 'Are you sure you want to reject this eVisa?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, reject it'
    });

    if (result.isConfirmed) {
      try {
        await freezoneService.rejectEVisa(id);
        await loadTasks();
        Swal.fire('Success', 'eVisa rejected successfully', 'success');
      } catch (error: any) {
        Swal.fire('Error', error.response?.data?.message || 'Failed to reject eVisa', 'error');
      }
    }
  };

  const handleChangeStatus = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowChangeStatusModal(true);
    }
  };

  const handleMedical = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowMedicalModal(true);
    }
  };

  const handleEmiratesID = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowEmiratesIDModal(true);
    }
  };

  const handleVisaStamping = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowVisaStampingModal(true);
    }
  };

  const handleAttachments = async (id: number) => {
    const residence = residences.find(r => r.id === id);
    if (residence) {
      setSelectedResidence(residence);
      setSelectedResidenceId(id);
      setShowAttachmentsModal(true);
    }
  };

  // Pagination
  const totalPages = Math.ceil(residences.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResidences = residences.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  return (
    <div className="freezone-tasks-page">
      {/* Header */}
      <div className="mb-6">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h1 className="mb-2" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#000000' }}>
              <i className="fa fa-tasks me-2"></i>
              Residence Tasks (Freezone)
            </h1>
            <p style={{ color: '#000000' }}>Manage freezone residence processing steps</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-primary" onClick={() => setShowNewResidenceModal(true)}>
              <i className="fa fa-plus-circle me-2"></i>
              Add New Residence
            </button>
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="mb-6">
        <div className="btn-group btn-group-block w-100">
          {(['1', '1a', '2', '3', '4', '5', '6'] as const).map((key) => {
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

      {/* Data Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="mb-0" style={{ color: '#1f2937', fontWeight: 600 }}>Freezone Residence List</h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <i className="fa fa-spinner fa-spin fa-2x" style={{ color: '#9ca3af' }}></i>
              <p className="mt-2" style={{ color: '#6b7280' }}>Loading residences...</p>
            </div>
          ) : residences.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: '#6b7280' }}>No residences found</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle text-nowrap">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>App. Date</th>
                    <th>Passenger</th>
                    <th>Customer</th>
                    {currentStep !== '1' && <th>Establishment</th>}
                    <th>Passport</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResidences.map((residence) => {
                    console.log('Rendering residence:', residence);
                    return (
                    <tr key={residence.id}>
                      <td>{residence.id}</td>
                      <td>{residence.datetime ? new Date(residence.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
                      <td>
                        <img
                          src={`https://flagpedia.net/data/flags/h24/${residence.countryCode?.toLowerCase()}.png`}
                          alt={residence.countryName}
                          height="12"
                          className="me-2"
                        />
                        <strong>{(residence.passenger_name || '').toUpperCase()}</strong>
                        <br />
                        <strong>Nationality:</strong> {residence.countryName || 'N/A'} ({residence.countryCode || 'N/A'})
                        {residence.uid && residence.uid.toLowerCase() !== 'outside' && (
                          <>
                            <br />
                            <strong>UID:</strong> {residence.uid}
                          </>
                        )}
                      </td>
                      <td>{residence.customer_name || 'N/A'}</td>
                      {currentStep !== '1' && (
                        <td>{residence.company_name || 'N/A'}</td>
                      )}
                      <td>
                        Number: {residence.passportNumber || 'N/A'}
                        <br />
                        Exp: {residence.passportExpiryDate ? new Date(residence.passportExpiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {currentStep === '1' && (
                            <button 
                              className="btn btn-sm btn-primary" 
                              onClick={() => handleEVisa(residence.id)}
                            >
                              Continue
                            </button>
                          )}
                          {currentStep === '1a' && (
                            <>
                              <button 
                                className="btn btn-sm btn-success" 
                                onClick={() => handleEVisaAccept(residence.id)}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn btn-sm btn-danger" 
                                onClick={() => handleEVisaReject(residence.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {currentStep === '2' && (
                            <button 
                              className="btn btn-sm btn-success" 
                              onClick={() => handleChangeStatus(residence.id)}
                            >
                              Continue
                            </button>
                          )}
                          {currentStep === '3' && (
                            <button 
                              className="btn btn-sm btn-success" 
                              onClick={() => handleMedical(residence.id)}
                            >
                              Continue
                            </button>
                          )}
                          {currentStep === '4' && (
                            <button 
                              className="btn btn-sm btn-success" 
                              onClick={() => handleEmiratesID(residence.id)}
                            >
                              Continue
                            </button>
                          )}
                          {currentStep === '5' && (
                            <button 
                              className="btn btn-sm btn-success" 
                              onClick={() => handleVisaStamping(residence.id)}
                            >
                              Continue
                            </button>
                          )}
                          <button 
                            className="btn btn-sm btn-info" 
                            onClick={() => handleAttachments(residence.id)}
                          >
                            <i className="fa fa-paperclip"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!loading && residences.length > 0 && (
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
                  entries (Showing {startIndex + 1}-{Math.min(endIndex, residences.length)} of {residences.length})
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
      <FreezoneEVisaModal
        isOpen={showEVisaModal}
        onClose={() => { setShowEVisaModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
        companies={companies || []}
        positions={lookups.positions || []}
        accounts={lookups.accounts || []}
        suppliers={lookups.suppliers || []}
        currencies={lookups.currencies || []}
        residence={selectedResidence}
      />
      
      <FreezoneEVisaAcceptModal
        isOpen={showEVisaAcceptModal}
        onClose={() => { setShowEVisaAcceptModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
      />
      
      <FreezoneChangeStatusModal
        isOpen={showChangeStatusModal}
        onClose={() => { setShowChangeStatusModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
        companies={companies || []}
        positions={lookups.positions || []}
        accounts={lookups.accounts || []}
        suppliers={lookups.suppliers || []}
        currencies={lookups.currencies || []}
      />
      
      <FreezoneMedicalModal
        isOpen={showMedicalModal}
        onClose={() => { setShowMedicalModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
        companies={companies || []}
        positions={lookups.positions || []}
        accounts={lookups.accounts || []}
        suppliers={lookups.suppliers || []}
        currencies={lookups.currencies || []}
      />
      
      <FreezoneEmiratesIDModal
        isOpen={showEmiratesIDModal}
        onClose={() => { setShowEmiratesIDModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
        companies={companies || []}
        positions={lookups.positions || []}
        accounts={lookups.accounts || []}
        suppliers={lookups.suppliers || []}
        currencies={lookups.currencies || []}
      />
      
      <FreezoneVisaStampingModal
        isOpen={showVisaStampingModal}
        onClose={() => { setShowVisaStampingModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
        onSuccess={loadTasks}
        companies={companies || []}
        positions={lookups.positions || []}
        accounts={lookups.accounts || []}
        suppliers={lookups.suppliers || []}
      />
      
      <FreezoneAttachmentsModal
        isOpen={showAttachmentsModal}
        onClose={() => { setShowAttachmentsModal(false); setSelectedResidenceId(null); setSelectedResidence(null); }}
        residenceId={selectedResidenceId}
      />
    </div>
  );
}

