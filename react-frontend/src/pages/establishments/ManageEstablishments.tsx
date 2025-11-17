import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../services/api';
import Swal from 'sweetalert2';
import AddEstablishmentModal from '../../components/establishments/AddEstablishmentModal';
import AddPersonModal from '../../components/establishments/AddPersonModal';
import EditEstablishmentModal from '../../components/establishments/EditEstablishmentModal';
import CompanyAttachmentsModal from '../../components/establishments/CompanyAttachmentsModal';
import Establishments from './Establishments';
import './ManageEstablishments.css';

interface Establishment {
  company_id: number;
  company_name: string;
  company_type: string;
  company_number: string;
  expiry_date: string;
  quota: number;
  username?: string;
  password?: string;
  local_name?: string;
  authorized_signatories?: any[];
  documents?: any[];
  missing_documents?: string[];
}

interface Person {
  person_id: number;
  person_name: string;
  full_name?: string;
  person_role?: string;
  role?: string;
  passport_number?: string;
  emirates_id?: string;
  phone?: string;
  email?: string;
  nationality?: string;
  date_of_birth?: string;
  documents?: any[];
}

export default function ManageEstablishments() {
  const navigate = useNavigate();
  
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewType, setViewType] = useState<'manage' | 'establishments'>('manage');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Counts for sidebar
  const [counts, setCounts] = useState({
    all: 0,
    mainland: 0,
    freezone: 0,
    missing: 0,
    persons: 0
  });
  
  // Modal states
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false);
  const [showAIGeneratorModal, setShowAIGeneratorModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Establishment | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [selectedCompanyForAttachments, setSelectedCompanyForAttachments] = useState<Establishment | null>(null);

  const loadEstablishments = useCallback(async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'searchCompanies');
      formData.append('filterType', filterType);
      formData.append('search', searchQuery);
      formData.append('sort', sortBy);
      formData.append('page', currentPage.toString());
      formData.append('limit', recordsPerPage.toString());

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        setEstablishments(response.data.companies || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalRecords(response.data.pagination?.totalRecords || 0);
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to load establishments', 'error');
      }
    } catch (error: any) {
      console.error('Error loading establishments:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load establishments', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterType, searchQuery, sortBy, currentPage, recordsPerPage]);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  useEffect(() => {
    loadSidebarCounts();
    loadPersons();
  }, []);

  const loadSidebarCounts = async () => {
    try {
      const formData = new FormData();
      formData.append('action', 'getSidebarCounts');

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        setCounts(response.data.counts || {
          all: 0,
          mainland: 0,
          freezone: 0,
          missing: 0,
          persons: 0
        });
      }
    } catch (error: any) {
      console.error('Error loading sidebar counts:', error);
    }
  };

  const loadPersons = async () => {
    try {
      const formData = new FormData();
      formData.append('action', 'getPersons');

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        const personsData = response.data.persons || [];
        setPersons(personsData);
      }
    } catch (error: any) {
      console.error('Error loading persons:', error);
    }
  };

  const handleFilterChange = (type: string) => {
    setFilterType(type);
    // Reset search and pagination when changing filters
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
    loadEstablishments();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRecordsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRecordsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing records per page
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  const isExpired = (dateString: string) => {
    if (!dateString) return false;
    try {
      const expiryDate = new Date(dateString);
      const today = new Date();
      return expiryDate < today;
    } catch {
      return false;
    }
  };

  return (
    <div className="manage-establishments-page">
      {/* Mobile sidebar toggle button */}
      <button 
        className="btn btn-primary d-md-none mb-3"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ position: 'fixed', top: '70px', left: '10px', zIndex: 1030 }}
      >
        <i className="fa fa-bars"></i> Filters
      </button>
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="d-md-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1019
          }}
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}
      
      {/* Sidebar Navigation - Desktop (fixed position, outside container) */}
      <div className="sidebar d-none d-md-block">
              <div className="sidebar-header">
                <h4 className="sidebar-title">
                  <i className="fa fa-building"></i> Establishments
                </h4>
                <p className="sidebar-subtitle">Filter & Manage</p>
              </div>
              
              <ul className="sidebar-nav">
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'establishments' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('establishments'); }}
                  >
                    <i className="fa fa-building"></i>
                    <span>Establishment</span>
                  </a>
                </li>
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'all' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('all'); }}
                  >
                    <i className="fa fa-list"></i>
                    <span>All Establishments</span>
                    <span className="nav-count">{counts.all}</span>
                  </a>
                </li>
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'Mainland' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('Mainland'); }}
                  >
                    <i className="fa fa-building"></i>
                    <span>Mainland</span>
                    <span className="nav-count">{counts.mainland}</span>
                  </a>
                </li>
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'Freezone' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('Freezone'); }}
                  >
                    <i className="fa fa-globe"></i>
                    <span>Freezone</span>
                    <span className="nav-count">{counts.freezone}</span>
                  </a>
                </li>
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'missing' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('missing'); }}
                  >
                    <i className="fa fa-exclamation-triangle"></i>
                    <span>Missing Documents</span>
                    <span className="nav-count">{counts.missing}</span>
                  </a>
                </li>
                <li className="sidebar-nav-item">
                  <a 
                    href="#" 
                    className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'persons' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('persons'); }}
                  >
                    <i className="fa fa-users"></i>
                    <span>Persons</span>
                    <span className="nav-count">{counts.persons}</span>
                  </a>
                </li>
              </ul>
            </div>
          
          {/* Sidebar Navigation - Mobile */}
          <div className={`sidebar d-md-none ${sidebarOpen ? 'mobile-open' : ''}`} style={{ zIndex: 1020 }}>
            <div className="sidebar-header">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="sidebar-title">
                    <i className="fa fa-building"></i> Establishments
                  </h4>
                  <p className="sidebar-subtitle">Filter & Manage</p>
                </div>
                <button 
                  className="btn btn-sm btn-link text-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className="fa fa-times"></i>
                </button>
              </div>
            </div>
            
            <ul className="sidebar-nav">
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'establishments' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('establishments'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-building"></i>
                  <span>Establishment</span>
                </a>
              </li>
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'all' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('all'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-list"></i>
                  <span>All Establishments</span>
                  <span className="nav-count">{counts.all}</span>
                </a>
              </li>
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'Mainland' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('Mainland'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-building"></i>
                  <span>Mainland</span>
                  <span className="nav-count">{counts.mainland}</span>
                </a>
              </li>
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'Freezone' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('Freezone'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-globe"></i>
                  <span>Freezone</span>
                  <span className="nav-count">{counts.freezone}</span>
                </a>
              </li>
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'missing' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('missing'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-exclamation-triangle"></i>
                  <span>Missing Documents</span>
                  <span className="nav-count">{counts.missing}</span>
                </a>
              </li>
              <li className="sidebar-nav-item">
                <a 
                  href="#" 
                  className={`sidebar-nav-link ${viewType === 'manage' && filterType === 'persons' ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); setViewType('manage'); handleFilterChange('persons'); setSidebarOpen(false); }}
                >
                  <i className="fa fa-users"></i>
                  <span>Persons</span>
                  <span className="nav-count">{counts.persons}</span>
                </a>
              </li>
            </ul>
          </div>
          
          {/* Main Content */}
          <div className="main-content">
            {viewType === 'establishments' ? (
              <div className="embedded-establishments-view">
                <Establishments embedded={true} />
              </div>
            ) : (
              <>
              {/* Header Section */}
              <div className="row mb-4">
                <div className="col-md-6">
                  <h3><i className="fa fa-building"></i> Manage Establishments</h3>
                  <p className="text-muted">Organize and manage your business establishments</p>
                </div>
                <div className="col-md-6 text-end">
                  <div className="btn-group" role="group">
                    <button 
                      className="btn btn-info btn-lg"
                      onClick={() => setShowAddPersonModal(true)}
                    >
                      <i className="fa fa-user-plus"></i> Add New Person
                    </button>
                    <button 
                      className="btn btn-success btn-lg"
                      onClick={() => setShowAddCompanyModal(true)}
                    >
                      <i className="fa fa-plus"></i> Add New Establishment
                    </button>
                    <button 
                      className="btn btn-purple btn-lg"
                      onClick={() => setShowAIGeneratorModal(true)}
                    >
                      <i className="fa fa-magic"></i> AI Design Generator
                    </button>
                  </div>
                </div>
              </div>

              {/* Search Section */}
              <div className="search-container">
                <form onSubmit={handleSearch}>
                  <div className="row align-items-end">
                    <div className="col-md-6 mb-2">
                      <label htmlFor="search" className="form-label">Search Establishments</label>
                      <input
                        type="text"
                        id="search"
                        className="form-control form-control-lg"
                        placeholder="Search by company name or number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3 mb-2">
                      <label htmlFor="sort" className="form-label">Sort By</label>
                      <select
                        id="sort"
                        className="form-select form-select-lg"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="name">Company Name</option>
                        <option value="expiry">Expiry Date</option>
                        <option value="quota">Quota</option>
                      </select>
                    </div>
                    <div className="col-md-3 mb-2">
                      <button type="submit" className="btn btn-primary btn-lg w-100">
                        <i className="fa fa-search"></i> Search
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Establishments Cards Container */}
              <div className="row" id="establishmentsContainer">
                {loading ? (
                  <div className="col-12 text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : filterType === 'persons' ? (
                  /* Persons View */
                  persons.length === 0 ? (
                    <div className="col-12 text-center py-5">
                      <p className="text-muted">No persons found.</p>
                    </div>
                  ) : (
                    persons.map((person) => (
                      <div key={person.person_id} className="col-md-6 col-lg-4 mb-4">
                        <div className="establishment-card">
                          <div className="card-header-custom">
                            <h5 className="mb-0">{person.person_name || person.full_name}</h5>
                          </div>
                          <div className="card-body-custom">
                            <p><strong>Role:</strong> {person.person_role || person.role || 'Not specified'}</p>
                            <p><strong>Passport:</strong> {person.passport_number || 'Not specified'}</p>
                            <p><strong>Emirates ID:</strong> {person.emirates_id || 'Not specified'}</p>
                            <p><strong>Phone:</strong> {person.phone || 'Not specified'}</p>
                            <p><strong>Email:</strong> {person.email || 'Not specified'}</p>
                            {person.nationality && <p><strong>Nationality:</strong> {person.nationality}</p>}
                            
                            <div className="mt-3">
                              <small className="text-muted d-block mb-2">
                                <i className="fa fa-info-circle"></i> To add more details, use "Add New Person" with complete information
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : establishments.length === 0 ? (
                  <div className="col-12 text-center py-5">
                    <p className="text-muted">No establishments found.</p>
                  </div>
                ) : (
                  establishments.map((establishment) => (
                    <div key={establishment.company_id} className="col-md-6 col-lg-4 mb-4">
                      <div className={`establishment-card ${establishment.missing_documents && establishment.missing_documents.length > 0 ? 'missing-docs-card' : ''}`}>
                        <div className="card-header-custom">
                          <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">{establishment.company_name}</h5>
                            {establishment.missing_documents && establishment.missing_documents.length > 0 && (
                              <div className="missing-doc-indicator">
                                {establishment.missing_documents.length}
                              </div>
                            )}
                          </div>
                          <span className={`establishment-badge ${establishment.company_type === 'Mainland' ? 'mainland-badge' : 'freezone-badge'}`}>
                            {establishment.company_type}
                          </span>
                        </div>
                        <div className="card-body-custom">
                          <p><strong>Company Number:</strong> {establishment.company_number}</p>
                          <p><strong>Expiry Date:</strong> 
                            <span className={isExpired(establishment.expiry_date) ? 'text-danger' : ''}>
                              {' '}{formatDate(establishment.expiry_date)}
                            </span>
                          </p>
                          <p><strong>Quota:</strong> {establishment.quota || 0}</p>
                          
                          {establishment.missing_documents && establishment.missing_documents.length > 0 && (
                            <div className="missing-docs-list">
                              <strong>Missing Documents:</strong>
                              {establishment.missing_documents.map((doc, idx) => (
                                <span key={idx} className="missing-doc-item">{doc}</span>
                              ))}
                            </div>
                          )}
                          
                          <div className="action-buttons mt-3">
                            <button 
                              className="btn btn-primary btn-action"
                              onClick={() => {
                                setSelectedCompany(establishment);
                                setShowEditCompanyModal(true);
                              }}
                            >
                              <i className="fa fa-edit"></i> Edit
                            </button>
                            <button 
                              className="btn btn-success btn-action"
                              onClick={() => {
                                setSelectedCompanyForAttachments(establishment);
                                setShowAttachmentsModal(true);
                              }}
                            >
                              <i className="fa fa-paperclip"></i> Attachments
                            </button>
                            <button 
                              className="btn btn-info btn-action"
                              onClick={() => navigate(`/establishments/${establishment.company_id}/employees`)}
                            >
                              <i className="fa fa-users"></i> Employees
                            </button>
                              <button 
                              className="btn btn-danger btn-action"
                              onClick={async () => {
                                const result = await Swal.fire({
                                  title: 'Are you sure?',
                                  text: 'This will delete the establishment permanently!',
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonColor: '#dc3545',
                                  cancelButtonColor: '#6c757d',
                                  confirmButtonText: 'Yes, delete it!'
                                });
                                
                                if (result.isConfirmed) {
                                  try {
                                    const formData = new FormData();
                                    formData.append('action', 'deleteCompany');
                                    formData.append('companyId', establishment.company_id.toString());
                                    
                                    const response = await axios.post('/establishments/manage-establishments.php', formData, {
                                      headers: {
                                        'Content-Type': 'multipart/form-data'
                                      }
                                    });
                                    
                                    if (response.data && response.data.success) {
                                      Swal.fire('Deleted!', response.data.message || 'Establishment has been deleted.', 'success');
                                      loadEstablishments();
                                      loadSidebarCounts();
                                    } else {
                                      Swal.fire('Error', response.data?.message || 'Failed to delete establishment', 'error');
                                    }
                                  } catch (error: any) {
                                    Swal.fire('Error', error.response?.data?.message || 'Failed to delete establishment', 'error');
                                  }
                                }
                              }}
                            >
                              <i className="fa fa-trash"></i> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {!loading && establishments.length > 0 && totalPages > 1 && (
                <div className="row mt-4">
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center flex-wrap">
                      <div className="d-flex align-items-center mb-2">
                        <label htmlFor="recordsPerPage" className="me-2 mb-0">Records per page:</label>
                        <select
                          id="recordsPerPage"
                          className="form-select form-select-sm"
                          style={{ width: 'auto' }}
                          value={recordsPerPage}
                          onChange={handleRecordsPerPageChange}
                        >
                          <option value="6">6</option>
                          <option value="12">12</option>
                          <option value="24">24</option>
                          <option value="48">48</option>
                        </select>
                        <span className="ms-3 text-muted">
                          Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, totalRecords)} of {totalRecords} records
                        </span>
                      </div>
                      
                      <nav>
                        <ul className="pagination mb-0">
                          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => handlePageChange(currentPage - 1)}
                              disabled={currentPage === 1}
                            >
                              <i className="fa fa-chevron-left"></i> Previous
                            </button>
                          </li>
                          
                          {/* Page numbers */}
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
                              <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                <button
                                  className="page-link"
                                  onClick={() => handlePageChange(pageNum)}
                                >
                                  {pageNum}
                                </button>
                              </li>
                            );
                          })}
                          
                          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => handlePageChange(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            >
                              Next <i className="fa fa-chevron-right"></i>
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
              </>
            )}
          </div>

      {/* Modals */}
      <AddEstablishmentModal
        isOpen={showAddCompanyModal}
        onClose={() => setShowAddCompanyModal(false)}
        onSuccess={() => {
          loadEstablishments();
          loadSidebarCounts();
        }}
      />
      
      <AddPersonModal
        isOpen={showAddPersonModal}
        onClose={() => setShowAddPersonModal(false)}
        onSuccess={() => {
          loadPersons();
          loadSidebarCounts();
        }}
      />
      
      <EditEstablishmentModal
        isOpen={showEditCompanyModal}
        onClose={() => {
          setShowEditCompanyModal(false);
          setSelectedCompany(null);
        }}
        onSuccess={() => {
          loadEstablishments();
          loadSidebarCounts();
        }}
        establishment={selectedCompany}
      />
      
      <CompanyAttachmentsModal
        isOpen={showAttachmentsModal}
        onClose={() => {
          setShowAttachmentsModal(false);
          setSelectedCompanyForAttachments(null);
        }}
        companyId={selectedCompanyForAttachments?.company_id || 0}
        companyName={selectedCompanyForAttachments?.company_name || ''}
      />
    </div>
  );
}

