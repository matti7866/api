import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { analyticsService } from '../../services/analyticsService';
import type {
  RealTimeComparison,
  SalesDataPoint,
  PerformanceData,
  MonthlyCountsData,
  WeeklyCountsData
} from '../../types/analytics';
import './DashboardAnalytics.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const DashboardAnalytics: React.FC = () => {
  const [realTimeData, setRealTimeData] = useState<RealTimeComparison | null>(null);
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyCountsData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyCountsData | null>(null);
  
  const [compareMode, setCompareMode] = useState(true); // Fair comparison mode
  const [periodSelect, setPeriodSelect] = useState<'month' | 'year' | 'ytd'>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);

  // Load real-time comparison
  const loadRealTimeData = async () => {
    try {
      const data = await analyticsService.getRealTimeComparison();
      setRealTimeData(data);
    } catch (error) {
      console.error('Error loading real-time data:', error);
    }
  };

  // Load sales data (30 days)
  const loadSalesData = async () => {
    try {
      const data = await analyticsService.getSalesData();
      setSalesData(data);
    } catch (error) {
      console.error('Error loading sales data:', error);
    }
  };

  // Load performance data
  const loadPerformanceData = async () => {
    try {
      const data = await analyticsService.getPerformance(periodSelect);
      setPerformanceData(data);
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  };

  // Load monthly counts
  const loadMonthlyData = async () => {
    try {
      const data = await analyticsService.getMonthlyCounts(selectedYear);
      setMonthlyData(data);
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  // Load weekly counts
  const loadWeeklyData = async () => {
    try {
      const data = await analyticsService.getWeeklyCounts(selectedYear, selectedMonth);
      setWeeklyData(data);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      await Promise.all([
        loadRealTimeData(),
        loadSalesData(),
        loadPerformanceData(),
        loadMonthlyData(),
        loadWeeklyData()
      ]);
      setLoading(false);
    };
    loadAllData();
  }, []);

  // Reload performance when period changes
  useEffect(() => {
    loadPerformanceData();
  }, [periodSelect]);

  // Reload monthly data when year changes
  useEffect(() => {
    loadMonthlyData();
  }, [selectedYear]);

  // Reload weekly data when year or month changes
  useEffect(() => {
    loadWeeklyData();
  }, [selectedYear, selectedMonth]);

  // Calculate percent change
  const calculatePercent = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  };

  // Render trend badge
  const renderTrendBadge = (current: number, previous: number) => {
    const percent = calculatePercent(current, previous);
    if (percent > 0) {
      return <span className="badge bg-success"><i className="fas fa-arrow-up"></i> {percent}%</span>;
    } else if (percent < 0) {
      return <span className="badge bg-danger"><i className="fas fa-arrow-down"></i> {Math.abs(percent)}%</span>;
    }
    return <span className="badge bg-secondary">0%</span>;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner-large"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  // Prepare hourly chart data
  const hourlyChartData = realTimeData ? {
    labels: Object.keys(realTimeData.hourlyBreakdown.ticket),
    datasets: [
      {
        label: 'Today - Ticket',
        data: Object.values(realTimeData.hourlyBreakdown.ticket),
        borderColor: '#000000',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false
      },
      {
        label: 'Avg - Ticket',
        data: Object.values(realTimeData.hourlyBreakdownPast.ticket),
        borderColor: '#000000',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        borderDash: [5, 5]
      },
      {
        label: 'Today - Residence',
        data: Object.values(realTimeData.hourlyBreakdown.residence),
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220,53,69,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false
      },
      {
        label: 'Avg - Residence',
        data: Object.values(realTimeData.hourlyBreakdownPast.residence),
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220,53,69,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        borderDash: [5, 5]
      },
      {
        label: 'Today - Visa',
        data: Object.values(realTimeData.hourlyBreakdown.visa),
        borderColor: '#fd7e14',
        backgroundColor: 'rgba(253,126,20,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false
      },
      {
        label: 'Avg - Visa',
        data: Object.values(realTimeData.hourlyBreakdownPast.visa),
        borderColor: '#fd7e14',
        backgroundColor: 'rgba(253,126,20,0.1)',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        borderDash: [5, 5]
      }
    ]
  } : null;

  // Prepare daily breakdown chart data
  const dailyChartData = realTimeData ? {
    labels: realTimeData.pastAverage.days,
    datasets: [
      {
        label: 'Ticket',
        data: realTimeData.pastAverage.days.map(day => realTimeData.pastAverage.dailyBreakdown.ticket[day] || 0),
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: '#000000',
        borderWidth: 1
      },
      {
        label: 'Residence',
        data: realTimeData.pastAverage.days.map(day => realTimeData.pastAverage.dailyBreakdown.residence[day] || 0),
        backgroundColor: 'rgba(220,53,69,0.6)',
        borderColor: '#dc3545',
        borderWidth: 1
      },
      {
        label: 'Visa',
        data: realTimeData.pastAverage.days.map(day => realTimeData.pastAverage.dailyBreakdown.visa[day] || 0),
        backgroundColor: 'rgba(253,126,20,0.6)',
        borderColor: '#fd7e14',
        borderWidth: 1
      }
    ]
  } : null;

  // Prepare 30-day sales chart data
  const salesChartData = salesData && salesData.length > 0 ? {
    labels: salesData.map(d => d.date),
    datasets: [
      {
        label: 'Ticket Count',
        data: salesData.map(d => d.ticket),
        borderColor: '#000000',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1
      },
      {
        label: 'Residence Count',
        data: salesData.map(d => d.residence),
        borderColor: '#dc3545',
        backgroundColor: 'rgba(220,53,69,0.6)',
        borderWidth: 1
      },
      {
        label: 'Visa Count',
        data: salesData.map(d => d.visa),
        borderColor: '#fd7e14',
        backgroundColor: 'rgba(253,126,20,0.6)',
        borderWidth: 1
      }
    ]
  } : null;

  // Prepare monthly chart data
  const monthlyChartData = monthlyData ? {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Ticket',
        data: Object.values(monthlyData.data.ticket),
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: '#000',
        borderWidth: 1
      },
      {
        label: 'Residence',
        data: Object.values(monthlyData.data.residence),
        backgroundColor: 'rgba(220,53,69,0.6)',
        borderColor: '#dc3545',
        borderWidth: 1
      },
      {
        label: 'Visa',
        data: Object.values(monthlyData.data.visa),
        backgroundColor: 'rgba(253,126,20,0.6)',
        borderColor: '#fd7e14',
        borderWidth: 1
      }
    ]
  } : null;

  // Prepare weekly chart data
  const weeklyChartData = weeklyData ? {
    labels: Object.keys(weeklyData.data.ticket).sort((a, b) => parseInt(a) - parseInt(b)).map(w => `W${w}`),
    datasets: [
      {
        label: 'Ticket',
        data: Object.keys(weeklyData.data.ticket).sort((a, b) => parseInt(a) - parseInt(b)).map(w => weeklyData.data.ticket[parseInt(w)] || 0),
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderColor: '#000',
        borderWidth: 1
      },
      {
        label: 'Residence',
        data: Object.keys(weeklyData.data.residence).sort((a, b) => parseInt(a) - parseInt(b)).map(w => weeklyData.data.residence[parseInt(w)] || 0),
        backgroundColor: 'rgba(220,53,69,0.6)',
        borderColor: '#dc3545',
        borderWidth: 1
      },
      {
        label: 'Visa',
        data: Object.keys(weeklyData.data.visa).sort((a, b) => parseInt(a) - parseInt(b)).map(w => weeklyData.data.visa[parseInt(w)] || 0),
        backgroundColor: 'rgba(253,126,20,0.6)',
        borderColor: '#fd7e14',
        borderWidth: 1
      }
    ]
  } : null;

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            size: 10
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 10
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 10,
          padding: 8,
          font: {
            size: 10
          }
        }
      }
    }
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            size: 10
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 10
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 10,
          padding: 8,
          font: {
            size: 10
          }
        }
      }
    }
  };

  return (
    <div className="dashboard-analytics">
      <h1 className="page-header mb-4">Dashboard v2 – Sales Overview</h1>

      {/* Real-time Comparison Section */}
      {realTimeData && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="card-title mb-0">Real-time Comparison: Today vs Past 7 Days Average</h4>
              <button className="btn btn-sm btn-outline-primary" onClick={loadRealTimeData}>
                <i className="fas fa-sync-alt"></i> Refresh
              </button>
            </div>

            {/* Comparison Cards */}
            <div className="row mb-4">
              {/* Tickets */}
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h5 className="card-title">Tickets</h5>
                    <div className="d-flex justify-content-around">
                      <div>
                        <h6>Today</h6>
                        <h2>{realTimeData.today.counts.ticket}</h2>
                      </div>
                      <div>
                        <h6>Avg (7 days)</h6>
                        <h2>{realTimeData.pastAverage.counts.ticket}</h2>
                        <small className="text-muted">Past week</small>
                      </div>
                    </div>
                    <div className="mt-2">
                      {renderTrendBadge(
                        realTimeData.today.counts.ticket,
                        compareMode
                          ? realTimeData.pastAverage.upToNowCounts.ticket
                          : realTimeData.pastAverage.counts.ticket
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Residence */}
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h5 className="card-title">Residence</h5>
                    <div className="d-flex justify-content-around">
                      <div>
                        <h6>Today</h6>
                        <h2>{realTimeData.today.counts.residence}</h2>
                      </div>
                      <div>
                        <h6>Avg (7 days)</h6>
                        <h2>{realTimeData.pastAverage.counts.residence}</h2>
                        <small className="text-muted">Past week</small>
                      </div>
                    </div>
                    <div className="mt-2">
                      {renderTrendBadge(
                        realTimeData.today.counts.residence,
                        compareMode
                          ? realTimeData.pastAverage.upToNowCounts.residence
                          : realTimeData.pastAverage.counts.residence
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visa */}
              <div className="col-md-4">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h5 className="card-title">Visa</h5>
                    <div className="d-flex justify-content-around">
                      <div>
                        <h6>Today</h6>
                        <h2>{realTimeData.today.counts.visa}</h2>
                      </div>
                      <div>
                        <h6>Avg (7 days)</h6>
                        <h2>{realTimeData.pastAverage.counts.visa}</h2>
                        <small className="text-muted">Past week</small>
                      </div>
                    </div>
                    <div className="mt-2">
                      {renderTrendBadge(
                        realTimeData.today.counts.visa,
                        compareMode
                          ? realTimeData.pastAverage.upToNowCounts.visa
                          : realTimeData.pastAverage.counts.visa
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Toggle */}
            <div className="row mb-2">
              <div className="col-12 d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Hourly Activity Comparison</h5>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="compareSwitch"
                    checked={compareMode}
                    onChange={(e) => setCompareMode(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="compareSwitch">
                    Fair comparison (up to current time)
                  </label>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="row">
              <div className="col-md-8">
                <div style={{ height: '220px' }}>
                  {hourlyChartData && <Line data={hourlyChartData} options={chartOptions} />}
                </div>
              </div>
              <div className="col-md-4">
                <div style={{ height: '220px' }}>
                  {dailyChartData && <Bar data={dailyChartData} options={barChartOptions} />}
                </div>
              </div>
            </div>

            <div className="row mt-2">
              <div className="col-12 text-center small text-muted">
                Last updated: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Chart */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex align-items-center mb-2">
            <h4 className="mb-0"><i className="fas fa-calendar-week"></i> Weekly Counts – {selectedYear}</h4>
            <select
              className="form-select form-select-sm ms-3"
              style={{ width: 'auto' }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => (
                <option key={i + 1} value={i + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div style={{ height: '200px' }}>
            {weeklyChartData && <Bar data={weeklyChartData} options={barChartOptions} />}
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h4 className="mb-0"><i className="fas fa-calendar-alt"></i> Monthly Counts – {selectedYear}</h4>
            <div>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ height: '200px' }}>
            {monthlyChartData && <Bar data={monthlyChartData} options={barChartOptions} />}
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="d-flex justify-content-end mb-2">
        <label className="me-2 fw-bold">Compare:</label>
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto' }}
          value={periodSelect}
          onChange={(e) => setPeriodSelect(e.target.value as 'month' | 'year' | 'ytd')}
        >
          <option value="month">This Month vs Last Month</option>
          <option value="year">Year-to-Date vs Last Year</option>
          <option value="ytd">Current Month vs Year-to-Date</option>
        </select>
      </div>

      {performanceData && (
        <div className="row text-center mb-4">
          <div className="col-4">
            <h6>Ticket {renderTrendBadge(performanceData.current.ticket, performanceData.previous.ticket)}</h6>
          </div>
          <div className="col-4">
            <h6>Residence {renderTrendBadge(performanceData.current.residence, performanceData.previous.residence)}</h6>
          </div>
          <div className="col-4">
            <h6>Visa {renderTrendBadge(performanceData.current.visa, performanceData.previous.visa)}</h6>
          </div>
        </div>
      )}

      {/* Yearly - Last 30 Days Chart */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title mb-3"><i className="fas fa-chart-line"></i> Last 30 Days Entries (Count)</h4>
          <div style={{ height: '200px' }}>
            {salesChartData && <Bar data={salesChartData} options={barChartOptions} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalytics;
