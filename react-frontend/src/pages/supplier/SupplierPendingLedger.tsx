import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import supplierService from '../../services/supplierService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { PendingSupplier } from '../../types/supplier';
import './SupplierPendingLedger.css';

interface SupplierOption {
  supp_id: number;
  supp_name: string;
}

interface CurrencyOption {
  currencyID: number;
  currencyName: string;
}

interface PaymentData {
  payment_amount: number;
  payment_detail: string;
  account_id?: number;
}

export default function SupplierPendingLedger() {
  const queryClient = useQueryClient();
  
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState<number | null>(null);
  const [totalCharges, setTotalCharges] = useState<number>(0);
  const [paymentData, setPaymentData] = useState<PaymentData>({
    payment_amount: 0,
    payment_detail: '',
    account_id: undefined
  });
  
  // Load suppliers
  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ['supplier-ledger-suppliers'],
    queryFn: async () => {
      const response = await apiClient.post('/supplier/suppliers.php', {
        action: 'getSuppliers'
      });
      return response.data.success ? response.data.data : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load currencies
  const { data: currencies = [] } = useQuery<CurrencyOption[]>({
    queryKey: ['supplier-ledger-currencies'],
    queryFn: async () => {
      const response = await apiClient.post('/supplier/dropdowns.php', {
        action: 'getCurrencies'
      });
      return response.data.success && response.data.data?.currencies ? response.data.data.currencies : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load pending suppliers
  const { data: pendingSuppliers = [], refetch: refetchPending } = useQuery<PendingSupplier[]>({
    queryKey: ['supplier-ledger-pending', selectedSupplier, selectedCurrency],
    queryFn: () => supplierService.getPendingSuppliers(selectedSupplier, selectedCurrency!),
    enabled: !!selectedCurrency,
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  // Load accounts for payment modal
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ['accounts-dropdown'],
    queryFn: async () => {
      const response = await apiClient.get('/payment/dropdowns.php?type=accounts');
      return response.data.success && response.data.data?.accounts ? response.data.data.accounts : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Auto-select AED currency when currencies load
  useEffect(() => {
    if (currencies.length > 0 && !selectedCurrency) {
      const aed = currencies.find(c => c.currencyName.toUpperCase() === 'AED');
      if (aed) {
        setSelectedCurrency(aed.currencyID);
      } else {
        setSelectedCurrency(currencies[0].currencyID);
      }
    }
  }, [currencies, selectedCurrency]);
  
  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/supplier/suppliers.php', {
        action: 'makePayment',
        ...data
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to add payment');
      }
      return response.data;
    },
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      setShowPaymentModal(false);
      setPaymentData({ payment_amount: 0, payment_detail: '', account_id: undefined });
      queryClient.invalidateQueries({ queryKey: ['supplier-ledger-pending'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to add payment'
      });
    }
  });
  
  const handleSupplierChange = (value: string) => {
    setSelectedSupplier(value);
  };
  
  const handleCurrencyChange = (value: string) => {
    setSelectedCurrency(value ? Number(value) : null);
  };
  
  const handleMakePayment = async (supplier: PendingSupplier) => {
    setPaymentSupplierId(supplier.main_supp);
    setTotalCharges(supplier.Pending || supplier.total || 0);
    setShowPaymentModal(true);
  };
  
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentData.payment_amount || paymentData.payment_amount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error!',
        text: 'Payment amount must be greater than zero'
      });
      return;
    }
    
    if (!paymentData.account_id) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error!',
        text: 'Account is required'
      });
      return;
    }
    
    if (!paymentSupplierId || !selectedCurrency) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Missing supplier or currency information'
      });
      return;
    }
    
    addPaymentMutation.mutate({
      supplier_id: paymentSupplierId,
      payment_amount: paymentData.payment_amount,
      currency_id: selectedCurrency,
      account_id: paymentData.account_id,
      remarks: paymentData.payment_detail || ''
    });
  };
  
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const currencyName = currencies.find(c => c.currencyID === selectedCurrency)?.currencyName || '';
    const currentDate = new Date().toLocaleString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const tableRows = pendingSuppliers.map((supplier, index) => `
      <tr>
        <td>${index + 1}</td>
        <td class="text-capitalize">${supplier.supp_name}</td>
        <td>${supplier.supp_email || '-'}</td>
        <td>${supplier.supp_phone || '-'}</td>
        <td>${formatNumber(supplier.Pending || supplier.total || 0)}</td>
      </tr>
    `).join('');
    
    const total = pendingSuppliers.reduce((sum, supplier) => sum + (supplier.Pending || supplier.total || 0), 0);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Supplier Ledger Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          h5 { text-align: center; margin-top: -10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: linear-gradient(to right, #2563eb, #1e40af); color: white; padding: 12px; text-align: center; }
          td { padding: 12px; text-align: center; border-bottom: 1px solid #ddd; }
          .text-capitalize { text-transform: capitalize; }
          @media print {
            @page { margin: 1cm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1><i class="fa fa-building"></i> All Supplier Ledger Report</h1>
        <h5>Currency: ${currencyName}</h5>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Supplier Name</th>
              <th>Supplier Email</th>
              <th>Supplier Phone</th>
              <th>Pending Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td><strong>${formatNumber(total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
  
  const handleExcelExport = () => {
    const currencyName = currencies.find(c => c.currencyID === selectedCurrency)?.currencyName || '';
    const currentDate = new Date().toLocaleString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    let csv = 'Supplier Ledger Report\n';
    csv += `Currency: ${currencyName}\n`;
    csv += `Date: ${currentDate}\n\n`;
    csv += '#,Supplier Name,Supplier Email,Supplier Phone,Pending Amount\n';
    
    pendingSuppliers.forEach((supplier, index) => {
      csv += `${index + 1},"${supplier.supp_name}","${supplier.supp_email || ''}","${supplier.supp_phone || ''}",${supplier.Pending || supplier.total || 0}\n`;
    });
    
    const total = pendingSuppliers.reduce((sum, supplier) => sum + (supplier.Pending || supplier.total || 0), 0);
    csv += `Total,,,,${total}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Supplier_Ledger_Report_${currencyName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const totalPending = pendingSuppliers.reduce((sum, supplier) => sum + (supplier.Pending || supplier.total || 0), 0);
  
  return (
    <div className="supplier-pending-ledger-page">
      <div className="page-header">
        <h1>
          <i className="fa fa-building me-2"></i>
          Supplier Payments & Ledger
        </h1>
      </div>
      
      <div className="card">
        <div className="card-header">
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <a className="nav-link active"><i className="fa fa-money text-danger"></i> All</a>
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="filter-row">
            <div className="filter-group">
              <label htmlFor="supplier_id" className="form-label">Supplier</label>
              <SearchableSelect
                options={[
                  { value: '', label: '--Select Supplier--' },
                  ...suppliers.map(s => ({
                    value: String(s.supp_id),
                    label: s.supp_name
                  }))
                ]}
                value={selectedSupplier}
                onChange={handleSupplierChange}
                placeholder="Select Supplier"
              />
            </div>
            <div className="filter-group">
              <label htmlFor="currency_type" className="form-label">Currency</label>
              <SearchableSelect
                options={currencies.map(c => ({
                  value: String(c.currencyID),
                  label: c.currencyName
                }))}
                value={selectedCurrency ? String(selectedCurrency) : ''}
                onChange={handleCurrencyChange}
                placeholder="Select Currency"
              />
            </div>
            <div className="filter-actions">
              <button type="button" className="btn btn-danger btn-sm rounded-pill" onClick={handlePrint}>
                <i className="fa fa-print me-1"></i> Print
              </button>
              <button type="button" className="btn btn-customBlue btn-sm rounded-pill" onClick={handleExcelExport}>
                <i className="fa fa-file-excel-o me-1"></i> Excel
              </button>
            </div>
          </div>
          
          <div className="table-responsive mt-4">
            <div id="printThisArea">
              <table className="table table-striped table-hover text-center" id="mainTable">
                <thead className="thead text-white">
                  <tr>
                    <th>#</th>
                    <th>Supplier Name</th>
                    <th>Supplier Email</th>
                    <th>Supplier Phone</th>
                    <th>Pending Amount</th>
                    <th data-exclude="true" id="actionArea">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center" style={{ padding: '50px 20px', color: '#64748b' }}>
                        <i className="fa fa-inbox" style={{ fontSize: '48px', marginBottom: '15px', display: 'block', opacity: 0.5 }}></i>
                        <div style={{ fontSize: '16px', fontWeight: 500 }}>No pending suppliers found</div>
                        <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Select a supplier and currency to view pending payments</div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {pendingSuppliers.map((supplier, index) => (
                        <tr key={supplier.main_supp}>
                          <td>{index + 1}</td>
                          <td className="text-capitalize">{supplier.supp_name}</td>
                          <td>{supplier.supp_email || '-'}</td>
                          <td>{supplier.supp_phone || '-'}</td>
                          <td>{formatNumber(supplier.Pending || supplier.total || 0)}</td>
                          <td data-exclude="true" className="action-cell">
                            <a 
                              href={`/supplier/ledger?id=${supplier.main_supp}&curID=${selectedCurrency}`}
                              className="text-dark me-2"
                            >
                              <i className="fa fa-file"></i> View Ledger
                            </a>
                            <span className="me-2">|</span>
                            <a 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleMakePayment(supplier);
                              }}
                              className="text-danger"
                            >
                              <i className="fa fa-cc-paypal"></i> Make Payment
                            </a>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td><strong>{formatNumber(totalPending)}</strong></td>
                        <td data-exclude="true"></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPaymentModal(false);
          setPaymentData({ payment_amount: 0, payment_detail: '', account_id: undefined });
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">Supplier Make Payment</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentData({ payment_amount: 0, payment_detail: '', account_id: undefined });
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handlePaymentSubmit}>
                <div className="form-group row">
                  <label className="col-sm-4 col-form-label">
                    <i className="fa fa-dollar"></i>Total Charges
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="text"
                      disabled
                      className="form-control"
                      value={formatNumber(totalCharges)}
                    />
                  </div>
                </div>
                <div className="form-group row">
                  <label className="col-sm-4 col-form-label">
                    <i className="fa fa-money"></i>Payment Amount
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="number"
                      className="form-control"
                      value={paymentData.payment_amount || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_amount: Number(e.target.value) })}
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="Enter payment amount"
                    />
                  </div>
                </div>
                <div className="form-group row">
                  <label className="col-sm-4 col-form-label">
                    <i className="fa fa-comment"></i>Payment Detail
                  </label>
                  <div className="col-sm-8">
                    <textarea
                      className="form-control"
                      rows={4}
                      value={paymentData.payment_detail || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, payment_detail: e.target.value })}
                      placeholder="Enter payment details (optional)"
                    />
                  </div>
                </div>
                <div className="form-group row">
                  <label className="col-sm-4 col-form-label">
                    <i className="fa fa-bank"></i>Account
                  </label>
                  <div className="col-sm-8">
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Account--' },
                        ...accounts.map(a => ({
                          value: String(a.account_ID),
                          label: a.account_Name
                        }))
                      ]}
                      value={paymentData.account_id ? String(paymentData.account_id) : ''}
                      onChange={(value) => setPaymentData({ ...paymentData, account_id: value ? Number(value) : undefined })}
                      placeholder="Select Account"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentData({ payment_amount: 0, payment_detail: '', account_id: undefined });
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addPaymentMutation.isPending}
                  >
                    {addPaymentMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-1"></i> Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

