import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { accountsService } from '../../services/accountsService';
import type {
  Account,
  Currency,
  Transaction,
  AccountBalance,
  DepositRequest,
  WithdrawRequest,
  TransferRequest
} from '../../types/accounts';
import './AccountsReport.css';

export default function AccountsReport() {
  const today = new Date().toISOString().split('T')[0];
  const permanentResetDate = '2025-10-01';

  // State
  const [fromDate, setFromDate] = useState(permanentResetDate);
  const [toDate, setToDate] = useState(today);
  const [accountFilter, setAccountFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showBalances, setShowBalances] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [summary, setSummary] = useState({
    totalCredits: '0.00',
    totalDebits: '0.00',
    totalTransfers: '0.00',
    netBalance: '0.00'
  });

  // Pagination state
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [balancesPage, setBalancesPage] = useState(1);
  const [transactionsPerPage, setTransactionsPerPage] = useState(50);
  const [balancesPerPage, setBalancesPerPage] = useState(20);

  // Statement modal state
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementAccountId, setStatementAccountId] = useState<number | null>(null);
  const [statementAccountName, setStatementAccountName] = useState('');
  const [statementFromDate, setStatementFromDate] = useState(permanentResetDate);
  const [statementToDate, setStatementToDate] = useState(today);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Modal states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTableInfoModal, setShowTableInfoModal] = useState(false);

  // Form data states
  const [depositData, setDepositData] = useState<Partial<DepositRequest>>({});
  const [withdrawData, setWithdrawData] = useState<Partial<WithdrawRequest>>({});
  const [transferData, setTransferData] = useState<Partial<TransferRequest>>({
    transferDate: today,
    transferCharges: 0,
    transferExchangeRate: 1
  });
  const [fromAccountBalance, setFromAccountBalance] = useState('');
  const [toAccountBalance, setToAccountBalance] = useState('');

  // Fetch accounts
  const { data: accounts = [], isLoading: accountsLoading, error: accountsError } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      console.log('Fetching accounts...');
      const response = await accountsService.getAccounts();
      console.log('Accounts received:', response);
      return response;
    },
    staleTime: 60000,
    retry: 2,
  });
  
  // Log accounts loading state
  useEffect(() => {
    if (accountsLoading) {
      console.log('Accounts are loading...');
    }
    if (accountsError) {
      console.error('Accounts error:', accountsError);
    }
    if (accounts && accounts.length > 0) {
      console.log('Accounts loaded successfully:', accounts.length, 'accounts');
    } else if (accounts && accounts.length === 0 && !accountsLoading) {
      console.warn('No accounts found or accounts array is empty');
    }
  }, [accounts, accountsLoading, accountsError]);

  // Fetch currencies
  const { data: currencies = [], isLoading: currenciesLoading, error: currenciesError } = useQuery<Currency[]>({
    queryKey: ['currencies'],
    queryFn: async () => {
      console.log('Fetching currencies...');
      const response = await accountsService.getCurrencies();
      console.log('Currencies received:', response);
      return response;
    },
    staleTime: 60000,
    retry: 2,
  });
  
  // Log currencies loading state
  useEffect(() => {
    if (currenciesLoading) {
      console.log('Currencies are loading...');
    }
    if (currenciesError) {
      console.error('Currencies error:', currenciesError);
    }
    if (currencies && currencies.length > 0) {
      console.log('Currencies loaded successfully:', currencies.length, 'currencies');
    } else if (currencies && currencies.length === 0 && !currenciesLoading) {
      console.warn('No currencies found or currencies array is empty');
    }
  }, [currencies, currenciesLoading, currenciesError]);

  // Load transactions mutation
  const loadTransactionsMutation = useMutation({
    mutationFn: () => accountsService.getDetailedTransactions({
      fromDate,
      toDate,
      accountFilter,
      typeFilter,
      resetDate: permanentResetDate
    }),
    onSuccess: (data: any) => {
      console.log('Transactions data received:', data);
      setTransactions(data.transactions || []);
      setTransactionsPage(1); // Reset to first page when new data loads
      if (data.summary) {
        setSummary({
          totalCredits: data.summary.totalCredits || '0.00 AED',
          totalDebits: data.summary.totalDebits || '0.00 AED',
          totalTransfers: data.summary.totalTransfers || '0.00 AED',
          netBalance: data.summary.netBalance || '0.00 AED'
        });
      }
    },
    onError: (error: any) => {
      console.error('Error loading transactions:', error);
      Swal.fire('Error', error.response?.data?.error || error.message || 'Failed to load transactions', 'error');
    }
  });

  // Load balances mutation
  const loadBalancesMutation = useMutation({
    mutationFn: () => accountsService.getAccountBalances(permanentResetDate),
    onSuccess: (data: any) => {
      console.log('Balances data received:', data);
      setBalances(data.balances || []);
      setBalancesPage(1); // Reset to first page when new data loads
    },
    onError: (error: any) => {
      console.error('Error loading balances:', error);
      Swal.fire('Error', error.response?.data?.error || error.message || 'Failed to load account balances', 'error');
    }
  });

  // Deposit mutation
  const depositMutation = useMutation({
    mutationFn: (data: DepositRequest) => accountsService.addDeposit(data),
    onSuccess: () => {
      Swal.fire('Success', 'Deposit added successfully', 'success');
      setShowDepositModal(false);
      setDepositData({});
      loadTransactionsMutation.mutate();
    },
    onError: (error: any) => {
      Swal.fire('Error', error.message || 'Failed to add deposit', 'error');
    }
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: (data: WithdrawRequest) => accountsService.addWithdrawal(data),
    onSuccess: () => {
      Swal.fire('Success', 'Withdrawal added successfully', 'success');
      setShowWithdrawModal(false);
      setWithdrawData({});
      loadTransactionsMutation.mutate();
    },
    onError: (error: any) => {
      Swal.fire('Error', error.message || 'Failed to add withdrawal', 'error');
    }
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: (data: TransferRequest) => accountsService.addTransfer(data),
    onSuccess: () => {
      Swal.fire('Success', 'Transfer completed successfully', 'success');
      setShowTransferModal(false);
      setTransferData({
        transferDate: today,
        transferCharges: 0,
        transferExchangeRate: 1
      });
      loadTransactionsMutation.mutate();
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to process transfer', 'error');
    }
  });

  // Load transactions on mount
  useEffect(() => {
    loadTransactionsMutation.mutate();
  }, []);

  // Handle balance toggle
  const handleToggleBalances = () => {
    if (!showBalances) {
      loadBalancesMutation.mutate();
    }
    setShowBalances(!showBalances);
  };

  // Handle deposit submit
  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositData.depositAccount || !depositData.depositAmount || !depositData.depositRemarks || !depositData.depositCurrency) {
      Swal.fire('Error', 'Please fill all required fields', 'error');
      return;
    }
    depositMutation.mutate(depositData as DepositRequest);
  };

  // Handle withdraw submit
  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawData.withdrawAccount || !withdrawData.withdrawAmount || !withdrawData.withdrawRemarks || !withdrawData.withdrawCurrency) {
      Swal.fire('Error', 'Please fill all required fields', 'error');
      return;
    }
    withdrawMutation.mutate(withdrawData as WithdrawRequest);
  };

  // Handle transfer submit
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = transferData as TransferRequest;
    
    if (!data.transferFromAccount || !data.transferToAccount || !data.transferAmount || !data.transferAmountConfirm) {
      Swal.fire('Error', 'Please fill all required fields', 'error');
      return;
    }
    
    if (data.transferFromAccount === data.transferToAccount) {
      Swal.fire('Error', 'From Account and To Account cannot be the same', 'error');
      return;
    }
    
    if (data.transferAmount !== data.transferAmountConfirm) {
      Swal.fire('Error', 'Amount and Confirm Amount must be the same', 'error');
      return;
    }
    
    transferMutation.mutate(data);
  };

  // Load account balance for transfer
  const loadAccountBalance = async (accountId: number, type: 'from' | 'to') => {
    try {
      const response = await accountsService.getAccountBalance(accountId);
      if (response.status === 'success') {
        const balance = `${response.account.Account_Balance} (from ${permanentResetDate})`;
        if (type === 'from') {
          setFromAccountBalance(balance);
        } else {
          setToAccountBalance(balance);
        }
      }
    } catch (error) {
      console.error('Error loading account balance:', error);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    accountsService.exportToExcel({
      fromDate,
      toDate,
      accountFilter,
      typeFilter,
      resetDate: permanentResetDate
    });
  };

  // Format number with commas
  const formatNumber = (num: number | string) => {
    const value = typeof num === 'string' ? parseFloat(num) : num;
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Pagination calculations
  const transactionsTotalPages = Math.ceil(transactions.length / transactionsPerPage);
  const balancesTotalPages = Math.ceil(balances.length / balancesPerPage);
  
  const paginatedTransactions = transactions.slice(
    (transactionsPage - 1) * transactionsPerPage,
    transactionsPage * transactionsPerPage
  );
  
  const paginatedBalances = balances.slice(
    (balancesPage - 1) * balancesPerPage,
    balancesPage * balancesPerPage
  );

  // Handle statement button click
  const handleShowStatement = (accountId: number, accountName: string) => {
    setStatementAccountId(accountId);
    setStatementAccountName(accountName);
    setStatementFromDate(permanentResetDate);
    setStatementToDate(today);
    setStatementData(null);
    setShowStatementModal(true);
  };

  // Load account statement
  const handleLoadStatement = async () => {
    if (!statementAccountId) return;
    
    setStatementLoading(true);
    try {
      const data = await accountsService.getAccountStatement(
        statementAccountId,
        statementFromDate,
        statementToDate
      );
      setStatementData(data);
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || error.message || 'Failed to load statement', 'error');
    } finally {
      setStatementLoading(false);
    }
  };

  // Pagination component helper
  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    itemsPerPage, 
    onItemsPerPageChange,
    totalItems,
    label 
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (perPage: number) => void;
    totalItems: number;
    label: string;
  }) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    return (
      <div className="pagination-controls">
        <div className="pagination-info">
          Showing {startItem} to {endItem} of {totalItems} {label}
        </div>
        <div className="pagination-items-per-page">
          <label>Items per page:</label>
          <select 
            value={itemsPerPage} 
            onChange={(e) => {
              onItemsPerPageChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="form-control form-control-sm"
            style={{ width: '80px', display: 'inline-block', marginLeft: '10px' }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="pagination-buttons">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <i className="fa fa-angle-double-left"></i> First
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <i className="fa fa-angle-left"></i> Prev
          </button>
          <span className="pagination-page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next <i className="fa fa-angle-right"></i>
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
          >
            Last <i className="fa fa-angle-double-right"></i>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="accounts-report-container">
      <div className="card">
        <div className="card-header bg-gradient">
          <h2>
            <i className="fa fa-fw fa-money"></i> Accounts Report - Detailed Transactions
          </h2>
        </div>

        {/* System Calculation Status */}
        <div className="card-body">
          <div className="alert alert-info mb-4">
            <h5><i className="fa fa-info-circle"></i> System Calculation Status</h5>
            <div className="alert alert-info-content">
              <i className="fa fa-calendar"></i> <strong>PERMANENT SETTING:</strong>
              All account balances and calculations are computed from <strong>01 October 2025</strong> onwards only.
              Transactions before this date are permanently excluded from all calculations.
            </div>
          </div>

          {/* Filters */}
          <div className="filters-row">
            <div className="filter-group">
              <label>From Date:</label>
              <input
                type="date"
                className="form-control"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                min={permanentResetDate}
              />
              <small className="text-muted">Cannot be before 2025-10-01</small>
            </div>
            <div className="filter-group">
              <label>To Date:</label>
              <input
                type="date"
                className="form-control"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Account:</label>
              <select
                className="form-control"
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.account_ID} value={account.account_ID}>
                    {account.account_Name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Transaction Type:</label>
              <select
                className="form-control"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="credit">Credits (Money In)</option>
                <option value="debit">Debits (Money Out)</option>
                <option value="transfer">Transfers</option>
                <option value="salary">Salaries</option>
                <option value="cheque">Cheques</option>
                <option value="refund">Refunds</option>
                <optgroup label="Residence Payments (Credits)">
                  <option value="tawjeeh_payment">Tawjeeh Payments</option>
                  <option value="insurance_payment">Insurance Payments (ILOE)</option>
                  <option value="residence_fine">Residence Fine Payments</option>
                  <option value="cancellation">Cancellation Payments</option>
                </optgroup>
                <optgroup label="Residence Operations (Debits)">
                  <option value="tawjeeh_operation">Tawjeeh Operations</option>
                  <option value="iloe_operation">ILOE Insurance Operations</option>
                  <option value="evisa_charge">eVisa Charges</option>
                </optgroup>
                <optgroup label="Other Operations (Debits)">
                  <option value="amer_transaction">Amer Transactions</option>
                  <option value="tasheel_transaction">Tasheel Transactions</option>
                  <option value="cancellation_transaction">Cancellation Transactions</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={() => loadTransactionsMutation.mutate()}
              disabled={loadTransactionsMutation.isPending}
            >
              <i className="fa fa-search"></i>{' '}
              {loadTransactionsMutation.isPending ? 'Loading...' : 'Load Transactions'}
            </button>
            <button className="btn btn-info" onClick={handleToggleBalances}>
              <i className="fa fa-balance-scale"></i>{' '}
              {showBalances ? 'Hide' : 'Show'} Account Balances
            </button>
            <button className="btn btn-success" onClick={handleExportExcel}>
              <i className="fa fa-file-excel-o"></i> Export to Excel
            </button>
            <button className="btn btn-warning" onClick={() => setShowTableInfoModal(true)}>
              <i className="fa fa-table"></i> View Credit/Debit Tables
            </button>
            <button className="btn btn-success" onClick={() => setShowDepositModal(true)}>
              <i className="fa fa-plus-circle"></i> Deposit
            </button>
            <button className="btn btn-danger" onClick={() => setShowWithdrawModal(true)}>
              <i className="fa fa-minus-circle"></i> Withdraw
            </button>
            <button className="btn btn-info" onClick={() => setShowTransferModal(true)}>
              <i className="fa fa-exchange"></i> Transfer
            </button>
          </div>
        </div>

        {/* Account Balances Section */}
        {showBalances && (
          <div className="card-body">
            <h4><i className="fa fa-balance-scale"></i> Current Account Balances</h4>
            <div className="alert alert-warning">
              <i className="fa fa-exclamation-triangle"></i> <strong>Note:</strong>
              Account balances shown here are in original currencies (not converted). For AED-converted totals, refer to the summary cards.
            </div>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Account ID</th>
                    <th>Account Name</th>
                    <th>Total Credits</th>
                    <th>Total Debits</th>
                    <th>Current Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadBalancesMutation.isPending ? (
                    <tr>
                      <td colSpan={7} className="text-center">Loading...</td>
                    </tr>
                  ) : balances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center">No balances found</td>
                    </tr>
                  ) : (
                    paginatedBalances.map((balance) => (
                      <tr key={balance.account_ID}>
                        <td>{balance.account_ID}</td>
                        <td>{balance.account_Name}</td>
                        <td className="text-success">{formatNumber(balance.total_credits)} {balance.currency}</td>
                        <td className="text-danger">{formatNumber(balance.total_debits)} {balance.currency}</td>
                        <td className={balance.balance >= 0 ? 'text-success' : 'text-danger'}>
                          <strong>{formatNumber(balance.balance)} {balance.currency}</strong>
                        </td>
                        <td>
                          <span className={`badge ${balance.balance >= 0 ? 'badge-success' : 'badge-danger'}`}>
                            {balance.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleShowStatement(balance.account_ID, balance.account_Name)}
                          >
                            <i className="fa fa-file-text"></i> Statement
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {balances.length > 0 && (
              <PaginationControls
                currentPage={balancesPage}
                totalPages={balancesTotalPages}
                onPageChange={setBalancesPage}
                itemsPerPage={balancesPerPage}
                onItemsPerPageChange={setBalancesPerPage}
                totalItems={balances.length}
                label="accounts"
              />
            )}
          </div>
        )}

        {/* Summary Cards */}
        <div className="card-body">
          <div className="alert alert-info">
            <i className="fa fa-info-circle"></i> <strong>Currency Conversion Notice:</strong>
            All amounts are automatically converted to AED using the latest exchange rates.
          </div>
          <div className="summary-cards">
            <div className="summary-card bg-success">
              <h5>Total Credits <small>(AED)</small></h5>
              <h3>{summary.totalCredits}</h3>
            </div>
            <div className="summary-card bg-danger">
              <h5>Total Debits <small>(AED)</small></h5>
              <h3>{summary.totalDebits}</h3>
            </div>
            <div className="summary-card bg-warning">
              <h5>Total Transfers <small>(AED)</small></h5>
              <h3>{summary.totalTransfers}</h3>
            </div>
            <div className="summary-card bg-info">
              <h5>Net Balance <small>(AED)</small></h5>
              <h3>{summary.netBalance}</h3>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card-body">
          <div className="table-responsive">
            <table className="table transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Type</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Credit (+) <small>AED</small></th>
                  <th>Debit (-) <small>AED</small></th>
                  <th>Currency Info</th>
                  <th>Staff Name</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loadTransactionsMutation.isPending ? (
                  <tr>
                    <td colSpan={10} className="text-center">Loading transactions...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center">Click "Load Transactions" to view data</td>
                  </tr>
                ) : (
                  paginatedTransactions.map((transaction, index) => {
                    // Use type_category from backend, or determine from transaction_type
                    const category = transaction.type_category || 
                      (transaction.transaction_type.toLowerCase().includes('transfer') ? 'transfer' :
                       transaction.credit > 0 ? 'credit' : 'debit');
                    const rowClass = `${category}-row`;

                    return (
                      <tr key={index} className={rowClass}>
                        <td>{new Date(transaction.date).toLocaleDateString()}</td>
                        <td>
                          <span className={`transaction-type ${category}`}>
                            {transaction.transaction_type}
                          </span>
                        </td>
                        <td>{transaction.account}</td>
                        <td>{transaction.description}</td>
                        <td>{transaction.reference}</td>
                        <td className="text-success credit-cell">
                          {transaction.credit > 0 ? formatNumber(transaction.credit) : '-'}
                        </td>
                        <td className="text-danger debit-cell">
                          {transaction.debit > 0 ? formatNumber(transaction.debit) : '-'}
                        </td>
                        <td>{transaction.currency_info}</td>
                        <td>{transaction.staff_name}</td>
                        <td>{transaction.remarks}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {transactions.length > 0 && (
            <PaginationControls
              currentPage={transactionsPage}
              totalPages={transactionsTotalPages}
              onPageChange={setTransactionsPage}
              itemsPerPage={transactionsPerPage}
              onItemsPerPageChange={setTransactionsPerPage}
              totalItems={transactions.length}
              label="transactions"
            />
          )}
        </div>
      </div>

      {/* Account Statement Modal */}
      {showStatementModal && (
        <div className="modal-overlay" onClick={() => setShowStatementModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-info">
              <h5><i className="fa fa-file-text"></i> Account Statement - {statementAccountName}</h5>
              <button className="close-btn" onClick={() => setShowStatementModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="statement-filters mb-4">
                <div className="row">
                  <div className="col-md-4">
                    <label>From Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={statementFromDate}
                      onChange={(e) => setStatementFromDate(e.target.value)}
                      min={permanentResetDate}
                    />
                  </div>
                  <div className="col-md-4">
                    <label>To Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={statementToDate}
                      onChange={(e) => setStatementToDate(e.target.value)}
                      max={today}
                    />
                  </div>
                  <div className="col-md-4">
                    <label>&nbsp;</label>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={handleLoadStatement}
                      disabled={statementLoading}
                    >
                      {statementLoading ? 'Loading...' : 'Load Statement'}
                    </button>
                  </div>
                </div>
              </div>

              {statementData && (
                <div>
                  <div className="statement-summary mb-4">
                    <div className="row">
                      <div className="col-md-3">
                        <div className="summary-box bg-success">
                          <h6>Total Credits</h6>
                          <h4>{formatNumber(statementData.totalCredits || 0)} {statementData.currency || 'AED'}</h4>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="summary-box bg-danger">
                          <h6>Total Debits</h6>
                          <h4>{formatNumber(statementData.totalDebits || 0)} {statementData.currency || 'AED'}</h4>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="summary-box bg-info">
                          <h6>Balance</h6>
                          <h4>{formatNumber(statementData.balance || 0)} {statementData.currency || 'AED'}</h4>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="summary-box bg-secondary">
                          <h6>Transactions</h6>
                          <h4>{statementData.transactions?.length || 0}</h4>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Credit</th>
                          <th>Debit</th>
                          <th>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementData.transactions && statementData.transactions.length > 0 ? (
                          statementData.transactions.map((tx: any, idx: number) => (
                            <tr key={idx}>
                              <td>{new Date(tx.date).toLocaleDateString()}</td>
                              <td>{tx.transaction_type}</td>
                              <td>{tx.description || '-'}</td>
                              <td className="text-success">
                                {tx.credit && tx.credit > 0 ? formatNumber(tx.credit) : '-'}
                              </td>
                              <td className="text-danger">
                                {tx.debit && tx.debit > 0 ? formatNumber(tx.debit) : '-'}
                              </td>
                              <td className={tx.running_balance >= 0 ? 'text-success' : 'text-danger'}>
                                <strong>{formatNumber(tx.running_balance || 0)}</strong>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center">No transactions found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!statementData && !statementLoading && (
                <div className="alert alert-info text-center">
                  <i className="fa fa-info-circle"></i> Select date range and click "Load Statement" to view account statement
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStatementModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-success">
              <h5><i className="fa fa-plus-circle"></i> Deposit Money</h5>
              <button className="close-btn" onClick={() => setShowDepositModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleDepositSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Account: <span className="text-danger">*</span></label>
                  <select
                    className="form-control"
                    value={depositData.depositAccount || ''}
                    onChange={(e) => setDepositData({ ...depositData, depositAccount: Number(e.target.value) })}
                    required
                    disabled={accountsLoading}
                  >
                    <option value="">--Select Account--</option>
                    {accountsLoading ? (
                      <option value="" disabled>Loading accounts...</option>
                    ) : accountsError ? (
                      <option value="" disabled>Error loading accounts</option>
                    ) : accounts.length === 0 ? (
                      <option value="" disabled>No accounts available</option>
                    ) : (
                      accounts.map((account) => (
                        <option key={account.account_ID} value={account.account_ID}>
                          {account.account_Name}
                        </option>
                      ))
                    )}
                  </select>
                  {accountsError && (
                    <small className="text-danger">Error loading accounts. Please refresh the page.</small>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group col-md-8">
                    <label>Deposit Amount: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={depositData.depositAmount || ''}
                      onChange={(e) => setDepositData({ ...depositData, depositAmount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-4">
                    <label>Currency: <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={depositData.depositCurrency || ''}
                      onChange={(e) => setDepositData({ ...depositData, depositCurrency: Number(e.target.value) })}
                      required
                      disabled={currenciesLoading}
                    >
                      <option value="">Select</option>
                      {currenciesLoading ? (
                        <option value="" disabled>Loading currencies...</option>
                      ) : currenciesError ? (
                        <option value="" disabled>Error loading currencies</option>
                      ) : currencies.length === 0 ? (
                        <option value="" disabled>No currencies available</option>
                      ) : (
                        currencies.map((currency) => (
                          <option key={currency.currencyID} value={currency.currencyID}>
                            {currency.currencyName}
                          </option>
                        ))
                      )}
                    </select>
                    {currenciesError && (
                      <small className="text-danger">Error loading currencies. Please refresh the page.</small>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Remarks: <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    value={depositData.depositRemarks || ''}
                    onChange={(e) => setDepositData({ ...depositData, depositRemarks: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDepositModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-success" disabled={depositMutation.isPending}>
                  {depositMutation.isPending ? 'Saving...' : 'Save Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-danger">
              <h5><i className="fa fa-minus-circle"></i> Withdraw Money</h5>
              <button className="close-btn" onClick={() => setShowWithdrawModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleWithdrawSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Account: <span className="text-danger">*</span></label>
                  <select
                    className="form-control"
                    value={withdrawData.withdrawAccount || ''}
                    onChange={(e) => setWithdrawData({ ...withdrawData, withdrawAccount: Number(e.target.value) })}
                    required
                    disabled={accountsLoading}
                  >
                    <option value="">--Select Account--</option>
                    {accountsLoading ? (
                      <option value="" disabled>Loading accounts...</option>
                    ) : accountsError ? (
                      <option value="" disabled>Error loading accounts</option>
                    ) : accounts.length === 0 ? (
                      <option value="" disabled>No accounts available</option>
                    ) : (
                      accounts.map((account) => (
                        <option key={account.account_ID} value={account.account_ID}>
                          {account.account_Name}
                        </option>
                      ))
                    )}
                  </select>
                  {accountsError && (
                    <small className="text-danger">Error loading accounts. Please refresh the page.</small>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group col-md-8">
                    <label>Withdrawal Amount: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={withdrawData.withdrawAmount || ''}
                      onChange={(e) => setWithdrawData({ ...withdrawData, withdrawAmount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-4">
                    <label>Currency: <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={withdrawData.withdrawCurrency || ''}
                      onChange={(e) => setWithdrawData({ ...withdrawData, withdrawCurrency: Number(e.target.value) })}
                      required
                      disabled={currenciesLoading}
                    >
                      <option value="">Select</option>
                      {currenciesLoading ? (
                        <option value="" disabled>Loading currencies...</option>
                      ) : currenciesError ? (
                        <option value="" disabled>Error loading currencies</option>
                      ) : currencies.length === 0 ? (
                        <option value="" disabled>No currencies available</option>
                      ) : (
                        currencies.map((currency) => (
                          <option key={currency.currencyID} value={currency.currencyID}>
                            {currency.currencyName}
                          </option>
                        ))
                      )}
                    </select>
                    {currenciesError && (
                      <small className="text-danger">Error loading currencies. Please refresh the page.</small>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Remarks: <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    value={withdrawData.withdrawRemarks || ''}
                    onChange={(e) => setWithdrawData({ ...withdrawData, withdrawRemarks: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowWithdrawModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-danger" disabled={withdrawMutation.isPending}>
                  {withdrawMutation.isPending ? 'Saving...' : 'Save Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-info">
              <h5><i className="fa fa-exchange"></i> Transfer Money</h5>
              <button className="close-btn" onClick={() => setShowTransferModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Date: <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={transferData.transferDate || today}
                      onChange={(e) => setTransferData({ ...transferData, transferDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Transaction No.:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={transferData.transferTrxNumber || ''}
                      onChange={(e) => setTransferData({ ...transferData, transferTrxNumber: e.target.value })}
                      placeholder="Optional Transaction Number"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-8">
                    <label>From Account: <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={transferData.transferFromAccount || ''}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setTransferData({ ...transferData, transferFromAccount: value });
                        if (value) loadAccountBalance(value, 'from');
                      }}
                      required
                      disabled={accountsLoading}
                    >
                      <option value="">Select Account</option>
                      {accountsLoading ? (
                        <option value="" disabled>Loading accounts...</option>
                      ) : accountsError ? (
                        <option value="" disabled>Error loading accounts</option>
                      ) : accounts.length === 0 ? (
                        <option value="" disabled>No accounts available</option>
                      ) : (
                        accounts.map((account) => (
                          <option key={account.account_ID} value={account.account_ID}>
                            {account.account_Name}
                          </option>
                        ))
                      )}
                    </select>
                    {accountsError && (
                      <small className="text-danger">Error loading accounts. Please refresh the page.</small>
                    )}
                  </div>
                  <div className="form-group col-md-4">
                    <label>Balance:</label>
                    <input type="text" className="form-control" value={fromAccountBalance} disabled />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-8">
                    <label>To Account: <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={transferData.transferToAccount || ''}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setTransferData({ ...transferData, transferToAccount: value });
                        if (value) loadAccountBalance(value, 'to');
                      }}
                      required
                      disabled={accountsLoading}
                    >
                      <option value="">Select Account</option>
                      {accountsLoading ? (
                        <option value="" disabled>Loading accounts...</option>
                      ) : accountsError ? (
                        <option value="" disabled>Error loading accounts</option>
                      ) : accounts.length === 0 ? (
                        <option value="" disabled>No accounts available</option>
                      ) : (
                        accounts.map((account) => (
                          <option key={account.account_ID} value={account.account_ID}>
                            {account.account_Name}
                          </option>
                        ))
                      )}
                    </select>
                    {accountsError && (
                      <small className="text-danger">Error loading accounts. Please refresh the page.</small>
                    )}
                  </div>
                  <div className="form-group col-md-4">
                    <label>Balance:</label>
                    <input type="text" className="form-control" value={toAccountBalance} disabled />
                  </div>
                </div>
                <div className="form-group">
                  <label>Remarks:</label>
                  <textarea
                    className="form-control"
                    value={transferData.transferRemarks || ''}
                    onChange={(e) => setTransferData({ ...transferData, transferRemarks: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Amount: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={transferData.transferAmount || ''}
                      onChange={(e) => setTransferData({ ...transferData, transferAmount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Confirm Amount: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={transferData.transferAmountConfirm || ''}
                      onChange={(e) => setTransferData({ ...transferData, transferAmountConfirm: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Charges: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={transferData.transferCharges || 0}
                      onChange={(e) => setTransferData({ ...transferData, transferCharges: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Exchange Rate: <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={transferData.transferExchangeRate || 1}
                      onChange={(e) => setTransferData({ ...transferData, transferExchangeRate: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-info" disabled={transferMutation.isPending}>
                  {transferMutation.isPending ? 'Processing...' : 'Save Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table Info Modal */}
      {showTableInfoModal && (
        <div className="modal-overlay" onClick={() => setShowTableInfoModal(false)}>
          <div className="modal-content modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-info">
              <h5><i className="fa fa-table"></i> Database Tables - Credit & Debit Operations</h5>
              <button className="close-btn" onClick={() => setShowTableInfoModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <i className="fa fa-info-circle"></i> <strong>Purpose:</strong> This overview helps developers and administrators understand which database tables contribute to credit and debit calculations.
              </div>
              <p className="text-muted">Please refer to the PHP documentation for detailed table information.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTableInfoModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

