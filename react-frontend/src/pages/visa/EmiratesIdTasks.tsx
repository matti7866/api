import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import visaService from '../../services/visaService';
import Swal from 'sweetalert2';
import MarkReceivedModal from '../../components/visa/MarkReceivedModal';
import MarkDeliveredModal from '../../components/visa/MarkDeliveredModal';
import './EmiratesIdTasks.css';

interface EIDTask {
  residenceID: number;
  passenger_name: string;
  passportNumber: string;
  EmiratesIDNumber: string;
  completedStep: number;
  customer_name: string;
  remaining_balance: number;
  type: 'ML' | 'FZ';
}

interface StepInfo {
  name: string;
  count: number;
  slug: string;
}

const steps: StepInfo[] = [
  { name: 'Pending Delivery', count: 0, slug: 'pending' },
  { name: 'Received', count: 0, slug: 'received' },
  { name: 'Delivered', count: 0, slug: 'delivered' }
];

export default function EmiratesIdTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStep = searchParams.get('step') || 'pending';
  
  const [tasks, setTasks] = useState<EIDTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({
    pending: 0,
    received: 0,
    delivered: 0
  });
  const [totalRemainingBalance, setTotalRemainingBalance] = useState(0);
  
  // Modal states
  const [showMarkReceivedModal, setShowMarkReceivedModal] = useState(false);
  const [showMarkDeliveredModal, setShowMarkDeliveredModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<EIDTask | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    loadTasks();
  }, [currentStep]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await visaService.getEIDTasks({ step: currentStep });
      
      if (data && data.tasks) {
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } else {
        setTasks([]);
      }
      
      if (data && data.stepCounts) {
        setStepCounts(data.stepCounts);
      }
      
      if (data && data.totalRemainingBalance !== undefined) {
        setTotalRemainingBalance(data.totalRemainingBalance);
      }
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      setTasks([]);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load tasks';
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (step: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('step', step);
    setSearchParams(params, { replace: false });
    setCurrentPage(1);
  };

  const handleMarkReceived = (task: EIDTask) => {
    setSelectedTask(task);
    setShowMarkReceivedModal(true);
  };

  const handleMarkDelivered = (task: EIDTask) => {
    setSelectedTask(task);
    setShowMarkDeliveredModal(true);
  };

  // Calculate pagination
  const totalPages = Math.ceil(tasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTasks = tasks.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  return (
    <div className="emirates-id-tasks-page">
      {/* Header */}
      <div className="mb-6">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h1 className="mb-2" style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#000000' }}>
              <i className="fa fa-id-card me-2"></i>
              Emirates ID Tasks
            </h1>
            <p style={{ color: '#000000' }}>Manage Emirates ID delivery status</p>
            <span className="badge bg-info">Filtered: After August 2024</span>
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="mb-6">
        <div className="btn-group btn-group-block w-100">
          {steps.map((step) => {
            const count = stepCounts[step.slug] || 0;
            return (
              <button
                key={step.slug}
                type="button"
                className={`btn btn-white btn-block step-nav-link ${currentStep === step.slug ? 'active' : ''}`}
                onClick={() => handleStepChange(step.slug)}
              >
                <span>{step.name}</span>
                {count > 0 && (
                  <span className="badge bg-red ms-1">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="mb-0" style={{ color: '#1f2937', fontWeight: 600 }}>Emirates ID Supplier</h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <i className="fa fa-spinner fa-spin fa-2x" style={{ color: '#9ca3af' }}></i>
              <p className="mt-2" style={{ color: '#6b7280' }}>Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: '#6b7280' }}>No records found</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-striped table-bordered align-middle text-nowrap">
                  <thead>
                    <tr>
                      <th width="50">ID</th>
                      <th>Customer Name</th>
                      <th>Passenger Name</th>
                      <th width="150">Passport Number</th>
                      <th width="150">EID Number</th>
                      <th width="150">Remaining Balance</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTasks.map((task) => (
                      <tr key={`${task.type}-${task.residenceID}`}>
                        <td>{task.residenceID}</td>
                        <td>{task.customer_name || '-'}</td>
                        <td>{task.passenger_name}</td>
                        <td>{task.passportNumber}</td>
                        <td>{task.EmiratesIDNumber || '-'}</td>
                        <td className={task.remaining_balance > 0 ? 'text-danger' : ''}>
                          <strong>{task.remaining_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </td>
                        <td>
                          <span className={`badge bg-${task.type === 'ML' ? 'success' : 'danger'}`}>
                            {task.type}
                          </span>
                        </td>
                        <td>
                          {task.completedStep < 8 && (
                            <span className="badge bg-red">Waiting For Residency</span>
                          )}
                        </td>
                        <td>
                          {currentStep === 'pending' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleMarkReceived(task)}
                            >
                              Mark as Received
                            </button>
                          )}
                          {currentStep === 'received' && (
                            <button
                              className="btn btn-info btn-sm"
                              onClick={() => handleMarkDelivered(task)}
                            >
                              Mark as Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Total Remaining Balance */}
              <div className="text-right mt-3">
                <strong>Total Remaining Balance: {totalRemainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              
              {/* Pagination Controls */}
              {!loading && tasks.length > 0 && (
                <div className="pagination-container" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px',
                  borderTop: '1px solid #e5e7eb',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  {/* Items per page selector */}
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
                      entries (Showing {startIndex + 1}-{Math.min(endIndex, tasks.length)} of {tasks.length})
                    </span>
                  </div>

                  {/* Page navigation */}
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
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedTask && (
        <>
          <MarkReceivedModal
            isOpen={showMarkReceivedModal}
            onClose={() => { setShowMarkReceivedModal(false); setSelectedTask(null); }}
            task={selectedTask}
            onSuccess={loadTasks}
          />
          
          <MarkDeliveredModal
            isOpen={showMarkDeliveredModal}
            onClose={() => { setShowMarkDeliveredModal(false); setSelectedTask(null); }}
            task={selectedTask}
            onSuccess={loadTasks}
          />
        </>
      )}
    </div>
  );
}




