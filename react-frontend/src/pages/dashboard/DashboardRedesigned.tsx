import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import type { TodayStats, DailyEntry, DashboardFilters } from '../../types/dashboard';
import { EnhancedCalendar } from '../../components/dashboard/EnhancedCalendar';
import './DashboardRedesigned.css';

export const DashboardRedesigned: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Default to last 30 days to show data
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState<DashboardFilters>({
    fromDate: getDefaultStartDate(),
    toDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsData, entriesData] = await Promise.all([
        dashboardService.getTodayStats(),
        dashboardService.getDailyEntries(filters),
      ]);
      
      setStats(statsData);
      setDailyEntries(entriesData);
    } catch (err: any) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period: 'today' | 'week' | 'month') => {
    setSelectedPeriod(period);
    setCurrentPage(1); // Reset to first page
    const today = new Date();
    const startDate = new Date();

    if (period === 'today') {
      // Show last 30 days for "today" to ensure we have data
      startDate.setDate(today.getDate() - 30);
    } else if (period === 'week') {
      startDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(today.getMonth() - 1);
    }

    setFilters({
      fromDate: startDate.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0],
    });
  };

  const formatCurrency = (value: number = 0) => {
    return value.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalTransactions = (stats?.Todays_Ticket || 0) + (stats?.Todays_Visa || 0);
  const totalRevenue = (stats?.ticket_profit || 0) + (stats?.Visa_Profit || 0);

  // Pagination calculations
  const totalPages = Math.ceil(dailyEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = dailyEntries.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Keyboard navigation for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
      }
    };

    if (dailyEntries.length > itemsPerPage) {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [currentPage, totalPages, dailyEntries.length, itemsPerPage]);

  if (loading && !stats) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner-large"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-redesigned">

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        {/* Tickets Card */}
        <div className="stat-card stat-card-primary">
          <div className="stat-card-bg"></div>
          <div className="stat-card-content">
            <div className="stat-icon-wrapper">
              <div className="stat-icon stat-icon-primary">
                <i className="fas fa-plane-departure"></i>
              </div>
              <div className="stat-pulse"></div>
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats?.Todays_Ticket || 0}</div>
              <div className="stat-label">Today's Tickets</div>
              <div className="stat-revenue">
                <i className="fas fa-coins"></i>
                د.إ{formatCurrency(stats?.ticket_profit)}
              </div>
            </div>
          </div>
          <div className="stat-progress-wrapper">
            <div 
              className="stat-progress-fill stat-progress-primary"
              style={{ width: `${Math.min((stats?.Todays_Ticket || 0) * 10, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Visas Card */}
        <div className="stat-card stat-card-success">
          <div className="stat-card-bg"></div>
          <div className="stat-card-content">
            <div className="stat-icon-wrapper">
              <div className="stat-icon stat-icon-success">
                <i className="fas fa-passport"></i>
              </div>
              <div className="stat-pulse"></div>
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats?.Todays_Visa || 0}</div>
              <div className="stat-label">Today's Visas</div>
              <div className="stat-revenue">
                <i className="fas fa-coins"></i>
                د.إ{formatCurrency(stats?.Visa_Profit)}
              </div>
            </div>
          </div>
          <div className="stat-progress-wrapper">
            <div 
              className="stat-progress-fill stat-progress-success"
              style={{ width: `${Math.min((stats?.Todays_Visa || 0) * 10, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="stat-card stat-card-warning">
          <div className="stat-card-bg"></div>
          <div className="stat-card-content">
            <div className="stat-icon-wrapper">
              <div className="stat-icon stat-icon-warning">
                <i className="fas fa-receipt"></i>
              </div>
              <div className="stat-pulse"></div>
            </div>
            <div className="stat-info">
              <div className="stat-value">د.إ{formatCurrency(stats?.Total_Expense)}</div>
              <div className="stat-label">Total Expenses</div>
              <div className="stat-revenue stat-expense">
                <i className="fas fa-arrow-down"></i>
                Today's Spending
              </div>
            </div>
          </div>
          <div className="stat-progress-wrapper">
            <div 
              className="stat-progress-fill stat-progress-warning"
              style={{ width: `${Math.min((stats?.Total_Expense || 0) / 50, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="stat-card stat-card-info">
          <div className="stat-card-bg"></div>
          <div className="stat-card-content">
            <div className="stat-icon-wrapper">
              <div className="stat-icon stat-icon-info">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="stat-pulse"></div>
            </div>
            <div className="stat-info">
              <div className="stat-value">{totalTransactions}</div>
              <div className="stat-label">Total Transactions</div>
              <div className="stat-revenue stat-positive">
                <i className="fas fa-arrow-up"></i>
                د.إ{formatCurrency(totalRevenue)}
              </div>
            </div>
          </div>
          <div className="stat-progress-wrapper">
            <div 
              className="stat-progress-fill stat-progress-info"
              style={{ width: `${Math.min(Math.abs(totalTransactions * 5), 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content-grid">
        {/* Calendar Section */}
        <div className="dashboard-section calendar-section">
          <div className="section-header">
            <h2 className="section-title">
              <i className="far fa-calendar-alt"></i>
              Calendar Overview
            </h2>
          </div>
          <div className="section-body">
            <EnhancedCalendar />
          </div>
        </div>

        {/* Daily Entries Section - Admin Only */}
        {(user?.role_name === 'Admin' || user?.role_id === 1) && (
          <div className="dashboard-section entries-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">
                  <i className="fas fa-clipboard-list"></i>
                  Daily Report
                </h2>
                <p className="section-subtitle">
                  Showing {startIndex + 1}-{Math.min(endIndex, dailyEntries.length)} of {dailyEntries.length} entries
                </p>
              </div>
              <div className="period-selector">
                <button
                  className={`period-btn ${selectedPeriod === 'today' ? 'active' : ''}`}
                  onClick={() => handlePeriodChange('today')}
                >
                  Recent
                </button>
                <button 
                  className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
                  onClick={() => handlePeriodChange('week')}
                >
                  Week
                </button>
                <button 
                  className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
                  onClick={() => handlePeriodChange('month')}
                >
                  Month
                </button>
              </div>
            </div>
            <div className="section-body">
              {dailyEntries.length > 0 ? (
                <>
                  <div className="entries-table-wrapper">
                    <table className="entries-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Amount</th>
                        <th>Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEntries.map((entry, index) => (
                        <tr key={startIndex + index} className="entry-row">
                          <td className="entry-date">
                            {new Date(entry.datetime || entry.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </td>
                          <td>
                            <span className={`entry-type entry-type-${(entry.EntryType || entry.type || 'other').toLowerCase()}`}>
                              {entry.EntryType || entry.type || 'Entry'}
                            </span>
                          </td>
                          <td className="entry-details">{entry.Details || entry.details || '-'}</td>
                          <td className="entry-amount">
                            <span className="amount-positive">
                              د.إ{formatCurrency(entry.amount || 0)}
                            </span>
                          </td>
                          <td className="entry-staff">{entry.staff_name || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {dailyEntries.length > itemsPerPage && (
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn pagination-btn-prev"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                    >
                      <i className="fas fa-chevron-left"></i>
                      Previous
                    </button>
                    
                    <div className="pagination-pages">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                            className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                            onClick={() => handlePageClick(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button 
                      className="pagination-btn pagination-btn-next"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
                </>
              ) : (
                <div className="no-entries">
                  <i className="fas fa-inbox"></i>
                  <p>No entries found for this period</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn action-btn-primary">
          <i className="fas fa-plus-circle"></i>
          New Ticket
        </button>
        <button className="action-btn action-btn-success">
          <i className="fas fa-passport"></i>
          New Visa
        </button>
        <button className="action-btn action-btn-warning">
          <i className="fas fa-file-invoice-dollar"></i>
          New Expense
        </button>
        <button className="action-btn action-btn-info">
          <i className="fas fa-chart-bar"></i>
          View Reports
        </button>
      </div>
    </div>
  );
};

export default DashboardRedesigned;

