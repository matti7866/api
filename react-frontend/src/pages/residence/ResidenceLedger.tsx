import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from '../../services/api';
import Swal from 'sweetalert2';
// Using native Date for date formatting - moment not required
import './ResidenceLedger.css';

interface LedgerRecord {
  residenceID: number;
  main_passenger: string;
  nationality: string;
  company_name: string;
  dt: string;
  sale_price: number;
  fine: number;
  cancellation_charges: number;
  tawjeeh_charges: number;
  iloe_charges: number;
  custom_charges: number;
  residencePayment: number;
  finePayment: number;
  tawjeeh_payments: number;
  iloe_payments: number;
  current_status: string;
  is_family_residence?: number;
  familyResidenceID?: number;
  main_residence_id?: number;
}

interface CustomerInfo {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

export default function ResidenceLedger() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currencyID = searchParams.get('currencyID') || searchParams.get('curID');
  
  // Debug logging
  console.log('ResidenceLedger - Route params:', { id });
  console.log('ResidenceLedger - Search params:', { 
    currencyID: searchParams.get('currencyID'),
    curID: searchParams.get('curID'),
    allParams: Object.fromEntries(searchParams.entries())
  });
  
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currencyName, setCurrencyName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [totalCharges, setTotalCharges] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    console.log('ResidenceLedger useEffect - ID:', id, 'CurrencyID:', currencyID);
    if (id && currencyID) {
      loadCustomerInfo();
      loadCurrencyInfo();
      loadLedger();
    } else {
      console.warn('Missing required parameters - ID:', id, 'CurrencyID:', currencyID);
      Swal.fire('Error', 'Missing required parameters. Please provide customer ID and currency ID.', 'error');
    }
  }, [id, currencyID, currentPage, recordsPerPage]);

  const loadCustomerInfo = async () => {
    if (!id) return;
    
    try {
      const formData = new FormData();
      formData.append('ID', id);
      
      console.log('Loading customer info for ID:', id);
      const response = await axios.post('/invoice/get-customer-info.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Customer info response:', response);
      
      if (response && response.data) {
        let customerData = null;
        
        // Handle JWTHelper response format
        if (response.data.success && response.data.data && response.data.data.data) {
          customerData = response.data.data.data[0];
        } else if (response.data.data && Array.isArray(response.data.data)) {
          customerData = response.data.data[0];
        } else if (Array.isArray(response.data)) {
          customerData = response.data[0];
        }
        
        if (customerData) {
          setCustomerInfo({
            customer_name: customerData.customer_name || '',
            customer_email: customerData.customer_email || 'Nill',
            customer_phone: customerData.customer_phone || 'Nill'
          });
        }
      }
    } catch (error: any) {
      console.error('Error loading customer info:', error);
      console.error('Error response:', error.response);
    }
  };

  const loadCurrencyInfo = async () => {
    if (!currencyID) return;
    
    try {
      const formData = new FormData();
      formData.append('ID', currencyID);
      
      console.log('Loading currency info for ID:', currencyID);
      const response = await axios.post('/invoice/get-ledger-currency.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Currency info response:', response);
      
      if (response && response.data) {
        let currencyData = null;
        
        // Handle JWTHelper response format
        if (response.data.success && response.data.data && response.data.data.data) {
          currencyData = response.data.data.data[0];
        } else if (response.data.data && Array.isArray(response.data.data)) {
          currencyData = response.data.data[0];
        } else if (Array.isArray(response.data)) {
          currencyData = response.data[0];
        }
        
        if (currencyData) {
          setCurrencyName(currencyData.currencyName || '');
        }
      }
    } catch (error: any) {
      console.error('Error loading currency info:', error);
      console.error('Error response:', error.response);
    }
  };

  const loadLedger = async () => {
    if (!id || !currencyID) {
      console.error('Missing parameters - ID:', id, 'CurrencyID:', currencyID);
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('ID', id);
      formData.append('CurID', currencyID);
      formData.append('customerID', id); // Also send as customerID for compatibility
      formData.append('currencyID', currencyID); // Also send as currencyID for compatibility
      formData.append('page', currentPage.toString());
      formData.append('limit', recordsPerPage.toString());
      
      console.log('Loading ledger with ID:', id, 'CurrencyID:', currencyID, 'Page:', currentPage, 'Limit:', recordsPerPage);
      
      const response = await axios.post('/residence/residence-ledger-report.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('Ledger response:', response);
      console.log('Response data:', response.data);
      
      if (response && response.data) {
        const responseData = response.data;
        
        // Handle JWTHelper response format: { success: true, message: "...", data: { data: [...], pagination: {...}, totals: {...} } }
        let data = [];
        let pagination = null;
        let totals = null;
        
        if (responseData.success && responseData.data) {
          if (Array.isArray(responseData.data.data)) {
            data = responseData.data.data;
            pagination = responseData.data.pagination || null;
            totals = responseData.data.totals || null;
          } else if (Array.isArray(responseData.data)) {
            // Fallback for old format
            data = responseData.data;
          }
        } else if (Array.isArray(responseData)) {
          data = responseData;
        }
        
        setRecords(data);
        
        // Use totals from backend if available, otherwise calculate from current page
        if (totals) {
          setTotalCharges(totals.totalCharges || 0);
          setTotalPaid(totals.totalPaid || 0);
          setOutstandingBalance(totals.outstandingBalance || 0);
        } else {
          // Fallback: calculate from current page data
          let charges = 0;
          let paid = 0;
          
          data.forEach((record: LedgerRecord) => {
            charges += parseFloat(record.sale_price?.toString() || '0') +
                       parseFloat(record.fine?.toString() || '0') +
                       parseFloat(record.cancellation_charges?.toString() || '0') +
                       parseFloat(record.tawjeeh_charges?.toString() || '0') +
                       parseFloat(record.iloe_charges?.toString() || '0') +
                       parseFloat(record.custom_charges?.toString() || '0');
            
            paid += parseFloat(record.residencePayment?.toString() || '0') +
                    parseFloat(record.finePayment?.toString() || '0') +
                    parseFloat(record.tawjeeh_payments?.toString() || '0') +
                    parseFloat(record.iloe_payments?.toString() || '0');
          });
          
          setTotalCharges(charges);
          setTotalPaid(paid);
          setOutstandingBalance(charges - paid);
        }
        
        // Update pagination state
        if (pagination) {
          setTotalPages(pagination.totalPages || 1);
          setTotalRecords(pagination.totalRecords || data.length);
        } else {
          setTotalPages(1);
          setTotalRecords(data.length);
        }
      } else {
        setRecords([]);
        setTotalCharges(0);
        setTotalPaid(0);
        setOutstandingBalance(0);
        setTotalPages(1);
        setTotalRecords(0);
      }
    } catch (error: any) {
      console.error('Error loading ledger:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load ledger';
      Swal.fire('Error', errorMessage, 'error');
      setRecords([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printAreaRef.current) {
      Swal.fire('Error', 'Print area not found', 'error');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      Swal.fire('Error', 'Please allow popups to print', 'error');
      return;
    }

    const printContent = printAreaRef.current.innerHTML;
    const customerName = customerInfo?.customer_name || 'Customer';
    const fileName = `${customerName}_Ledger_${new Date().toISOString().split('T')[0]}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Residence Ledger - ${customerName}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            @page {
              size: A4 portrait;
              margin: 8mm 12mm;
            }
            
            html, body {
              width: 100%;
              height: auto;
              overflow: visible;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 10px;
              color: #1a1a1a;
              background: #ffffff;
              padding: 0;
              margin: 0;
              line-height: 1.5;
            }
            
            .no-print {
              display: none !important;
            }
            
            .container-fluid {
              width: 100%;
              padding: 0;
              margin: 0;
            }
            
            .row {
              display: flex;
              flex-wrap: wrap;
              margin: 0;
              width: 100%;
            }
            
            .col-md-6 {
              width: 50%;
              padding: 0 10px;
            }
            
            .col-md-4 {
              width: 33.333%;
              padding: 0 10px;
            }
            
            .col-md-8 {
              width: 66.666%;
              padding: 0 10px;
            }
            
            .offset-md-2 {
              margin-left: 16.666%;
            }
            
            .offset-md-4 {
              margin-left: 33.333%;
            }
            
            .print-header {
              margin-bottom: 5px;
              page-break-inside: avoid;
              page-break-after: avoid;
              background: #000000;
              padding: 15px 20px;
              border-radius: 8px;
              color: white;
              position: relative;
              min-height: 180px;
            }
            
            .print-header .col-md-6 {
              display: flex;
              flex-direction: column;
              height: 100%;
            }
            
            .print-logo {
              height: auto;
              width: 100%;
              max-width: 150px;
              object-fit: contain;
              background: transparent;
              padding: 0;
              border-radius: 0;
              display: block;
              margin-bottom: 20px;
            }
            
            .print-company-info-wrapper {
              margin-top: auto;
              padding-top: 20px;
            }
            
            .print-company-info {
              font-family: 'Inter', sans-serif;
              font-size: 13px;
              margin-bottom: 4px;
              line-height: 1.6;
              color: rgba(255, 255, 255, 0.95);
              font-weight: 400;
            }
            
            .print-company-info b {
              font-size: 16px;
              font-weight: 600;
              color: #ffffff;
            }
            
            .print-customer-info {
              margin-top: 0;
              background: rgba(255, 255, 255, 0.1);
              padding: 15px;
              border-radius: 6px;
            }
            
            .print-customer-title {
              font-family: 'Inter', sans-serif;
              font-size: 16px;
              color: #ffffff;
              font-weight: 600;
              margin-top: 0;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .print-customer-detail {
              font-family: 'Inter', sans-serif;
              font-size: 13px;
              margin-bottom: 4px;
              line-height: 1.6;
              color: rgba(255, 255, 255, 0.95);
            }
            
            .print-date {
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              color: rgba(255, 255, 255, 0.95);
              font-weight: 500;
            }
            
            hr.print-divider {
              border: none;
              width: 100%;
              border-bottom: 1px solid rgba(255, 255, 255, 0.3);
              margin: 8px 0 12px 0;
            }
            
            .table-responsive {
              width: 100%;
              overflow: visible;
              margin-top: 0;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }
            
            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin: 0;
              font-size: 11px;
              table-layout: fixed;
              background: white;
              max-width: 100%;
            }
            
            table th {
              background: #000000 !important;
              color: white !important;
              padding: 8px 4px;
              text-align: left;
              font-weight: 600;
              border: none;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              line-height: 1.4;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            table th:first-child {
              border-top-left-radius: 8px;
              width: 3%;
            }
            
            table th:nth-child(13) {
              border-top-right-radius: 8px;
              width: 7%;
              max-width: 80px;
              padding: 8px 2px !important;
            }
            
            table td {
              padding: 7px 4px;
              border-bottom: 1px solid #e5e7eb;
              text-align: left;
              font-size: 11px;
              word-wrap: break-word;
              overflow: hidden;
              font-family: 'Inter', sans-serif;
              line-height: 1.4;
              max-width: 0;
            }
            
            table td:nth-child(13) {
              max-width: 80px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              padding: 4px 2px !important;
            }
            
            table tbody tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            
            table tbody tr:nth-of-type(even) {
              background-color: #f9fafb;
            }
            
            table tbody tr:nth-of-type(odd) {
              background-color: #ffffff;
            }
            
            table tbody tr:last-child td {
              border-bottom: none;
            }
            
            .text-capitalize {
              text-transform: capitalize;
            }
            
            .text-muted {
              color: #6c757d;
            }
            
            small {
              font-size: 8px;
            }
            
            .print-totals {
              margin-top: 15px;
              page-break-inside: avoid;
              page-break-before: avoid;
              background: #000000;
              padding: 15px 20px;
              border-radius: 8px;
              color: white;
            }
            
            .print-totals .row {
              display: flex;
              justify-content: flex-end;
            }
            
            .print-totals .col-md-12 {
              text-align: right;
              width: 100%;
            }
            
            .print-totals .print-total-row {
              color: rgba(255, 255, 255, 0.95);
              text-align: right;
            }
            
            .print-totals .print-outstanding {
              color: #ffffff;
              text-align: right;
            }
            
            .print-totals hr {
              border-top: 1px solid rgba(255, 255, 255, 0.2);
              margin: 8px 0;
            }
            
            .print-total-row {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 10px;
              line-height: 1.8;
              color: rgba(255, 255, 255, 0.95);
              font-family: 'Inter', sans-serif;
              text-align: right;
            }
            
            .print-outstanding {
              font-size: 22px;
              font-weight: 700;
              margin-top: 12px;
              line-height: 1.8;
              color: #ffffff;
              font-family: 'Inter', sans-serif;
              padding-top: 12px;
              border-top: 2px solid rgba(255, 255, 255, 0.3);
              text-align: right;
            }
            
            .badge {
              padding: 2px 4px;
              border-radius: 6px;
              font-size: 8px;
              font-weight: 600;
              display: inline-block;
              text-transform: uppercase;
              letter-spacing: 0.1px;
              font-family: 'Inter', sans-serif;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 75px;
              line-height: 1.2;
            }
            
            .bg-success { 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; 
              color: white; 
              box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
            }
            .bg-danger { 
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important; 
              color: white; 
              box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
            }
            .bg-info { 
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important; 
              color: white; 
              box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
            }
            .bg-primary { 
              background: #000000 !important; 
              color: white; 
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }
            .bg-secondary { 
              background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important; 
              color: white; 
              box-shadow: 0 2px 4px rgba(107, 114, 128, 0.3);
            }
            
            hr {
              border: none;
              border-top: 1px solid rgba(0, 0, 0, 0.1);
              margin: 10px 0;
            }
            
            .text-muted {
              color: #6b7280;
              font-size: 8px;
            }
            
            small {
              font-size: 8px;
              opacity: 0.8;
            }
            
            @media print {
              html, body {
                width: 210mm;
                height: auto;
                min-height: 297mm;
                overflow: visible;
              }
              
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .container-fluid {
                page-break-inside: auto;
              }
              
              .print-header {
                page-break-after: avoid;
                page-break-inside: avoid;
                margin-bottom: 10px;
              }
              
              .table-responsive {
                page-break-inside: auto;
              }
              
              table {
                page-break-inside: auto;
              }
              
              table thead {
                display: table-header-group;
              }
              
              table tbody {
                display: table-row-group;
              }
              
              table tbody tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              
              table th {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .badge {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .print-totals {
                page-break-before: avoid;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="container-fluid">
            ${printContent}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Close window after printing (optional)
      // printWindow.close();
    }, 250);
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    let badgeClass = 'bg-secondary';
    
    if (statusLower === 'active') {
      badgeClass = 'bg-success';
    } else if (statusLower === 'cancelled' || statusLower === 'replaced' || statusLower === 'cancelled & replaced') {
      badgeClass = 'bg-danger';
    } else if (statusLower === 'renewed') {
      badgeClass = 'bg-info';
    } else if (statusLower === 'completed') {
      badgeClass = 'bg-primary';
    }
    
    return <span className={`badge ${badgeClass}`} style={{ WebkitPrintColorAdjust: 'exact' }}>{status}</span>;
  };

  const formatNumber = (num: number | string | null | undefined) => {
    const value = parseFloat(num?.toString() || '0');
    return value.toLocaleString();
  };

  const getDueSince = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const startDate = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 1) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (e) {
      return 'N/A';
    }
  };

  // Pagination calculations (using server-side pagination values)
  const indexOfLastRecord = Math.min(currentPage * recordsPerPage, totalRecords);
  const indexOfFirstRecord = totalRecords > 0 ? ((currentPage - 1) * recordsPerPage) + 1 : 0;

  // Reset to page 1 when records per page changes
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [recordsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="residence-ledger-page">
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-12">
            <div className="card">
              <div className="row no-print">
                <div className="col-md-4 offset-md-8">
                  <button className="btn btn-danger pull-right" onClick={handlePrint}>
                    Print Ledger
                  </button>
                </div>
              </div>
              
              <div id="printThisArea" ref={printAreaRef}>
                <div className="card-body">
                  <div className="print-header">
                    <div className="row">
                      <div className="col-md-6">
                        <img src="/assets/logo-white.png" alt="Logo" className="print-logo" />
                        <div className="print-company-info-wrapper">
                          <p className="print-company-info">
                            <b>Selab Nadiry Travel & Tourism</b>
                          </p>
                          <p className="print-company-info">
                            Address: Frij Murar Shop# 15, Deira, Dubai
                          </p>
                          <p className="print-company-info">
                            Contact:+971 4 298 4564,+971 58 514 0764
                          </p>
                        </div>
                      </div>
                      
                      <div className="col-md-4 offset-md-2 print-customer-info">
                        <h3 className="print-customer-title">
                          Customer Information
                        </h3>
                        <hr className="print-divider" />
                        
                        <p className="print-customer-detail">
                          Name: <span className="text-capitalize">{customerInfo?.customer_name || 'Loading...'}</span>
                        </p>
                        <p className="print-customer-detail">
                          Email: <span>{customerInfo?.customer_email || 'Loading...'}</span>
                        </p>
                        <p className="print-customer-detail">
                          Phone: <span>{customerInfo?.customer_phone || 'Loading...'}</span>
                        </p>
                        <p className="print-customer-detail">
                          Currency: <span>{currencyName || 'Loading...'}</span>
                        </p>
                        <h3 className="print-customer-title">
                          Date
                        </h3>
                        <hr className="print-divider" />
                        <h3 className="print-date">
                          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </h3>
                      </div>
                    </div>
                  </div>
                  
                  {/* Records Per Page Selector */}
                  {!loading && records.length > 0 && (
                    <div className="row no-print" style={{ marginBottom: '15px', marginTop: '15px' }}>
                      <div className="col-md-6">
                        <div className="d-flex align-items-center">
                          <label htmlFor="recordsPerPage" className="me-2" style={{ marginBottom: 0 }}>
                            Records per page:
                          </label>
                          <select
                            id="recordsPerPage"
                            className="form-control form-control-sm"
                            style={{ width: '80px', display: 'inline-block' }}
                            value={recordsPerPage}
                            onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                          <span className="ms-2 text-muted">
                            Showing {indexOfFirstRecord} to {indexOfLastRecord} of {totalRecords} records
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table Section */}
                  <div className="row" style={{ marginTop: '5px' }}>
                    <div className="table-responsive">
                      <table id="myTable" className="table table-striped table-hover table-bordered">
                        <thead>
                          <tr className="bg-danger text-white">
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>S#</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Passenger Name</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Establishment Name</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Due Since</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Total Sale</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Total Fine</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Cancellation Cost</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>TAWJEEH</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>ILOE</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Custom Charges</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Total Paid</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Balance</th>
                            <th style={{ WebkitPrintColorAdjust: 'exact' }}>Current Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={13} className="text-center py-4">
                                <i className="fa fa-spinner fa-spin fa-2x"></i>
                                <p className="mt-2">Loading...</p>
                              </td>
                            </tr>
                          ) : records.length === 0 ? (
                            <tr>
                              <td colSpan={13} className="text-center py-4">
                                No outstanding balance records found for this customer with the selected currency
                              </td>
                            </tr>
                          ) : (
                            records.map((record, index) => {
                              const isFamilyResidence = record.is_family_residence === 1;
                              const totalPaidForRecord = parseFloat(record.residencePayment?.toString() || '0') +
                                                         parseFloat(record.finePayment?.toString() || '0') +
                                                         parseFloat(record.tawjeeh_payments?.toString() || '0') +
                                                         parseFloat(record.iloe_payments?.toString() || '0');
                              
                              const totalChargesForRecord = parseFloat(record.sale_price?.toString() || '0') +
                                                            parseFloat(record.fine?.toString() || '0') +
                                                            parseFloat(record.cancellation_charges?.toString() || '0') +
                                                            parseFloat(record.tawjeeh_charges?.toString() || '0') +
                                                            parseFloat(record.iloe_charges?.toString() || '0') +
                                                            parseFloat(record.custom_charges?.toString() || '0');
                              
                              const balance = totalChargesForRecord - totalPaidForRecord;
                              
                              return (
                                <tr key={record.residenceID}>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{indexOfFirstRecord + index}</td>
                                  <td className="text-capitalize" style={{ WebkitPrintColorAdjust: 'exact' }}>
                                    {record.main_passenger}
                                    {isFamilyResidence && (
                                      <span className="badge bg-info ms-1" style={{ fontSize: '8px' }} title="Family Residence">
                                        FAM
                                      </span>
                                    )}
                                    <br />
                                    <small className="text-muted">
                                      <i className="fa fa-flag"></i> {record.nationality || 'N/A'}
                                    </small>
                                    {isFamilyResidence && record.main_residence_id && (
                                      <>
                                        <br />
                                        <small className="text-muted" style={{ fontSize: '8px' }}>
                                          <i className="fa fa-link"></i> Main: #{record.main_residence_id}
                                        </small>
                                      </>
                                    )}
                                  </td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{record.company_name || 'N/A'}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{getDueSince(record.dt)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.sale_price)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.fine)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.cancellation_charges)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.tawjeeh_charges)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.iloe_charges)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(record.custom_charges)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(totalPaidForRecord)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{formatNumber(balance)}</td>
                                  <td style={{ WebkitPrintColorAdjust: 'exact' }}>{getStatusBadge(record.current_status)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Pagination Controls */}
                  {!loading && records.length > 0 && totalPages > 1 && (
                    <div className="row no-print" style={{ marginTop: '20px', marginBottom: '20px' }}>
                      <div className="col-md-12">
                        <nav aria-label="Ledger pagination">
                          <ul className="pagination justify-content-center">
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                              <button
                                className="page-link"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                              >
                                Previous
                              </button>
                            </li>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                              // Show first page, last page, current page, and pages around current
                              if (
                                page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              ) {
                                return (
                                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                    <button
                                      className="page-link"
                                      onClick={() => handlePageChange(page)}
                                    >
                                      {page}
                                    </button>
                                  </li>
                                );
                              } else if (
                                page === currentPage - 2 ||
                                page === currentPage + 2
                              ) {
                                return (
                                  <li key={page} className="page-item disabled">
                                    <span className="page-link">...</span>
                                  </li>
                                );
                              }
                              return null;
                            })}
                            
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                              <button
                                className="page-link"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                              >
                                Next
                              </button>
                            </li>
                          </ul>
                        </nav>
                      </div>
                    </div>
                  )}
                  
                  {/* Totals Section */}
                  <div className="print-totals">
                    <div style={{ textAlign: 'right' }}>
                      <p className="print-total-row">
                        Total Charges: <span id="total">{formatNumber(totalCharges)} {currencyName}</span>
                      </p>
                      <hr />
                      <p className="print-total-row">
                        Total Paid: <span id="total_paid">{formatNumber(totalPaid)} {currencyName}</span>
                      </p>
                      <hr />
                      <p className="print-outstanding">
                        <b>Outstanding Balance: <span id="outstanding_balance">{formatNumber(outstandingBalance)} {currencyName}</span></b>
                      </p>
                      <hr />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

