import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import residenceService from '../../services/residenceService';
import Swal from 'sweetalert2';
import type { Residence } from '../../types/residence';
import ResidenceCard from '../../components/residence/ResidenceCard';
import AttachmentsModal from '../../components/residence/AttachmentsModal';
import TawjeehModal from '../../components/residence/TawjeehModal';
import ILOEModal from '../../components/residence/ILOEModal';
import PaymentHistoryModal from '../../components/residence/PaymentHistoryModal';
import PaymentModal from '../../components/residence/PaymentModal';
import CancelResidenceModal from '../../components/residence/CancelResidenceModal';
import AddFineModal from '../../components/residence/AddFineModal';
import ViewFineModal from '../../components/residence/ViewFineModal';
import AddCustomChargeModal from '../../components/residence/AddCustomChargeModal';
import PerformTawjeehModal from '../../components/residence/PerformTawjeehModal';
import IssueInsuranceModal from '../../components/residence/IssueInsuranceModal';
import NOCModal, { type NOCData } from '../../components/residence/NOCModal';
import './ResidenceReport.css';

interface DropdownData {
  accounts: Array<{ accountID: number; accountName: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
}

export default function ResidenceReport() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'mainland' | 'freezone'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showChart, setShowChart] = useState(false);
  const [dropdowns, setDropdowns] = useState<DropdownData>({ accounts: [], currencies: [] });
  
  // Modal states
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null);
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [tawjeehModalOpen, setTawjeehModalOpen] = useState(false);
  const [iloeModalOpen, setIloeModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [addFineModalOpen, setAddFineModalOpen] = useState(false);
  const [viewFineModalOpen, setViewFineModalOpen] = useState(false);
  const [addCustomChargeModalOpen, setAddCustomChargeModalOpen] = useState(false);
  const [performTawjeehModalOpen, setPerformTawjeehModalOpen] = useState(false);
  const [issueInsuranceModalOpen, setIssueInsuranceModalOpen] = useState(false);
  const [nocModalOpen, setNocModalOpen] = useState(false);
  const [nocResidence, setNocResidence] = useState<Residence | null>(null);
  const [fineRefreshTrigger, setFineRefreshTrigger] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, searchQuery]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadDropdowns = async () => {
    try {
      const data = await residenceService.getLookups();
      
      // Map accounts from API format (account_ID, account_Name) to component format (accountID, accountName)
      const mappedAccounts = (data.accounts || []).map((acc: any) => ({
        accountID: acc.account_ID || acc.accountID,
        accountName: acc.account_Name || acc.accountName
      }));
      
      setDropdowns({
        accounts: mappedAccounts,
        currencies: (data.currencies || []).map((curr: any) => ({
          currencyID: curr.currencyID,
          currencyName: curr.currencyName
        }))
      });
    } catch (error) {
      console.error('Error loading dropdowns:', error);
      Swal.fire('Error', 'Failed to load dropdown data', 'error');
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 10 // Match old app - 10 records per page
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (activeTab === 'mainland') {
        params.insideOutside = 'inside';
      } else if (activeTab === 'freezone') {
        params.insideOutside = 'outside';
      }

      const response = await residenceService.getResidences(params);
      setRecords(response.data);
      setTotalPages(response.totalPages);
    } catch (error: any) {
      console.error('Error loading records:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const switchTab = (tab: 'all' | 'mainland' | 'freezone') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery('');
  };

  // Get status class and text
  const getStatus = (residence: Residence) => {
    if (residence.completedStep === 10) {
      return { class: 'bg-success', text: 'Completed' };
    } else if ((residence.total_paid || 0) >= residence.sale_price) {
      return { class: 'bg-warning', text: 'Pending Processing (Payment Complete)' };
    } else {
      return { class: 'bg-danger', text: 'Pending Payment' };
    }
  };

  // Calculate completion percentage
  const getCompletionPercentage = (step: number) => {
    return Math.round((step / 10) * 100);
  };

  // Calculate financial totals
  const calculateFinancials = (residence: Residence) => {
    let totalAmount = residence.sale_price;
    
    // Add TAWJEEH if not included
    if (residence.tawjeehIncluded === 0) {
      totalAmount += (residence.tawjeeh_amount || 150);
    }
    
    // Add ILOE Insurance if not included
    if (residence.insuranceIncluded === 0) {
      totalAmount += (residence.insuranceAmount || 126);
    }
    
    // Always add ILOE fine
    if (residence.iloe_fine) {
      totalAmount += residence.iloe_fine;
    }
    
    const totalPaid = residence.total_paid || 0;
    const totalRemaining = totalAmount - totalPaid;
    
    return { totalAmount, totalPaid, totalRemaining };
  };

  // Handler functions
  const handleAttachments = (residence: Residence) => {
    console.log('Opening attachments modal for residence:', residence);
    setSelectedResidence(residence);
    setAttachmentsModalOpen(true);
    console.log('Attachments modal state set to open');
  };

  const handleTawjeeh = (residence: Residence) => {
    setSelectedResidence(residence);
    setTawjeehModalOpen(true);
  };

  const handleILOE = (residence: Residence) => {
    setSelectedResidence(residence);
    setIloeModalOpen(true);
  };

  const handlePaymentHistory = (residence: Residence) => {
    setSelectedResidence(residence);
    setPaymentHistoryModalOpen(true);
  };

  const handleNOC = (residence: Residence) => {
    setNocResidence(residence);
    setNocModalOpen(true);
  };

  const handleGenerateNOC = async (nocData: NOCData) => {
    if (!nocResidence) return;
    
    setNocModalOpen(false);
    
    try {
      // Build query parameters
      const params: any = {
        purpose: nocData.purpose
      };
      
      if (nocData.purpose === 'travel') {
        if (!nocData.destination || !nocData.from_date || !nocData.to_date) {
          Swal.fire('Error', 'Please provide destination and travel dates for travel NOC', 'error');
          return;
        }
        params.destination = nocData.destination;
        params.from_date = nocData.from_date;
        params.to_date = nocData.to_date;
      }
      
      // Generate letter via API with purpose parameters
      const queryString = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
      const response = await residenceService.generateLetter(
        nocResidence.residenceID, 
        'noc',
        undefined,
        queryString
      );
      
      console.log('NOC Response:', response);
      if (response && response.html) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(response.html);
          newWindow.document.close();
        } else {
          Swal.fire('Error', 'Popup blocked. Please allow popups for this site.', 'error');
        }
      } else {
        console.error('Invalid response structure:', response);
        Swal.fire('Error', 'Failed to generate NOC letter. Invalid response format.', 'error');
      }
    } catch (error: any) {
      console.error('Error generating NOC:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to generate NOC', 'error');
    } finally {
      setNocResidence(null);
    }
  };

  const handleSalaryCertificate = async (residence: Residence) => {
    try {
      // Get banks from API
      const banks = await residenceService.getBanks();
      
      // Build options for SweetAlert select
      const options: Record<string, string> = { '': '-- Select Bank --' };
      if (banks && banks.length > 0) {
        banks.forEach((bank: any) => {
          options[bank.id] = bank.bank_name;
        });
      } else {
        // If no banks available, show default option
        Swal.fire('Info', 'No banks available. Please contact administrator.', 'info');
        return;
      }

      const { value: bankId } = await Swal.fire({
        title: 'Select Bank',
        html: '<p>Please select a bank for the salary certificate:</p>',
        input: 'select',
        inputOptions: options,
        showCancelButton: true,
        confirmButtonText: 'Generate Certificate',
        confirmButtonColor: '#28a745',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value) {
            return 'Please select a bank';
          }
        }
      });

      if (bankId) {
        // Generate letter via API and open in new window
        try {
          const response = await residenceService.generateLetter(residence.residenceID, 'salary_certificate', bankId);
          console.log('Salary Certificate Response:', response);
          if (response && response.html) {
            const newWindow = window.open('', '_blank');
            if (newWindow) {
              newWindow.document.write(response.html);
              newWindow.document.close();
            } else {
              Swal.fire('Error', 'Popup blocked. Please allow popups for this site.', 'error');
            }
          } else {
            console.error('Invalid response structure:', response);
            Swal.fire('Error', 'Failed to generate salary certificate. Invalid response format.', 'error');
          }
        } catch (error: any) {
          console.error('Error generating salary certificate:', error);
          Swal.fire('Error', error.response?.data?.message || 'Failed to generate salary certificate', 'error');
        }
      }
    } catch (error: any) {
      console.error('Error generating salary certificate:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to generate salary certificate', 'error');
    }
  };

  const handlePayTotal = (residence: Residence) => {
    setSelectedResidence(residence);
    setPaymentModalOpen(true);
  };

  const handleCancellationFee = async (residence: Residence) => {
    const { value: formValues } = await Swal.fire({
      title: 'Pay Cancellation Fee',
      html: `
        <input id="swal-amount" class="swal2-input" placeholder="Amount (AED)" type="number" step="0.01" required>
        <select id="swal-account" class="swal2-select" required>
          <option value="">Select Account</option>
          ${dropdowns.accounts.map(acc => `<option value="${acc.accountID}">${acc.accountName}</option>`).join('')}
        </select>
        <textarea id="swal-remarks" class="swal2-textarea" placeholder="Remarks (optional)"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Process Payment',
      preConfirm: () => {
        const amount = (document.getElementById('swal-amount') as HTMLInputElement)?.value;
        const account = (document.getElementById('swal-account') as HTMLSelectElement)?.value;
        const remarks = (document.getElementById('swal-remarks') as HTMLTextAreaElement)?.value || '';
        if (!amount || !account) {
          Swal.showValidationMessage('Please fill all required fields');
          return false;
        }
        return { amount: parseFloat(amount), accountID: parseInt(account), remarks };
      }
    });

    if (formValues) {
      try {
        await residenceService.payCancellationFee(residence.residenceID, formValues);
        Swal.fire('Success', 'Cancellation fee payment processed', 'success');
        loadRecords();
      } catch (error: any) {
        Swal.fire('Error', error.response?.data?.message || 'Failed to process payment', 'error');
      }
    }
  };

  const handleCreditAdjustment = async (residence: Residence) => {
    const { value: formValues } = await Swal.fire({
      title: 'Credit Adjustment',
      html: `
        <select id="swal-adjustment-type" class="swal2-select" required>
          <option value="full">Full Adjustment</option>
          <option value="partial">Partial Adjustment</option>
        </select>
        <input id="swal-partial-amount" class="swal2-input" placeholder="Partial Amount (if partial)" type="number" step="0.01" style="display:none;">
        <select id="swal-action" class="swal2-select" required>
          <option value="refund">Refund to Account</option>
          <option value="transfer">Transfer to Another Residence</option>
        </select>
        <select id="swal-account" class="swal2-select" required>
          <option value="">Select Account</option>
          ${dropdowns.accounts.map(acc => `<option value="${acc.accountID}">${acc.accountName}</option>`).join('')}
        </select>
        <textarea id="swal-remarks" class="swal2-textarea" placeholder="Remarks"></textarea>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Process Adjustment',
      didOpen: () => {
        const adjustmentType = document.getElementById('swal-adjustment-type') as HTMLSelectElement;
        const partialAmount = document.getElementById('swal-partial-amount') as HTMLInputElement;
        adjustmentType?.addEventListener('change', (e) => {
          if ((e.target as HTMLSelectElement).value === 'partial') {
            partialAmount.style.display = 'block';
          } else {
            partialAmount.style.display = 'none';
          }
        });
      },
      preConfirm: () => {
        const adjustmentType = (document.getElementById('swal-adjustment-type') as HTMLSelectElement)?.value;
        const partialAmount = (document.getElementById('swal-partial-amount') as HTMLInputElement)?.value;
        const action = (document.getElementById('swal-action') as HTMLSelectElement)?.value;
        const account = (document.getElementById('swal-account') as HTMLSelectElement)?.value;
        const remarks = (document.getElementById('swal-remarks') as HTMLTextAreaElement)?.value || '';
        if (!account) {
          Swal.showValidationMessage('Please select an account');
          return false;
        }
        return { adjustmentType, partialAmount: partialAmount ? parseFloat(partialAmount) : null, action, accountID: parseInt(account), remarks };
      }
    });

    if (formValues) {
      try {
        await residenceService.processCreditAdjustment(residence.residenceID, formValues);
        Swal.fire('Success', 'Credit adjustment processed', 'success');
        loadRecords();
      } catch (error: any) {
        Swal.fire('Error', error.response?.data?.message || 'Failed to process adjustment', 'error');
      }
    }
  };

  const handleAddFine = (residence: Residence) => {
    setSelectedResidence(residence);
    setAddFineModalOpen(true);
  };

  const handleAddFineSubmit = async (data: { residenceID: number; fineAmount: number; accountID: number; currencyID?: number }) => {
    try {
      await residenceService.addFine(data);
      Swal.fire('Success', 'E-Visa fine added successfully', 'success');
      setAddFineModalOpen(false);
      setSelectedResidence(null);
      setFineRefreshTrigger(prev => prev + 1); // Trigger refresh
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add fine', 'error');
      throw error;
    }
  };

  const handleViewFine = (residence: Residence) => {
    setSelectedResidence(residence);
    setViewFineModalOpen(true);
  };

  const handleAddCustomCharge = (residence: Residence) => {
    setSelectedResidence(residence);
    setAddCustomChargeModalOpen(true);
  };

  const handleCustomChargeAdded = () => {
    // Refresh the residence list to update financial summary
    loadRecords();
  };

  const handleGenerateInvoice = (residence: Residence) => {
    window.open(`/invoice.php?residence_id=${residence.residenceID}`, '_blank');
  };

  const handlePerformTawjeeh = (residence: Residence) => {
    setSelectedResidence(residence);
    setPerformTawjeehModalOpen(true);
  };

  const handlePerformTawjeehSubmit = async (data: { residenceID: number; cost: number; accountID: number; notes: string; uid?: string; labourCard?: string }) => {
    try {
      await residenceService.performTawjeeh(data);
      Swal.fire('Success', 'Tawjeeh performed successfully', 'success');
      setPerformTawjeehModalOpen(false);
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to perform Tawjeeh', 'error');
      throw error;
    }
  };

  const handleIssueInsurance = (residence: Residence) => {
    setSelectedResidence(residence);
    setIssueInsuranceModalOpen(true);
  };

  const handleIssueInsuranceSubmit = async (data: { residenceID: number; cost: number; accountID: number; notes: string; uid?: string; labourCard?: string; passport?: string; attachment?: File }) => {
    try {
      await residenceService.issueInsurance(data);
      Swal.fire('Success', 'Insurance issued successfully', 'success');
      setIssueInsuranceModalOpen(false);
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to issue insurance', 'error');
      throw error;
    }
  };

  const handleDeleteResidence = async (residence: Residence) => {
    const result = await Swal.fire({
      title: 'Delete Residence?',
      text: `Are you sure you want to delete residence for ${residence.passenger_name}? This cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Delete!'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch('/api/residence/delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ residenceID: residence.residenceID })
        });
        const data = await response.json();
        if (data.success) {
          Swal.fire('Deleted!', 'Residence has been deleted.', 'success');
          loadRecords();
        } else {
          Swal.fire('Error', data.message || 'Failed to delete residence', 'error');
        }
      } catch (error: any) {
        Swal.fire('Error', 'Failed to delete residence', 'error');
      }
    }
  };

  const handleCancelResidence = (residence: Residence) => {
    setSelectedResidence(residence);
    setCancelModalOpen(true);
  };

  const handleRenew = (residence: Residence) => {
    navigate(`/residence/create?type=renew&oldID=${residence.residenceID}&stp=0`);
  };

  // Modal submit handlers
  const handleTawjeehSubmit = async (residenceID: number, tawjeehIncluded: number, tawjeehAmount: number) => {
    try {
      await residenceService.updateTawjeeh({ residenceID, tawjeehIncluded, tawjeehAmount });
      Swal.fire('Success', 'TAWJEEH settings updated', 'success');
      setTawjeehModalOpen(false);
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update TAWJEEH', 'error');
      throw error;
    }
  };

  const handleILOESubmit = async (residenceID: number, insuranceIncluded: number, insuranceAmount: number, iloeFine: number, fineRemarks: string) => {
    try {
      await residenceService.updateILOE({ residenceID, insuranceIncluded, insuranceAmount, iloeFine, fineRemarks });
      Swal.fire('Success', 'ILOE settings updated', 'success');
      setIloeModalOpen(false);
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update ILOE', 'error');
      throw error;
    }
  };

  const handleCancelSubmit = async (charges: number, remarks: string) => {
    if (!selectedResidence) return;
    try {
      await residenceService.cancelResidence(selectedResidence.residenceID, remarks);
      Swal.fire('Success', 'Residence cancelled successfully', 'success');
      setCancelModalOpen(false);
      setSelectedResidence(null);
      loadRecords();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to cancel residence', 'error');
      throw error;
    }
  };

  const handlePaymentSubmit = async () => {
    setPaymentModalOpen(false);
    loadRecords();
  };

  return (
    <div className="residence-report-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              <i className="fa fa-info mr-2"></i>
              Residence Report
            </h1>
            <p className="text-gray-400">View and manage all residence records</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/residence/create')}
              className="btn btn-primary btn-lg"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              <i className="fa fa-plus-circle mr-2"></i>
              Add New Residence
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
            >
              <i className="fa fa-redo mr-2"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
          <input
            type="text"
            className="form-control"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by Customer, Passenger, Company name, or Company Number"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <ul className="nav nav-tabs" id="residenceTabs">
          <li className="nav-item">
            <a
              href="#default-tab-1"
              data-bs-toggle="tab"
              className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => switchTab('all')}
            >
              All Residence Records
            </a>
          </li>
          <li className="nav-item">
            <a
              href="#mainland-tab"
              data-bs-toggle="tab"
              className={`nav-link ${activeTab === 'mainland' ? 'active' : ''}`}
              onClick={() => switchTab('mainland')}
            >
              Mainland
            </a>
          </li>
          <li className="nav-item">
            <a
              href="#freezone-tab"
              data-bs-toggle="tab"
              className={`nav-link ${activeTab === 'freezone' ? 'active' : ''}`}
              onClick={() => switchTab('freezone')}
            >
              Freezone
            </a>
          </li>
        </ul>
      </div>

      {/* Tab Content - Directly on page */}
      <div>
        {/* Chart Section - Directly on page */}
        {showChart && (
          <div className="mb-6">
            <div className="card" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
              <div className="card-header" style={{ backgroundColor: '#343a40', borderBottom: '1px solid #495057' }}>
                <h3 className="mb-0" style={{ color: '#ffffff' }}>
                  <i className="fa fa-chart-bar me-2"></i>
                  Residence Statistics Chart
                </h3>
              </div>
              <div className="card-body">
                <div className="chartBox">
                  <div className="chartMenu"></div>
                  <div className="chartCard">
                    <div className="chartBox" style={{width: 'auto', height: '400px', padding: '20px', borderRadius: '20px'}}>
                      <canvas id="myChart"></canvas>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chart Toggle Button */}
        <div className="mb-6">
          <button
            className="btn btn-secondary"
            onClick={() => setShowChart(!showChart)}
          >
            <i className={`fa fa-${showChart ? 'eye-slash' : 'chart-bar'} me-2`}></i>
            {showChart ? 'Hide' : 'Show'} Statistics Chart
          </button>
        </div>

        {/* Residence List - Directly on page */}
        <div id="DailyRpt">
            {loading ? (
              <div className="text-center py-8">
                <i className="fa fa-spinner fa-spin fa-2x text-gray-400"></i>
                <p className="text-gray-400 mt-2">Loading residences...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="card p-6 text-center" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
                <p className="text-gray-400">No residences found</p>
              </div>
            ) : (
              records.map((residence) => (
                <ResidenceCard
                  key={residence.residenceID}
                  residence={residence}
                  onContinue={(res) => navigate(`/residence/${res.residenceID}`)}
                  onAttachments={handleAttachments}
                  onTawjeeh={handleTawjeeh}
                  onILOE={handleILOE}
                  onPaymentHistory={handlePaymentHistory}
                  onNOC={handleNOC}
                  onSalaryCertificate={handleSalaryCertificate}
                  onPayTotal={handlePayTotal}
                  onCancellationFee={handleCancellationFee}
                  onCreditAdjustment={handleCreditAdjustment}
                  onAddFine={handleAddFine}
                  onViewFine={handleViewFine}
                  onAddCustomCharge={handleAddCustomCharge}
                  onGenerateInvoice={handleGenerateInvoice}
                  onPerformTawjeeh={handlePerformTawjeeh}
                  onIssueInsurance={handleIssueInsurance}
                  onDeleteResidence={handleDeleteResidence}
                  onCancelResidence={handleCancelResidence}
                  onRenew={handleRenew}
                  isAdmin={false}
                />
              ))
            )}

            {/* Pagination */}
            {totalPages > 1 && (() => {
              const getPageNumbers = () => {
                const pages: (number | string)[] = [];
                const maxVisible = isMobile ? 5 : 10;
                
                if (totalPages <= maxVisible) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  pages.push(1);
                  
                  let startPage = Math.max(2, currentPage - 1);
                  let endPage = Math.min(totalPages - 1, currentPage + 1);
                  
                  if (currentPage <= 3) {
                    endPage = Math.min(5, totalPages - 1);
                  }
                  
                  if (currentPage >= totalPages - 2) {
                    startPage = Math.max(2, totalPages - 4);
                  }
                  
                  if (startPage > 2) {
                    pages.push('ellipsis-start');
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(i);
                  }
                  
                  if (endPage < totalPages - 1) {
                    pages.push('ellipsis-end');
                  }
                  
                  pages.push(totalPages);
                }
                
                return pages;
              };
              
              const pageNumbers = getPageNumbers();
              
              return (
                <div id="DailyRptPagination" className="d-flex justify-content-center mt-6">
                  <nav>
                    <ul className="pagination">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
                          <span className="d-none d-md-inline">Previous</span>
                          <span className="d-md-none">Prev</span>
                        </button>
                      </li>
                      {pageNumbers.map((page, index) => {
                        if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                          return (
                            <li key={`ellipsis-${index}`} className="page-item disabled">
                              <span className="page-link">...</span>
                            </li>
                          );
                        }
                        return (
                          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setCurrentPage(page as number)}>
                              {page}
                            </button>
                          </li>
                        );
                      })}
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
                          <span className="d-none d-md-inline">Next</span>
                          <span className="d-md-none">Next</span>
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              );
            })()}
          </div>
        </div>
      
      {/* Modals */}
      {selectedResidence && (
        <>
          <AttachmentsModal
            isOpen={attachmentsModalOpen}
            onClose={() => {
              setAttachmentsModalOpen(false);
              setSelectedResidence(null);
            }}
            residence={selectedResidence}
            onLoadAttachments={async (residenceID) => {
              const data = await residenceService.getAttachments(residenceID);
              return Array.isArray(data) ? data : [];
            }}
            onUploadAttachment={async (residenceID, stepNumber, file, fileType) => {
              const result = await residenceService.uploadAttachment(residenceID, stepNumber, file, fileType);
              return result;
            }}
            onDeleteAttachment={async (attachmentId) => {
              await residenceService.deleteAttachment(attachmentId);
            }}
          />

          <TawjeehModal
            isOpen={tawjeehModalOpen}
            onClose={() => {
              setTawjeehModalOpen(false);
              setSelectedResidence(null);
            }}
            residence={selectedResidence}
            onSubmit={handleTawjeehSubmit}
          />

          <ILOEModal
            isOpen={iloeModalOpen}
            onClose={() => {
              setIloeModalOpen(false);
              setSelectedResidence(null);
            }}
            residence={selectedResidence}
            onSubmit={handleILOESubmit}
          />

          <PaymentHistoryModal
            isOpen={paymentHistoryModalOpen}
            onClose={() => {
              setPaymentHistoryModalOpen(false);
              setSelectedResidence(null);
            }}
            residence={selectedResidence}
            onLoadHistory={async (residenceID) => {
              const data = await residenceService.getPaymentHistory(residenceID);
              return Array.isArray(data) ? data : [];
            }}
          />

          <PaymentModal
            isOpen={paymentModalOpen}
            onClose={() => {
              setPaymentModalOpen(false);
              setSelectedResidence(null);
            }}
            onSubmit={handlePaymentSubmit}
            residence={selectedResidence}
            accounts={dropdowns.accounts}
            currencies={dropdowns.currencies}
          />

          {cancelModalOpen && (
            <CancelResidenceModal
              residence={selectedResidence}
              onCancel={handleCancelSubmit}
              onClose={() => {
                setCancelModalOpen(false);
                setSelectedResidence(null);
              }}
            />
          )}

          {addFineModalOpen && (
            <AddFineModal
              isOpen={addFineModalOpen}
              onClose={() => {
                setAddFineModalOpen(false);
                setSelectedResidence(null);
              }}
              onSubmit={handleAddFineSubmit}
              residence={selectedResidence}
              accounts={dropdowns.accounts}
              currencies={dropdowns.currencies}
            />
          )}

          {viewFineModalOpen && (
            <ViewFineModal
              isOpen={viewFineModalOpen}
              onClose={() => {
                setViewFineModalOpen(false);
                setSelectedResidence(null);
              }}
              residence={selectedResidence}
              onAddFine={() => {
                setViewFineModalOpen(false);
                setAddFineModalOpen(true);
              }}
              refreshTrigger={fineRefreshTrigger}
              accounts={dropdowns.accounts}
              currencies={dropdowns.currencies}
              onRefresh={() => {
                setFineRefreshTrigger(prev => prev + 1);
                loadRecords();
              }}
            />
          )}

          {addCustomChargeModalOpen && (
            <AddCustomChargeModal
              isOpen={addCustomChargeModalOpen}
              onClose={() => {
                setAddCustomChargeModalOpen(false);
                setSelectedResidence(null);
              }}
              residence={selectedResidence}
              accounts={dropdowns.accounts}
              onChargeAdded={handleCustomChargeAdded}
            />
          )}

          {performTawjeehModalOpen && (
            <PerformTawjeehModal
              isOpen={performTawjeehModalOpen}
              onClose={() => {
                setPerformTawjeehModalOpen(false);
                setSelectedResidence(null);
              }}
              onSubmit={handlePerformTawjeehSubmit}
              residence={selectedResidence}
              accounts={dropdowns.accounts}
            />
          )}

          {issueInsuranceModalOpen && (
            <IssueInsuranceModal
              isOpen={issueInsuranceModalOpen}
              onClose={() => {
                setIssueInsuranceModalOpen(false);
                setSelectedResidence(null);
              }}
              onSubmit={handleIssueInsuranceSubmit}
              residence={selectedResidence}
              accounts={dropdowns.accounts}
            />
          )}
        </>
      )}

      {/* NOC Modal */}
      {nocResidence && (
        <NOCModal
          isOpen={nocModalOpen}
          onClose={() => {
            setNocModalOpen(false);
            setNocResidence(null);
          }}
          onGenerate={handleGenerateNOC}
          passengerName={nocResidence.passenger_name}
        />
      )}
    </div>
  );
}
