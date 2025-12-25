import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import amerService from '../../services/amerService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type {
  AmerTransaction,
  AmerType,
  AmerTransactionFilters,
  CreateAmerTransactionRequest,
  CreateAmerTypeRequest,
  DropdownData
} from '../../types/amer';
import './AmerTransactions.css';

// Declare pdfjsLib for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getFirstDayOfMonth = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
};

export default function AmerTransactions() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'types'>('transactions');
  const [filters, setFilters] = useState<AmerTransactionFilters>({
    start_date: getFirstDayOfMonth(),
    end_date: getTodayDate()
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Transaction modal states
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    transaction: AmerTransaction | null;
  }>({ isOpen: false, transaction: null });
  
  // Type modal states
  const [typeModal, setTypeModal] = useState<{
    isOpen: boolean;
    type: AmerType | null;
  }>({ isOpen: false, type: null });
  
  // Status change modal
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    transaction: AmerTransaction | null;
  }>({ isOpen: false, transaction: null });
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns, isLoading: dropdownsLoading, error: dropdownsError } = useQuery<DropdownData>({
    queryKey: ['amer-dropdowns'],
    queryFn: () => amerService.getDropdowns(),
    retry: 2
  });
  
  useEffect(() => {
    if (dropdownsError) {
      console.error('Error loading dropdowns:', dropdownsError);
      Swal.fire('Error', 'Failed to load dropdown data. Please refresh the page.', 'error');
    }
  }, [dropdownsError]);
  
  // Load transactions
  const { data: transactions = [], isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<AmerTransaction[]>({
    queryKey: ['amer-transactions', filters],
    queryFn: () => amerService.getTransactions(filters)
  });
  
  // Load types
  const { data: types = [], isLoading: typesLoading, refetch: refetchTypes } = useQuery<AmerType[]>({
    queryKey: ['amer-types'],
    queryFn: () => amerService.getTypes()
  });
  
  // Mutations
  const createTransactionMutation = useMutation({
    mutationFn: (data: CreateAmerTransactionRequest) => amerService.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-transactions'] });
      setTransactionModal({ isOpen: false, transaction: null });
      Swal.fire('Success', 'Transaction added successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add transaction', 'error');
    }
  });
  
  const updateTransactionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAmerTransactionRequest> }) =>
      amerService.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-transactions'] });
      setTransactionModal({ isOpen: false, transaction: null });
      Swal.fire('Success', 'Transaction updated successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update transaction', 'error');
    }
  });
  
  const deleteTransactionMutation = useMutation({
    mutationFn: (id: number) => amerService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-transactions'] });
      Swal.fire('Success', 'Transaction deleted successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete transaction', 'error');
    }
  });
  
  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      amerService.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-transactions'] });
      setStatusModal({ isOpen: false, transaction: null });
      Swal.fire('Success', 'Status updated successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update status', 'error');
    }
  });
  
  const createTypeMutation = useMutation({
    mutationFn: (data: CreateAmerTypeRequest) => amerService.createType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-types'] });
      setTypeModal({ isOpen: false, type: null });
      Swal.fire('Success', 'Type added successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add type', 'error');
    }
  });
  
  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAmerTypeRequest> }) =>
      amerService.updateType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-types'] });
      setTypeModal({ isOpen: false, type: null });
      Swal.fire('Success', 'Type updated successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update type', 'error');
    }
  });
  
  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => amerService.deleteType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amer-types'] });
      Swal.fire('Success', 'Type deleted successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete type', 'error');
    }
  });
  
  const handleSearch = () => {
    refetchTransactions();
  };
  
  const handleReset = () => {
    setFilters({
      start_date: getFirstDayOfMonth(),
      end_date: getTodayDate()
    });
    setSearchTerm('');
  };
  
  const handleAddTransaction = () => {
    setTransactionModal({ isOpen: true, transaction: null });
  };
  
  const handleEditTransaction = async (transaction: AmerTransaction) => {
    setTransactionModal({ isOpen: true, transaction });
  };
  
  const handleDeleteTransaction = (id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete this transaction',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteTransactionMutation.mutate(id);
      }
    });
  };
  
  const handleChangeStatus = (transaction: AmerTransaction) => {
    setStatusModal({ isOpen: true, transaction });
  };
  
  const handleSubmitStatus = (status: string) => {
    if (statusModal.transaction) {
      changeStatusMutation.mutate({ id: statusModal.transaction.id, status });
    }
  };
  
  const handleAddType = () => {
    setTypeModal({ isOpen: true, type: null });
  };
  
  const handleEditType = (type: AmerType) => {
    setTypeModal({ isOpen: true, type });
  };
  
  const handleDeleteType = (id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete this type',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteTypeMutation.mutate(id);
      }
    });
  };
  
  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-warning',
      completed: 'bg-success',
      rejected: 'bg-danger',
      refunded: 'bg-info',
      visit_required: 'bg-warning'
    };
    return badges[status] || 'bg-secondary';
  };
  
  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      t.transaction_number.toLowerCase().includes(search) ||
      t.application_number.toLowerCase().includes(search) ||
      t.passenger_name.toLowerCase().includes(search) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(search)) ||
      (t.iban && t.iban.toLowerCase().includes(search))
    );
  });
  
  return (
    <div className="amer-transactions-page">
      <div className="page-header">
        <h1>Amer Transactions</h1>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transactions
          </button>
          <button
            className={`tab ${activeTab === 'types' ? 'active' : ''}`}
            onClick={() => setActiveTab('types')}
          >
            Transaction Types
          </button>
        </div>
      </div>
      
      {activeTab === 'transactions' && (
        <div className="transactions-section">
          <div className="panel">
            <div className="panel-header">
              <h3>Search Transactions</h3>
              <button className="btn btn-success" onClick={handleAddTransaction}>
                Add Transaction
              </button>
            </div>
            <div className="panel-body">
              <div className="search-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={filters.start_date || ''}
                      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={filters.end_date || ''}
                      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Customer</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'All' },
                        ...(dropdowns?.customers?.map(c => ({
                          value: c.customer_id,
                          label: c.customer_name
                        })) || [])
                      ]}
                      value={filters.customer || ''}
                      onChange={(value) => setFilters({ ...filters, customer: value ? Number(value) : undefined })}
                      placeholder="All"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Type</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'All' },
                        ...(dropdowns?.types?.map(t => ({
                          value: t.id,
                          label: t.name
                        })) || [])
                      ]}
                      value={filters.type || ''}
                      onChange={(value) => setFilters({ ...filters, type: value ? Number(value) : undefined })}
                      placeholder="All"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Account</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'All Accounts' },
                        ...(dropdowns?.accounts?.map(a => ({
                          value: a.account_ID,
                          label: a.account_Name
                        })) || [])
                      ]}
                      value={filters.account || ''}
                      onChange={(value) => setFilters({ ...filters, account: value ? Number(value) : undefined })}
                      placeholder="All Accounts"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Status</label>
                    <select
                      value={filters.status || ''}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                      className="form-control"
                    >
                      <option value="">All</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                      <option value="refunded">Refunded</option>
                      <option value="visit_required">Visit Required</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Search</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search..."
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <div className="button-group">
                      <button className="btn btn-primary" onClick={handleSearch}>
                        <i className="fa fa-filter"></i> Search
                      </button>
                      <button className="btn btn-secondary" onClick={handleReset}>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="panel">
            <div className="panel-header">
              <h3>Transactions</h3>
            </div>
            <div className="panel-body">
              {transactionsLoading ? (
                <div className="text-center p-4">Loading...</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Customer / Passenger</th>
                        <th>Transaction Details</th>
                        <th>Account</th>
                        <th>Status</th>
                        <th>Net Cost</th>
                        <th>Sale Cost</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center">No transactions found</td>
                        </tr>
                      ) : (
                        filteredTransactions.map(transaction => (
                          <tr key={transaction.id}>
                            <td>{transaction.id}</td>
                            <td>
                              <strong>{transaction.customer_name}</strong>
                              <br />
                              {transaction.passenger_name}
                            </td>
                            <td>
                              Type: <strong>{transaction.type_name}</strong>
                              <br />
                              Trx# {transaction.transaction_number}
                              <br />
                              App# {transaction.application_number}
                              <br />
                              Payment Date: {new Date(transaction.payment_date).toLocaleDateString()}
                              <br />
                              IBAN: {transaction.iban || 'N/A'}
                            </td>
                            <td>
                              <strong>{transaction.account_Name || 'No Account'}</strong>
                            </td>
                            <td>
                              <span className={`badge ${getStatusBadge(transaction.status)}`}>
                                {transaction.status}
                              </span>
                            </td>
                            <td>{transaction.cost_price}</td>
                            <td>{transaction.sale_price}</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleEditTransaction(transaction)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                >
                                  Delete
                                </button>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleChangeStatus(transaction)}
                                >
                                  Change Status
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'types' && (
        <div className="types-section">
          <div className="panel">
            <div className="panel-header">
              <h3>Transaction Types</h3>
              <button className="btn btn-success" onClick={handleAddType}>
                Add Type
              </button>
            </div>
            <div className="panel-body">
              {typesLoading ? (
                <div className="text-center p-4">Loading...</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Cost Price</th>
                        <th>Sale Price</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {types.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center">No types found</td>
                        </tr>
                      ) : (
                        types.map(type => (
                          <tr key={type.id}>
                            <td>{type.id}</td>
                            <td>{type.name}</td>
                            <td>{type.cost_price}</td>
                            <td>{type.sale_price}</td>
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEditType(type)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteType(type.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Transaction Modal */}
      {transactionModal.isOpen && (
        <TransactionModal
          transaction={transactionModal.transaction}
          dropdowns={dropdowns}
          onClose={() => setTransactionModal({ isOpen: false, transaction: null })}
          onSubmit={(data) => {
            if (transactionModal.transaction) {
              updateTransactionMutation.mutate({ id: transactionModal.transaction.id, data });
            } else {
              createTransactionMutation.mutate(data as CreateAmerTransactionRequest);
            }
          }}
        />
      )}
      
      {/* Type Modal */}
      {typeModal.isOpen && (
        <TypeModal
          type={typeModal.type}
          onClose={() => setTypeModal({ isOpen: false, type: null })}
          onSubmit={(data) => {
            if (typeModal.type) {
              updateTypeMutation.mutate({ id: typeModal.type.id, data });
            } else {
              createTypeMutation.mutate(data as CreateAmerTypeRequest);
            }
          }}
        />
      )}
      
      {/* Status Change Modal */}
      {statusModal.isOpen && statusModal.transaction && (
        <StatusModal
          transaction={statusModal.transaction}
          onClose={() => setStatusModal({ isOpen: false, transaction: null })}
          onSubmit={handleSubmitStatus}
        />
      )}
    </div>
  );
}

// Transaction Modal Component
function TransactionModal({
  transaction,
  dropdowns,
  onClose,
  onSubmit
}: {
  transaction: AmerTransaction | null;
  dropdowns?: DropdownData;
  onClose: () => void;
  onSubmit: (data: Partial<CreateAmerTransactionRequest>) => void;
}) {
  const [formData, setFormData] = useState<Partial<CreateAmerTransactionRequest>>({
    customer_id: transaction?.customer_id || undefined,
    passenger_name: transaction?.passenger_name || '',
    type_id: transaction?.type_id || undefined,
    application_number: transaction?.application_number || '',
    transaction_number: transaction?.transaction_number || '',
    payment_date: transaction?.payment_date || getTodayDate(),
    cost_price: transaction?.cost_price || '',
    sale_price: transaction?.sale_price || '',
    iban: transaction?.iban || '',
    account_id: transaction?.account_id || undefined,
    created_by: transaction?.created_by || undefined,
    status: transaction?.status || 'pending'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pdfMessage, setPdfMessage] = useState<string>('');
  const receiptInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (transaction) {
      setFormData({
        customer_id: transaction.customer_id,
        passenger_name: transaction.passenger_name,
        type_id: transaction.type_id,
        application_number: transaction.application_number,
        transaction_number: transaction.transaction_number,
        payment_date: transaction.payment_date,
        cost_price: transaction.cost_price,
        sale_price: transaction.sale_price,
        iban: transaction.iban || '',
        account_id: transaction.account_id,
        created_by: transaction.created_by,
        status: transaction.status
      });
    } else {
      // Reset form when creating new transaction
      setFormData({
        customer_id: undefined,
        passenger_name: '',
        type_id: undefined,
        application_number: '',
        transaction_number: '',
        payment_date: getTodayDate(),
        cost_price: '',
        sale_price: '',
        iban: '',
        account_id: undefined,
        created_by: undefined,
        status: 'pending'
      });
      setPdfMessage('');
      if (receiptInputRef.current) {
        receiptInputRef.current.value = '';
      }
    }
  }, [transaction]);

  // Load PDF.js library
  useEffect(() => {
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';
        }
      };
      document.head.appendChild(script);
    } else {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';
    }
  }, []);

  const extractAndFillForm = async (file: File) => {
    if (!window.pdfjsLib) {
      setPdfMessage('PDF.js library is loading. Please try again in a moment.');
      return;
    }

    setPdfMessage('Processing PDF...');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;
      let fullText = '';
      
      // Collect text from all pages
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
      }
      
      console.log('Full Extracted Text (All Pages):', fullText);

      // Updated patterns with IBAN
      const patterns = {
        passenger_name: /Name:\s+([A-Z][A-Z\s]+)(?=\s+[أ-ي])/i,
        transaction_type: /(?:New Work Entry Permit - Employee|Transaction Type:?\s*([\w\s]+))/i,
        application_number: /Application #:\s+(\d+)/i,
        transaction_number: /Trans\. #:\s+(\d+)/i,
        payment_date: /Payment Date:\s+(?:\d{2}:\d{2}:\d{2}\s+)?(\d{2}-\d{2}-\d{4})/i,
        grand_total: /Grand Total\s+([\d,]+\.?\d*)/i,
        iban: /IBAN #:\s+([A-Z0-9-\s]+|-)/i
      };

      const extractedData: any = {};
      for (const [field, pattern] of Object.entries(patterns)) {
        const match = fullText.match(pattern);
        if (match) {
          extractedData[field] = field === 'transaction_type' ? 
            (match[1] ? match[1].trim() : 'New Work Entry Permit - Employee') : 
            match[1].trim();
          console.log(`Matched ${field}: "${extractedData[field]}"`);
        }
      }

      // Convert DD-MM-YYYY to YYYY-MM-DD for payment_date
      if (extractedData.payment_date) {
        const [day, month, year] = extractedData.payment_date.split('-');
        extractedData.payment_date = `${year}-${month}-${day}`;
        console.log(`Converted payment_date: "${extractedData.payment_date}"`);
      }

      // Update form data with extracted values
      const updatedFormData: any = { ...formData };
      
      if (extractedData.passenger_name) {
        updatedFormData.passenger_name = extractedData.passenger_name;
      }
      
      if (extractedData.transaction_type && dropdowns?.types) {
        const foundType = dropdowns.types.find(t => 
          t.name.trim().toLowerCase() === extractedData.transaction_type.toLowerCase()
        );
        if (foundType) {
          updatedFormData.type_id = foundType.id;
          updatedFormData.sale_price = foundType.sale_price;
        }
      }
      
      if (extractedData.application_number) {
        updatedFormData.application_number = extractedData.application_number;
      }
      
      if (extractedData.transaction_number) {
        updatedFormData.transaction_number = extractedData.transaction_number;
      }
      
      if (extractedData.payment_date) {
        updatedFormData.payment_date = extractedData.payment_date;
      }
      
      if (extractedData.grand_total) {
        updatedFormData.cost_price = extractedData.grand_total.replace(/,/g, '');
      }
      
      if (extractedData.iban) {
        updatedFormData.iban = extractedData.iban === '-' ? '' : extractedData.iban;
      }
      
      setFormData(updatedFormData);
      
      // Check if we got useful data
      if (extractedData.passenger_name && !extractedData.application_number && !extractedData.transaction_number) {
        setPdfMessage('Warning: Only passenger name was extracted. Please check the PDF format.');
      } else {
        setPdfMessage('PDF data loaded successfully');
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      setPdfMessage('Error reading PDF file. Please check the file format.');
    }
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      extractAndFillForm(file);
    } else if (file) {
      setPdfMessage('Please upload a valid PDF file');
    }
  };
  
  const handleTypeChange = (typeId: number) => {
    const selectedType = dropdowns?.types.find(t => t.id === typeId);
    if (selectedType) {
      setFormData({
        ...formData,
        type_id: typeId,
        sale_price: selectedType.sale_price
      });
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_id) newErrors.customer_id = 'Customer is required';
    if (!formData.passenger_name) newErrors.passenger_name = 'Passenger Name is required';
    if (!formData.type_id) newErrors.type_id = 'Type is required';
    if (!formData.application_number) newErrors.application_number = 'Application Number is required';
    if (!formData.transaction_number) newErrors.transaction_number = 'Transaction Number is required';
    if (!formData.payment_date) newErrors.payment_date = 'Payment Date is required';
    if (!formData.cost_price) newErrors.cost_price = 'Net Cost is required';
    if (!formData.sale_price) newErrors.sale_price = 'Sale Cost is required';
    if (!formData.account_id) newErrors.account_id = 'Account is required';
    if (!formData.created_by) newErrors.created_by = 'Staff Member is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{transaction ? 'Edit Transaction' : 'New Transaction'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select' },
                    ...(dropdowns?.customers?.map(c => ({
                      value: c.customer_id,
                      label: c.customer_name
                    })) || [])
                  ]}
                  value={formData.customer_id || ''}
                  onChange={(value) => setFormData({ ...formData, customer_id: Number(value) })}
                  placeholder="Select Customer"
                  required
                />
                {errors.customer_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.customer_id}</div>}
              </div>
              <div className="form-group">
                <label>Account <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select Account' },
                    ...(dropdowns?.accounts?.map(a => ({
                      value: a.account_ID,
                      label: a.account_Name
                    })) || [])
                  ]}
                  value={formData.account_id || ''}
                  onChange={(value) => setFormData({ ...formData, account_id: Number(value) })}
                  placeholder="Select Account"
                  required
                />
                {errors.account_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.account_id}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Passenger Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.passenger_name}
                  onChange={(e) => setFormData({ ...formData, passenger_name: e.target.value })}
                  className={`form-control ${errors.passenger_name ? 'is-invalid' : ''}`}
                />
                {errors.passenger_name && <div className="invalid-feedback">{errors.passenger_name}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Transaction Type <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select' },
                    ...(dropdowns?.types?.map(t => ({
                      value: t.id,
                      label: t.name
                    })) || [])
                  ]}
                  value={formData.type_id || ''}
                  onChange={(value) => handleTypeChange(Number(value))}
                  placeholder="Select Transaction Type"
                  required
                />
                {errors.type_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.type_id}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Application Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.application_number}
                  onChange={(e) => setFormData({ ...formData, application_number: e.target.value })}
                  className={`form-control ${errors.application_number ? 'is-invalid' : ''}`}
                />
                {errors.application_number && <div className="invalid-feedback">{errors.application_number}</div>}
              </div>
              <div className="form-group">
                <label>Transaction Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.transaction_number}
                  onChange={(e) => setFormData({ ...formData, transaction_number: e.target.value })}
                  className={`form-control ${errors.transaction_number ? 'is-invalid' : ''}`}
                />
                {errors.transaction_number && <div className="invalid-feedback">{errors.transaction_number}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className={`form-control ${errors.payment_date ? 'is-invalid' : ''}`}
                />
                {errors.payment_date && <div className="invalid-feedback">{errors.payment_date}</div>}
              </div>
              <div className="form-group">
                <label>Cost Price <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  className={`form-control ${errors.cost_price ? 'is-invalid' : ''}`}
                />
                {errors.cost_price && <div className="invalid-feedback">{errors.cost_price}</div>}
              </div>
              <div className="form-group">
                <label>Sale Price <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  className={`form-control ${errors.sale_price ? 'is-invalid' : ''}`}
                />
                {errors.sale_price && <div className="invalid-feedback">{errors.sale_price}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Upload Receipt (PDF)</label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleReceiptChange}
                  className="form-control"
                />
                {pdfMessage && (
                  <div className={`mt-2 ${pdfMessage.includes('Error') || pdfMessage.includes('Warning') ? 'text-danger' : 'text-success'}`}>
                    {pdfMessage}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>IBAN Info (optional)</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="form-control"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status <span className="text-danger">*</span></label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="form-control"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="form-group">
                <label>Staff Member <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select Staff Member' },
                    ...(dropdowns?.staff?.map(s => ({
                      value: s.staff_id,
                      label: s.staff_name
                    })) || [])
                  ]}
                  value={formData.created_by || ''}
                  onChange={(value) => setFormData({ ...formData, created_by: Number(value) })}
                  placeholder="Select Staff Member"
                  required
                />
                {errors.created_by && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.created_by}</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Type Modal Component
function TypeModal({
  type,
  onClose,
  onSubmit
}: {
  type: AmerType | null;
  onClose: () => void;
  onSubmit: (data: Partial<CreateAmerTypeRequest>) => void;
}) {
  const [formData, setFormData] = useState<Partial<CreateAmerTypeRequest>>({
    name: type?.name || '',
    cost_price: type?.cost_price || '',
    sale_price: type?.sale_price || ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (type) {
      setFormData({
        name: type.name,
        cost_price: type.cost_price,
        sale_price: type.sale_price
      });
    }
  }, [type]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.cost_price) newErrors.cost_price = 'Cost Price is required';
    if (!formData.sale_price) newErrors.sale_price = 'Sale Price is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{type ? 'Update Transaction Type' : 'Add Transaction Type'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Transaction Type <span className="text-danger">*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
              />
              {errors.name && <div className="invalid-feedback">{errors.name}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cost Price <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  className={`form-control ${errors.cost_price ? 'is-invalid' : ''}`}
                />
                {errors.cost_price && <div className="invalid-feedback">{errors.cost_price}</div>}
              </div>
              <div className="form-group">
                <label>Sale Price <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                  className={`form-control ${errors.sale_price ? 'is-invalid' : ''}`}
                />
                {errors.sale_price && <div className="invalid-feedback">{errors.sale_price}</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Status Modal Component
function StatusModal({
  transaction,
  onClose,
  onSubmit
}: {
  transaction: AmerTransaction;
  onClose: () => void;
  onSubmit: (status: string) => void;
}) {
  const [status, setStatus] = useState(transaction.status);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(status);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Change Transaction Status</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Status <span className="text-danger">*</span></label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-control"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded</option>
                <option value="visit_required">Visit Required</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

