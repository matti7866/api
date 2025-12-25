import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { customerLedgerService } from '../../services/customerLedgerService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { PendingCustomer, CustomerOption, CurrencyOption, AddPaymentRequest } from '../../types/customerLedger';
import './CustomerLedger.css';

export default function CustomerLedger() {
  const queryClient = useQueryClient();
  
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<number | null>(null);
  const [totalCharges, setTotalCharges] = useState<number>(0);
  const [paymentData, setPaymentData] = useState<Partial<AddPaymentRequest>>({
    payment_amount: 0,
    remarks: '',
    account_id: undefined
  });
  
  // Load customers
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['customer-ledger-customers'],
    queryFn: () => customerLedgerService.getCustomers(),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load currencies
  const { data: currencies = [] } = useQuery<CurrencyOption[]>({
    queryKey: ['customer-ledger-currencies', selectedCustomer],
    queryFn: () => customerLedgerService.getCurrencies(selectedCustomer, selectedCustomer ? 'customer' : 'all'),
    enabled: true,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load pending customers
  const { data: pendingCustomers = [], refetch: refetchPending } = useQuery<PendingCustomer[]>({
    queryKey: ['customer-ledger-pending', selectedCustomer, selectedCurrency],
    queryFn: () => customerLedgerService.getPendingCustomers(selectedCustomer, selectedCurrency!),
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
  
  // Auto-select first currency when currencies load
  useEffect(() => {
    if (currencies.length > 0 && !selectedCurrency) {
      setSelectedCurrency(currencies[0].currencyID);
    }
  }, [currencies, selectedCurrency]);
  
  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: (data: AddPaymentRequest) => customerLedgerService.addPayment(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      setShowPaymentModal(false);
      setPaymentData({ payment_amount: 0, remarks: '', account_id: undefined });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger-pending'] });
      queryClient.invalidateQueries({ queryKey: ['customer-ledger-customers'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to add payment'
      });
    }
  });
  
  const handleCustomerChange = (value: string) => {
    setSelectedCustomer(value);
    setSelectedCurrency(null); // Reset currency when customer changes
  };
  
  const handleCurrencyChange = (value: string) => {
    setSelectedCurrency(value ? Number(value) : null);
  };
  
  const handleMakePayment = async (customer: PendingCustomer) => {
    setPaymentCustomerId(customer.main_customer);
    try {
      const charges = await customerLedgerService.getTotalCharges(customer.main_customer, selectedCurrency!);
      setTotalCharges(charges.total || 0);
      setShowPaymentModal(true);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Failed to load total charges'
      });
    }
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
    
    if (!paymentCustomerId || !selectedCurrency) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Missing customer or currency information'
      });
      return;
    }
    
    addPaymentMutation.mutate({
      customer_id: paymentCustomerId,
      payment_amount: paymentData.payment_amount!,
      currency_id: selectedCurrency,
      account_id: paymentData.account_id!,
      remarks: paymentData.remarks || ''
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
    
    const tableRows = pendingCustomers.map((customer, index) => `
      <tr>
        <td>${index + 1}</td>
        <td class="text-capitalize">${customer.customer_name}</td>
        <td>${customer.customer_email || '-'}</td>
        <td>${customer.customer_phone || '-'}</td>
        <td>${formatNumber(customer.total)}</td>
      </tr>
    `).join('');
    
    const total = pendingCustomers.reduce((sum, customer) => sum + customer.total, 0);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Ledger Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          h5 { text-align: center; margin-top: -10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: linear-gradient(to right, #004e92, #000428); color: white; padding: 12px; text-align: center; }
          td { padding: 12px; text-align: center; border-bottom: 1px solid #ddd; }
          .text-capitalize { text-transform: capitalize; }
          @media print {
            @page { margin: 1cm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1><i class="fa fa-home"></i> All Customer Ledger Report</h1>
        <h5>Currency: ${currencyName}</h5>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer Name</th>
              <th>Customer Email</th>
              <th>Customer Phone</th>
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
    // Simple Excel export using table data
    const currencyName = currencies.find(c => c.currencyID === selectedCurrency)?.currencyName || '';
    const currentDate = new Date().toLocaleString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    let csv = 'Customer Ledger Report\n';
    csv += `Currency: ${currencyName}\n`;
    csv += `Date: ${currentDate}\n\n`;
    csv += '#,Customer Name,Customer Email,Customer Phone,Pending Amount\n';
    
    pendingCustomers.forEach((customer, index) => {
      csv += `${index + 1},"${customer.customer_name}","${customer.customer_email || ''}","${customer.customer_phone || ''}",${customer.total}\n`;
    });
    
    const total = pendingCustomers.reduce((sum, customer) => sum + customer.total, 0);
    csv += `Total,,,,${total}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Customer_Ledger_Report_${currencyName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const totalPending = pendingCustomers.reduce((sum, customer) => sum + customer.total, 0);
  
  return (
    <div className="customer-ledger-page">
      <div className="page-header">
        <h1>
          <i className="fa fa-money me-2"></i>
          Customer Payments & Ledger
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
              <label htmlFor="customer_id" className="form-label">Customer</label>
              <SearchableSelect
                options={[
                  { value: '', label: '--Select Customer--' },
                  ...customers.map(c => ({
                    value: String(c.customer_id),
                    label: c.customer_name
                  }))
                ]}
                value={selectedCustomer}
                onChange={handleCustomerChange}
                placeholder="Select Customer"
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
                    <th>Customer Name</th>
                    <th>Customer Email</th>
                    <th>Customer Phone</th>
                    <th>Pending Amount</th>
                    <th data-exclude="true" id="actionArea">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center" style={{ padding: '50px 20px', color: '#6b7280', fontFamily: 'Montserrat, sans-serif' }}>
                        <i className="fa fa-inbox" style={{ fontSize: '48px', marginBottom: '15px', display: 'block', opacity: 0.5 }}></i>
                        <div style={{ fontSize: '16px', fontWeight: 500 }}>No pending customers found</div>
                        <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Select a customer and currency to view pending payments</div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {pendingCustomers.map((customer, index) => (
                        <tr key={customer.main_customer}>
                          <td>{index + 1}</td>
                          <td className="text-capitalize">{customer.customer_name}</td>
                          <td>{customer.customer_email || '-'}</td>
                          <td>{customer.customer_phone || '-'}</td>
                          <td>{formatNumber(customer.total)}</td>
                          <td data-exclude="true" className="action-cell">
                            <a 
                              href={`/receipt?id=${customer.main_customer}&curID=${selectedCurrency}`}
                              target="_self"
                              className="text-warning me-2"
                            >
                              <i className="fas fa-receipt"></i> Make Receipt
                            </a>
                            <span className="me-2">|</span>
                            <a 
                              href={`/ledger/customer/view?id=${customer.main_customer}&curID=${selectedCurrency}`}
                              className="text-dark me-2"
                            >
                              <i className="fa fa-file"></i> View Ledger
                            </a>
                            <span className="me-2">|</span>
                            <a 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleMakePayment(customer);
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
          setPaymentData({ payment_amount: 0, remarks: '', account_id: undefined });
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">Customer Make Payment</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentData({ payment_amount: 0, remarks: '', account_id: undefined });
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
                    <i className="fa fa-comment"></i>Remarks
                  </label>
                  <div className="col-sm-8">
                    <textarea
                      className="form-control"
                      rows={4}
                      value={paymentData.remarks || ''}
                      onChange={(e) => setPaymentData({ ...paymentData, remarks: e.target.value })}
                      placeholder="Enter remarks (optional)"
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
                      setPaymentData({ payment_amount: 0, remarks: '', account_id: undefined });
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

