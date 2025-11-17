import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../services/api';
import residenceService from '../../services/residenceService';
import Swal from 'sweetalert2';
import './ResidenceReport.css';

interface Customer {
  main_customer: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
}

export default function ResidencePendingReport() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Array<{currencyID: number; currencyName: string}>>([]);
  const [selectedCustomerID, setSelectedCustomerID] = useState<number | null>(null);
  const [selectedCurrencyID, setSelectedCurrencyID] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => {
    loadCurrencies();
  }, []);

  useEffect(() => {
    if (selectedCurrencyID) {
      loadPendingCustomers();
    } else {
      setCustomers([]);
      setTotalPending(0);
    }
  }, [selectedCustomerID, selectedCurrencyID]);

  const loadCurrencies = async () => {
    try {
      const data = await residenceService.getLookups();
      const currenciesList = (data.currencies || []).map((curr: any) => ({
        currencyID: curr.currencyID,
        currencyName: curr.currencyName
      }));
      setCurrencies(currenciesList);
      
      // Find and set AED currency as default
      // Try multiple variations: AED, UAE Dirham, Dirham, etc.
      const aedCurrency = currenciesList.find((curr: any) => {
        const name = curr.currencyName?.toLowerCase() || '';
        return name === 'aed' || 
               name === 'uae dirham' ||
               name === 'dirham' ||
               name.includes('aed') ||
               name.includes('dirham') ||
               (name.includes('uae') && name.includes('dirham'));
      });
      
      if (aedCurrency) {
        console.log('Found AED currency:', aedCurrency);
        setSelectedCurrencyID(aedCurrency.currencyID);
      } else if (currenciesList.length > 0) {
        // If AED not found, select first currency
        console.log('AED currency not found, selecting first currency:', currenciesList[0]);
        setSelectedCurrencyID(currenciesList[0].currencyID);
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };


  const loadPendingCustomers = async () => {
    if (!selectedCurrencyID) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('customerID', selectedCustomerID?.toString() || '0');
      formData.append('currencyID', selectedCurrencyID.toString());
      
      const response = await axios.post('/residence/customer-pending-report.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Pending customers response:', response);
      console.log('Response data:', response.data);
      
      // Handle JWTHelper response format: { success: true, message: "...", data: { data: [...] } }
      if (response && response.data) {
        const responseData = response.data;
        
        if (responseData.success && responseData.data) {
          let data = [];
          
          // Check nested data structure
          if (responseData.data.data && Array.isArray(responseData.data.data)) {
            data = responseData.data.data;
          } else if (Array.isArray(responseData.data)) {
            data = responseData.data;
          } else if (Array.isArray(responseData)) {
            data = responseData;
          }
          
          setCustomers(data);
          
          // Calculate total
          const total = data.reduce((sum: number, customer: Customer) => {
            return sum + parseFloat(customer.total?.toString() || '0');
          }, 0);
          setTotalPending(total);
        } else {
          setCustomers([]);
          setTotalPending(0);
          if (responseData.message) {
            Swal.fire('Info', responseData.message, 'info');
          }
        }
      } else {
        setCustomers([]);
        setTotalPending(0);
      }
    } catch (error: any) {
      console.error('Error loading pending customers:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load pending customers';
      Swal.fire('Error', errorMessage, 'error');
      setCustomers([]);
      setTotalPending(0);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLedger = (customerID: number) => {
    if (!selectedCurrencyID) {
      Swal.fire('Error', 'Please select a currency first', 'error');
      return;
    }
    // Navigate to ledger page
    navigate(`/residence/ledger/${customerID}?currencyID=${selectedCurrencyID}`);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printThisArea');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const currencyName = currencies.find(c => c.currencyID === selectedCurrencyID)?.currencyName || '';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Residence Payments & Ledger Report</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
          <style>
            body { padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: linear-gradient(to left, #b31217, #e52d27); color: white; }
            .table-striped tbody tr:nth-of-type(odd) { background-color: rgba(0,0,0,.05); }
          </style>
        </head>
        <body>
          <h1 class="text-center"><i class="fa fa-home"></i> All Residence Report</h1>
          <h5 class="text-center">Currency: ${currencyName}</h5>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportExcel = () => {
    // Simple table to Excel export
    const table = document.getElementById('mainTable');
    if (!table) return;
    
    let csv = '';
    const rows = table.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
      const cols = rows[i].querySelectorAll('td, th');
      const row = [];
      for (let j = 0; j < cols.length - 1; j++) { // Exclude action column
        row.push((cols[j] as HTMLElement).innerText);
      }
      csv += row.join(',') + '\n';
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Residence_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="residence-report-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <i className="fa fa-money mr-2 text-danger"></i>
          Residence Payments & Ledger <i className="fa fa-arrow-down text-red"></i>
        </h1>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <div className="card-header text-white" style={{
          background: 'linear-gradient(to left, #b31217, #e52d27)'
        }}>
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <a className="nav-link active">
                <i className="fa fa-money text-danger"></i> All
              </a>
            </li>
          </ul>
        </div>
        <div className="card-body">
          <div className="row align-items-end">
            <div className="col-md-3">
              <label className="form-label text-white">Customer (Optional)</label>
              <select
                className="form-control"
                value={selectedCustomerID || ''}
                onChange={(e) => setSelectedCustomerID(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">-- All Customers --</option>
                {/* Customer dropdown would be populated from API if needed */}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label text-white">Currency <span className="text-danger">*</span></label>
              <select
                className="form-control"
                value={selectedCurrencyID || ''}
                onChange={(e) => {
                  setSelectedCurrencyID(e.target.value ? parseInt(e.target.value) : null);
                  setSelectedCustomerID(null);
                }}
                required
              >
                <option value="">-- Select Currency --</option>
                {currencies.map((curr) => (
                  <option key={curr.currencyID} value={curr.currencyID}>
                    {curr.currencyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 offset-md-4">
              <button
                type="button"
                className="btn btn-danger btn-sm rounded-pill me-2"
                onClick={handlePrint}
                disabled={!selectedCurrencyID || customers.length === 0}
              >
                <i className="fa fa-print me-1"></i> Print
              </button>
              <button
                type="button"
                className="btn btn-dark btn-sm rounded-pill"
                onClick={handleExportExcel}
                disabled={!selectedCurrencyID || customers.length === 0}
              >
                <i className="fa fa-file-excel-o me-1"></i> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div id="printThisArea">
        <div className="table-responsive">
          <table className="table table-striped table-hover text-center" id="mainTable">
            <thead className="text-white" style={{
              background: 'linear-gradient(to left, #b31217, #e52d27)',
              fontSize: '13px'
            }}>
              <tr>
                <th>#</th>
                <th>Customer Name</th>
                <th>Customer Email</th>
                <th>Customer Phone</th>
                <th>Pending Amount</th>
                <th data-exclude="true">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    <i className="fa fa-spinner fa-spin fa-2x"></i>
                    <p className="mt-2">Loading...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    {selectedCurrencyID ? 'No records found' : 'Please select a currency to view pending customers'}
                  </td>
                </tr>
              ) : (
                <>
                  {customers.map((customer, index) => (
                    <tr key={customer.main_customer}>
                      <td className="p-3">{index + 1}</td>
                      <td className="text-capitalize p-3">{customer.customer_name}</td>
                      <td className="p-3">{customer.customer_email || 'N/A'}</td>
                      <td className="p-3">{customer.customer_phone || 'N/A'}</td>
                      <td className="p-3">{parseFloat(customer.total.toString()).toLocaleString()}</td>
                      <td data-exclude="true">
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleViewLedger(customer.main_customer);
                          }}
                          className="mt-2"
                          style={{ color: '#ED213A' }}
                        >
                          <i className="fa fa-eye"></i> View Ledger
                        </a>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="text-end fw-bold p-3">Total:</td>
                    <td className="fw-bold p-3">{totalPending.toLocaleString()}</td>
                    <td data-exclude="true"></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

