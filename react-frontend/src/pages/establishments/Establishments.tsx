import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import establishmentService from '../../services/establishmentService';
import type { Establishment, EstablishmentFilters } from '../../services/establishmentService';
import Swal from 'sweetalert2';
import './Establishments.css';

interface EstablishmentsProps {
  embedded?: boolean;
}

export default function Establishments({ embedded = false }: EstablishmentsProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<{
    totalEstablishments: number;
    totalEmployees: number;
    totalQuota: number;
    availableQuota: number;
  }>({
    totalEstablishments: 0,
    totalEmployees: 0,
    totalQuota: 0,
    availableQuota: 0
  });
  const [localNames, setLocalNames] = useState<Array<{ local_name: string }>>([]);
  
  // Filter states
  const [companyName, setCompanyName] = useState(searchParams.get('companyName') || '');
  const [companyType, setCompanyType] = useState(searchParams.get('companyType') || '');
  const [localName, setLocalName] = useState(searchParams.get('localName') || '');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;

  useEffect(() => {
    loadEstablishments();
  }, [currentPage, companyName, companyType, localName]);

  const loadEstablishments = async () => {
    setLoading(true);
    try {
      const filters: EstablishmentFilters = {
        companyName: companyName || undefined,
        companyType: companyType || undefined,
        localName: localName || undefined,
        page: currentPage,
        limit: recordsPerPage
      };
      
      const response = await establishmentService.getEstablishments(filters);
      
      console.log('Establishments API Response:', response);
      
      // Safely handle response structure
      if (response && response.data) {
        setEstablishments(response.data || []);
        setStatistics(response.statistics || {
          totalEstablishments: 0,
          totalEmployees: 0,
          totalQuota: 0,
          availableQuota: 0
        });
        setLocalNames(response.localNames || []);
        
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages || 1);
          setTotalRecords(response.pagination.totalRecords || 0);
        } else {
          setTotalPages(1);
          setTotalRecords(response.data?.length || 0);
        }
      } else {
        // Fallback if response structure is different
        setEstablishments([]);
        setStatistics({
          totalEstablishments: 0,
          totalEmployees: 0,
          totalQuota: 0,
          availableQuota: 0
        });
        setLocalNames([]);
        setTotalPages(1);
        setTotalRecords(0);
      }
      
      // Update URL params
      const params = new URLSearchParams();
      if (companyName) params.set('companyName', companyName);
      if (companyType) params.set('companyType', companyType);
      if (localName) params.set('localName', localName);
      if (currentPage > 1) params.set('page', currentPage.toString());
      setSearchParams(params);
    } catch (error: any) {
      console.error('Error loading establishments:', error);
      console.error('Error details:', error.response?.data);
      Swal.fire('Error', error.message || 'Failed to load establishments', 'error');
      
      // Set defaults on error
      setEstablishments([]);
      setStatistics({
        totalEstablishments: 0,
        totalEmployees: 0,
        totalQuota: 0,
        availableQuota: 0
      });
      setLocalNames([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadEstablishments();
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleViewEmployees = (companyID: number) => {
    navigate(`/establishments/${companyID}/employees`);
  };

  const handleManageEstablishments = () => {
    navigate('/establishments/manage');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="establishments-page">
      <div className="container-fluid">
        <div className="row mb-4">
          <div className="col-md-5">
            <h3>Establishments</h3>
          </div>
          {!embedded && (
            <div className="col-md-7 text-end">
              <button className="btn btn-success" onClick={handleManageEstablishments}>
                Manage Establishments
              </button>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="widget widget-stats bg-blue">
              <div className="stats-icon">
                <i className="fa fa-building"></i>
              </div>
              <div className="stats-info">
                <h4>TOTAL ESTABLISHMENTS</h4>
                <p id="totalCompanies">{formatNumber(statistics.totalEstablishments)}</p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="widget widget-stats bg-red">
              <div className="stats-icon">
                <i className="fa fa-users"></i>
              </div>
              <div className="stats-info">
                <h4>TOTAL EMPLOYEES</h4>
                <p id="totalEmployees">{formatNumber(statistics.totalEmployees)}</p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="widget widget-stats bg-purple">
              <div className="stats-icon">
                <i className="fa fa-address-card"></i>
              </div>
              <div className="stats-info">
                <h4>TOTAL QUOTA</h4>
                <p id="totalQuota">{formatNumber(statistics.totalQuota)}</p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="widget widget-stats bg-green">
              <div className="stats-icon">
                <i className="fa fa-at"></i>
              </div>
              <div className="stats-info">
                <h4>AVAILABLE QUOTA</h4>
                <p id="availableQuota">{formatNumber(statistics.availableQuota)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Form */}
        <form onSubmit={handleFilter} className="mb-4">
          <div className="row">
            <div className="col-md-3">
              <label className="form-label" htmlFor="companyName">Company Name</label>
              <input
                type="text"
                name="companyName"
                id="companyName"
                className="form-control"
                placeholder="Enter Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="companyType">
                Company Type <span className="text-danger">*</span>
              </label>
              <select
                name="companyType"
                id="companyType"
                className="form-select"
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Mainland">Mainland</option>
                <option value="Freezone">Freezone</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="localName">Local name</label>
              <select
                name="localName"
                id="localName"
                className="form-select"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
              >
                <option value="">Select Local Name</option>
                {localNames.map((ln, index) => (
                  <option key={index} value={ln.local_name ? btoa(ln.local_name) : ''}>
                    {ln.local_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <label htmlFor="submit">&nbsp;</label>
              <button type="submit" id="submit" className="btn btn-primary w-100">
                Filter
              </button>
            </div>
          </div>
        </form>

        {/* Establishments Grid */}
        {loading ? (
          <div className="text-center py-5">
            <i className="fa fa-spinner fa-spin fa-3x"></i>
            <p className="mt-3">Loading establishments...</p>
          </div>
        ) : establishments.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted">No establishments found</p>
          </div>
        ) : (
          <>
            <div className="row">
              {establishments.map((company) => {
                const availableQuota = company.starting_quota - company.totalEmployees;
                return (
                  <div key={company.company_id} className="col-sm-6 mb-3">
                    <div className="card">
                      <div className="card-body">
                        <h5 className="mb-0">{company.company_name}</h5>
                        <p className="mb-0">
                          <i className="fa fa-building"></i> {company.company_type}
                        </p>
                        <div className="row mt-3">
                          <div className="col-md-3">
                            <strong>Employees</strong>
                            <br />
                            {company.totalEmployees}
                          </div>
                          <div className="col-md-3">
                            <strong>A. Quota</strong>
                            <br />
                            {availableQuota}
                          </div>
                          <div className="col-md-3">
                            <strong>Expiry Date</strong>
                            <br />
                            {formatDate(company.company_expiry)}
                          </div>
                          <div className="col-md-3">
                            <strong>Code</strong>
                            <br />
                            {company.company_number}
                          </div>
                        </div>
                        <div className="row">
                          <div className="col-md-12 mt-4">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleViewEmployees(company.company_id)}
                            >
                              View Employees
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Page navigation" className="custom-pagination mt-4 mb-4">
                <ul className="pagination justify-content-center">
                  {currentPage > 1 && (
                    <li className="page-item">
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage - 1)}
                      >
                        &laquo; Previous
                      </button>
                    </li>
                  )}

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <li
                      key={page}
                      className={`page-item ${currentPage === page ? 'active' : ''}`}
                    >
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    </li>
                  ))}

                  {currentPage < totalPages && (
                    <li className="page-item">
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage + 1)}
                      >
                        Next &raquo;
                      </button>
                    </li>
                  )}
                </ul>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

