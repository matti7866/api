import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import residenceService from '../../services/residenceService';
import type { Residence, ResidenceFilters } from '../../types/residence';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';

export default function ResidenceList() {
  const navigate = useNavigate();
  const [residences, setResidences] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  
  // Filters
  const [filters, setFilters] = useState<ResidenceFilters>({});
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Lookups
  const [lookups, setLookups] = useState<any>(null);
  
  // Stats
  const [stats, setStats] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadResidences();
  }, [currentPage, filters]);

  const loadLookups = async () => {
    try {
      const data = await residenceService.getLookups();
      setLookups(data);
    } catch (err: any) {
      console.error('Error loading lookups:', err);
    }
  };

  const loadResidences = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await residenceService.getResidences({
        ...filters,
        search,
        page: currentPage,
        limit
      });
      
      setResidences(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred while loading residences');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await residenceService.getStats();
      setStats(data);
      setShowStats(true);
    } catch (err: any) {
      console.error('Error loading stats:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadResidences();
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setCurrentPage(1);
  };

  const getStatusBadge = (residence: Residence) => {
    if (residence.cancelled) {
      return <span className="px-2 py-1 text-xs font-semibold rounded bg-red-600 text-white">Cancelled</span>;
    }
    if (residence.hold) {
      return <span className="px-2 py-1 text-xs font-semibold rounded bg-yellow-600 text-white">On Hold</span>;
    }
    if (residence.completedStep === 10) {
      return <span className="px-2 py-1 text-xs font-semibold rounded bg-green-600 text-white">Completed</span>;
    }
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white">
        Step {residence.completedStep}/10
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount: number, symbol: string = 'AED') => {
    return `${symbol} ${amount.toLocaleString()}`;
  };

  if (loading && residences.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Residence Report</h1>
            <p className="text-gray-400 mt-1">
              Manage visa processing workflow - {total} total records
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadStats} variant="secondary">
              <i className="fa fa-chart-bar mr-2"></i>
              Statistics
            </Button>
            <Button onClick={() => navigate('/residence/create')}>
              <i className="fa fa-plus-circle mr-2"></i>
              Add New Residence
            </Button>
          </div>
        </div>

        {/* Search & Quick Filters */}
        <div className="card p-4">
          <form onSubmit={handleSearch} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                className="input-field w-full"
                placeholder="Search by passenger name, passport, UID, Emirates ID, company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit">
              <i className="fa fa-search mr-2"></i>
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowFilters(!showFilters)}>
              <i className={`fa fa-filter mr-2 ${showFilters ? 'text-primary-red' : ''}`}></i>
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            {(Object.keys(filters).length > 0 || search) && (
              <Button type="button" variant="danger" onClick={clearFilters}>
                <i className="fa fa-times mr-2"></i>
                Clear
              </Button>
            )}
          </form>

          {/* Advanced Filters */}
          {showFilters && lookups && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <select
                  className="input-field w-full"
                  value={filters.company || ''}
                  onChange={(e) => handleFilterChange('company', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">All Companies</option>
                  {lookups.companies.map((c: any) => (
                    <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nationality</label>
                <select
                  className="input-field w-full"
                  value={filters.nationality || ''}
                  onChange={(e) => handleFilterChange('nationality', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">All Nationalities</option>
                  {lookups.nationalities.map((n: any) => (
                    <option key={n.nationality_id} value={n.nationality_id}>{n.nationality_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Visa Type</label>
                <select
                  className="input-field w-full"
                  value={filters.visaType || ''}
                  onChange={(e) => handleFilterChange('visaType', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">All Visa Types</option>
                  {lookups.visaTypes.map((v: any) => (
                    <option key={v.visa_id} value={v.visa_id}>{v.visa_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Completed Step</label>
                <select
                  className="input-field w-full"
                  value={filters.completedStep !== undefined ? filters.completedStep : ''}
                  onChange={(e) => handleFilterChange('completedStep', e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">All Steps</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(step => (
                    <option key={step} value={step}>Step {step}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date From</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Date To</label>
                <input
                  type="date"
                  className="input-field w-full"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                <select
                  className="input-field w-full"
                  value={filters.cancelled !== undefined ? (filters.cancelled ? 'cancelled' : 'active') : ''}
                  onChange={(e) => {
                    if (e.target.value === 'cancelled') {
                      handleFilterChange('cancelled', true);
                    } else if (e.target.value === 'active') {
                      handleFilterChange('cancelled', false);
                    } else {
                      handleFilterChange('cancelled', undefined);
                    }
                  }}
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Hold Status</label>
                <select
                  className="input-field w-full"
                  value={filters.hold !== undefined ? (filters.hold ? 'hold' : 'active') : ''}
                  onChange={(e) => {
                    if (e.target.value === 'hold') {
                      handleFilterChange('hold', true);
                    } else if (e.target.value === 'active') {
                      handleFilterChange('hold', false);
                    } else {
                      handleFilterChange('hold', undefined);
                    }
                  }}
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="hold">On Hold</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Statistics Modal */}
      {showStats && stats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Residence Statistics</h2>
                <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-white">
                  <i className="fa fa-times text-2xl"></i>
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card p-4 bg-blue-900">
                  <div className="text-gray-300 text-sm">Total Residences</div>
                  <div className="text-3xl font-bold text-white mt-2">{stats.total_count || 0}</div>
                </div>
                <div className="card p-4 bg-yellow-900">
                  <div className="text-gray-300 text-sm">Pending</div>
                  <div className="text-3xl font-bold text-white mt-2">{stats.pending_count || 0}</div>
                </div>
                <div className="card p-4 bg-green-900">
                  <div className="text-gray-300 text-sm">Completed</div>
                  <div className="text-3xl font-bold text-white mt-2">{stats.completed_count || 0}</div>
                </div>
                <div className="card p-4 bg-red-900">
                  <div className="text-gray-300 text-sm">Cancelled</div>
                  <div className="text-3xl font-bold text-white mt-2">{stats.cancelled_count || 0}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card p-4">
                  <div className="text-gray-300 text-sm">Total Sales</div>
                  <div className="text-2xl font-bold text-green-400 mt-2">
                    AED {(stats.total_sale_value || 0).toLocaleString()}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-gray-300 text-sm">Total Costs</div>
                  <div className="text-2xl font-bold text-red-400 mt-2">
                    AED {(stats.total_cost_value || 0).toLocaleString()}
                  </div>
                </div>
                <div className="card p-4">
                  <div className="text-gray-300 text-sm">Total Profit</div>
                  <div className="text-2xl font-bold text-blue-400 mt-2">
                    AED {(stats.total_profit || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Charts can be added here */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.by_nationality && stats.by_nationality.length > 0 && (
                  <div className="card p-4">
                    <h3 className="text-lg font-bold text-white mb-4">Top Nationalities</h3>
                    <div className="space-y-2">
                      {stats.by_nationality.slice(0, 10).map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-gray-300">{item.nationality || 'Unknown'}</span>
                          <span className="font-bold text-white">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stats.by_step && stats.by_step.length > 0 && (
                  <div className="card p-4">
                    <h3 className="text-lg font-bold text-white mb-4">By Step</h3>
                    <div className="space-y-2">
                      {stats.by_step.map((item: any, index: number) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-gray-300">Step {item.step}</span>
                          <span className="font-bold text-white">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Passenger</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Nationality</th>
                <th className="px-4 py-3 text-left">Visa Type</th>
                <th className="px-4 py-3 text-left">Sale Price</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {residences.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    No residences found
                  </td>
                </tr>
              ) : (
                residences.map((residence) => (
                  <tr
                    key={residence.residenceID}
                    className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-300">#{residence.residenceID}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{residence.passenger_name}</div>
                      <div className="text-xs text-gray-400">{residence.passportNumber || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{residence.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{residence.company_name || 'Individual'}</td>
                    <td className="px-4 py-3 text-gray-300">{residence.nationality_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{residence.visa_type_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatCurrency(residence.sale_price, residence.sale_currency_symbol)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(residence)}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(residence.datetime)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/residence/${residence.residenceID}`)}
                      >
                        <i className="fa fa-eye"></i>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, total)} of {total} results
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <i className="fa fa-chevron-left"></i>
              </Button>
              <span className="px-4 py-2 text-white">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <i className="fa fa-chevron-right"></i>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

