import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import './AffiliateLedger.css';

interface CustomerOption {
  customer_id: number;
  customer_name: string;
}

interface CurrencyOption {
  currencyID: number;
  currencyName: string;
}

interface PendingCustomer {
  main_customer: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  affliate_supp_id: number;
  total: number;
}

export default function AffiliateLedger() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<number | null>(null);
  
  // Load customers with affiliate suppliers
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ['affiliate-customers'],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedger.php', {
        action: 'getCustomers'
      });
      return response.data.success ? response.data.data : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load currencies
  const { data: currencies = [] } = useQuery<CurrencyOption[]>({
    queryKey: ['affiliate-currencies', selectedCustomer],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedger.php', {
        action: 'getCurrencies',
        customer_id: selectedCustomer,
        type: selectedCustomer ? 'customer' : 'all'
      });
      return response.data.success ? response.data.data : [];
    },
    enabled: true,
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load pending customers
  const { data: pendingCustomers = [] } = useQuery<PendingCustomer[]>({
    queryKey: ['affiliate-pending', selectedCustomer, selectedCurrency],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedger.php', {
        action: 'getPendingCustomers',
        customer_id: selectedCustomer,
        currency_id: selectedCurrency
      });
      return response.data.success ? response.data.data : [];
    },
    enabled: !!selectedCurrency,
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  // Auto-select first currency when currencies load
  useEffect(() => {
    if (currencies.length > 0 && !selectedCurrency) {
      setSelectedCurrency(currencies[0].currencyID);
    }
  }, [currencies, selectedCurrency]);
  
  const handleCustomerChange = (value: string) => {
    setSelectedCustomer(value);
    setSelectedCurrency(null);
  };
  
  const handleCurrencyChange = (value: string) => {
    setSelectedCurrency(value ? Number(value) : null);
  };
  
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const currencyName = currencies.find(c => c.currencyID === selectedCurrency)?.currencyName || '';
    
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
        <title>Affiliate Business Report</title>
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
        <h1><i class="fa fa-handshake"></i> Affiliate Business Report</h1>
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
    const currencyName = currencies.find(c => c.currencyID === selectedCurrency)?.currencyName || '';
    
    let csv = 'Affiliate Business Report\n';
    csv += `Currency: ${currencyName}\n\n`;
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
    link.setAttribute('download', `Affiliate_Business_Report_${currencyName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const totalPending = pendingCustomers.reduce((sum, customer) => sum + customer.total, 0);
  
  return (
    <div className="affiliate-ledger-page">
      <div className="page-header">
        <h1>
          <i className="fa fa-handshake me-2"></i>
          Affiliate Business Payments & Ledger
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
                      <td colSpan={6} className="text-center" style={{ padding: '50px 20px', color: '#64748b' }}>
                        <i className="fa fa-inbox" style={{ fontSize: '48px', marginBottom: '15px', display: 'block', opacity: 0.5 }}></i>
                        <div style={{ fontSize: '16px', fontWeight: 500 }}>No affiliate customers found</div>
                        <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Select a customer and currency to view affiliate business</div>
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
                              href={`/ledger/affiliate/view?id=${customer.main_customer}&curID=${selectedCurrency}&affID=${customer.affliate_supp_id}`}
                              className="text-primary"
                            >
                              <i className="fa fa-eye"></i> View Ledger
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
    </div>
  );
}

