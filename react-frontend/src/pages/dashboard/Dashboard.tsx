import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import dashboardService from '../../services/dashboardService';
import type { TodayStats, DailyEntry } from '../../types/dashboard';
import EnhancedCalendar from '../../components/dashboard/EnhancedCalendar';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Load today's statistics
  useEffect(() => {
    loadTodayStats();
  }, []);

  const loadTodayStats = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading today\'s stats...');
      const data = await dashboardService.getTodayStats();
      console.log('Stats loaded:', data);
      setStats(data);
    } catch (error: any) {
      console.error('Error loading today\'s stats:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to load statistics';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyEntries = async () => {
    try {
      setLoadingEntries(true);
      console.log('Loading daily entries for:', fromDate, 'to', toDate);
      const data = await dashboardService.getDailyEntries({ fromDate, toDate });
      console.log('Daily entries loaded:', data.length, 'entries');
      setDailyEntries(data);
    } catch (error: any) {
      console.error('Error loading daily entries:', error);
      alert(error.response?.data?.message || 'Failed to load daily entries');
    } finally {
      setLoadingEntries(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals
  const totalRevenue = stats
    ? parseFloat(stats.ticket_profit as any) + parseFloat(stats.Visa_Profit as any)
    : 0;
  
  const totalTransactions = stats
    ? (stats.Todays_Ticket || 0) + (stats.Todays_Visa || 0)
    : 0;
  
  const totalProfit = totalRevenue - (stats ? parseFloat(stats.Total_Expense as any) : 0);

  return (
    <div>
      {/* Page Header */}
      <h1 className="page-header mb-3">Dashboard v1.2</h1>

      {/* Debug Info - Only for development */}
      {import.meta.env.DEV && user && (
        <div className="alert alert-info mb-3" style={{ fontSize: '11px' }}>
          <strong>Debug Info:</strong> User: {user.staff_name} | Role ID: {user.role_id} | Role Name: {user.role_name || 'Not set'}
        </div>
      )}

      {/* Main Dashboard Row */}
      <div className="row mb-4">
        {/* Calendar Widget - Left Column */}
        <div className="col-lg-4 col-md-6 col-12">
          <EnhancedCalendar />
        </div>

        {/* Statistics Cards - Right Column */}
        <div className="col-lg-8 col-md-6 col-12">
          {loading ? (
            <div className="text-center text-muted mt-5">
              <i className="fas fa-spinner fa-spin fa-3x mb-3" style={{ color: '#dc2626' }}></i>
              <h5>Loading Today's Statistics...</h5>
              <p>Dashboard data will appear here once loaded</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger mt-5">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
              <button className="btn btn-sm btn-danger ms-3" onClick={loadTodayStats}>
                <i className="fas fa-redo me-1"></i> Retry
              </button>
            </div>
          ) : stats ? (
            <div className="row">
              {/* Tickets Widget */}
              <div className="col-lg-6 col-md-6 mb-3">
                <div className="modern-widget">
                  <div className="widget-icon">
                    <i className="fas fa-plane"></i>
                  </div>
                  <div className="stat-number">{stats.Todays_Ticket || 0}</div>
                  <div className="stat-label">Today's Tickets</div>
                  <div className="stat-progress">
                    <div className="progress-bar" style={{ width: `${Math.min((stats.Todays_Ticket || 0) * 10, 100)}%` }}></div>
                  </div>
                  <div className="stat-desc">Revenue: د.إ{formatCurrency(stats.ticket_profit)}</div>
                </div>
              </div>

              {/* Visa Widget */}
              <div className="col-lg-6 col-md-6 mb-3">
                <div className="modern-widget">
                  <div className="widget-icon">
                    <i className="fas fa-passport"></i>
                  </div>
                  <div className="stat-number">{stats.Todays_Visa || 0}</div>
                  <div className="stat-label">Today's Visas</div>
                  <div className="stat-progress">
                    <div className="progress-bar" style={{ width: `${Math.min((stats.Todays_Visa || 0) * 10, 100)}%` }}></div>
                  </div>
                  <div className="stat-desc">Revenue: د.إ{formatCurrency(stats.Visa_Profit)}</div>
                </div>
              </div>

              {/* Expenses Widget */}
              <div className="col-lg-6 col-md-6 mb-3">
                <div className="modern-widget">
                  <div className="widget-icon expense-icon">
                    <i className="fas fa-wallet"></i>
                  </div>
                  <div className="stat-number">د.إ{formatCurrency(stats.Total_Expense)}</div>
                  <div className="stat-label">Today's Expenses</div>
                  <div className="stat-progress">
                    <div className="expense-bar progress-bar" style={{ width: `${Math.min((stats.Total_Expense || 0) / 50, 100)}%` }}></div>
                  </div>
                  <div className="stat-desc">Total Spent: د.إ{formatCurrency(stats.Total_Expense)}</div>
                </div>
              </div>

              {/* Total Transactions Widget */}
              <div className="col-lg-6 col-md-6 mb-3">
                <div className="modern-widget">
                  <div className="widget-icon profit-icon">
                    <i className="fas fa-calculator"></i>
                  </div>
                  <div className="stat-number profit-number">{totalTransactions}</div>
                  <div className="stat-label">Total Transactions</div>
                  <div className="stat-progress">
                    <div className="profit-bar progress-bar" style={{ width: `${Math.min(Math.abs(totalTransactions * 5), 100)}%` }}></div>
                  </div>
                  <div className="stat-desc">Revenue: د.إ{formatCurrency(totalRevenue)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-danger">Failed to load statistics</div>
          )}
        </div>
      </div>

      {/* Daily Entries Report */}
      {(user?.role_name === 'Admin' || user?.role_id === 1) && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card dashboard-card modern-report-card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-chart-line me-2"></i>
                  Daily Entries Report
                </h5>
              </div>
              <div className="card-body">
                <div className="row mb-3">
                  <div className="col-lg-2">
                    <label htmlFor="fromdate">From:</label>
                    <input
                      type="date"
                      className="form-control"
                      id="fromdate"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-2">
                    <label htmlFor="todate">To:</label>
                    <input
                      type="date"
                      className="form-control"
                      id="todate"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  <div className="col-lg-2">
                    <button
                      className="btn btn-danger mt-3"
                      onClick={loadDailyEntries}
                      disabled={loadingEntries}
                    >
                      <i className="fa fa-search"></i> {loadingEntries ? 'Loading...' : 'Search'}
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table mb-0 table-dark table-hover table-striped">
                    <thead>
                      <tr className="bg-dark text-white" style={{ fontSize: '12px', fontWeight: 600 }}>
                        <th>#</th>
                        <th>Entry Type</th>
                        <th>Customer Name</th>
                        <th>Passenger Name</th>
                        <th>Entry Details</th>
                        <th>Date Time</th>
                        <th>Entry By</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontSize: '11px', fontWeight: 600 }}>
                      {loadingEntries ? (
                        <tr>
                          <td colSpan={7} className="text-center py-4">
                            <i className="fas fa-spinner fa-spin me-2"></i>Loading entries...
                          </td>
                        </tr>
                      ) : dailyEntries.length > 0 ? (
                        dailyEntries.map((entry, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{entry.EntryType}</td>
                            <td>{entry.customer_name}</td>
                            <td>{entry.passenger_name}</td>
                            <td dangerouslySetInnerHTML={{ __html: entry.Details }}></td>
                            <td>{new Date(entry.datetime).toLocaleString()}</td>
                            <td>{entry.staff_name}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-4">
                            No entries found for the selected date range. Click "Search" to load data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card dashboard-card">
            <div className="card-header">
              <h5 className="mb-0">
                <i className="fas fa-bolt me-2"></i>
                Quick Actions
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-lg-3 col-md-6 mb-3">
                  <button className="btn quick-action-btn w-100">
                    <i className="fas fa-plane me-2"></i>
                    New Ticket
                  </button>
                </div>
                <div className="col-lg-3 col-md-6 mb-3">
                  <button className="btn quick-action-btn w-100">
                    <i className="fas fa-passport me-2"></i>
                    New Visa
                  </button>
                </div>
                <div className="col-lg-3 col-md-6 mb-3">
                  <button className="btn quick-action-btn w-100">
                    <i className="fas fa-user-plus me-2"></i>
                    New Customer
                  </button>
                </div>
                <div className="col-lg-3 col-md-6 mb-3">
                  <button className="btn quick-action-btn w-100">
                    <i className="fas fa-money-bill-wave me-2"></i>
                    Quick Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline styles matching PHP dashboard */}
      <style>{`
        .text-red {
          color: #dc2626 !important;
        }
        
        .event-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 6px;
          background: white;
          border-radius: 8px;
          border-left: 4px solid #dc2626;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .event-item:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
        }
        
        .event-date {
          font-size: 0.75rem;
          color: #dc2626;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .event-title {
          font-size: 0.875rem;
          color: #1a1a1a;
          font-weight: 500;
        }
        
        .btn-danger {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%) !important;
          border: none !important;
        }
        
        .page-header {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1a1a;
        }
      `}</style>
    </div>
  );
}
