import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import queryClient from './utils/queryClient';

// Layout
import ColorAdminLayout from './layouts/ColorAdminLayout';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import LoginOTP from './pages/auth/LoginOTP';
import DashboardRedesigned from './pages/dashboard/DashboardRedesigned';
import DashboardAnalytics from './pages/dashboard/DashboardAnalytics';
import Customers from './pages/customers/Customers';
import CustomerLedger from './pages/customers/CustomerLedger';
import CustomerLedgerView from './pages/customers/CustomerLedgerView';
import ResidenceList from './pages/residence/ResidenceList';
import ResidenceReport from './pages/residence/ResidenceReport';
import ResidencePendingReport from './pages/residence/ResidencePendingReport';
import ResidenceLedger from './pages/residence/ResidenceLedger';
import ResidenceDetail from './pages/residence/ResidenceDetail';
import CreateResidence from './pages/residence/CreateResidence';
import ResidenceTasks from './pages/residence/ResidenceTasks';
import FamilyTasks from './pages/residence/FamilyTasks';
import TicketList from './pages/ticket/TicketList';
import CreateTicket from './pages/ticket/CreateTicket';
import VisaList from './pages/visa/VisaList';
import CreateVisa from './pages/visa/CreateVisa';
import EmiratesIdTasks from './pages/visa/EmiratesIdTasks';
import FreezoneTasks from './pages/visa/FreezoneTasks';
import Establishments from './pages/establishments/Establishments';
import EstablishmentEmployees from './pages/establishments/EstablishmentEmployees';
import ManageEstablishments from './pages/establishments/ManageEstablishments';
import AmerTransactions from './pages/amer/AmerTransactions';
import Loans from './pages/loan/Loans';
import Hotels from './pages/hotel/Hotels';
import Services from './pages/service/Services';
import Suppliers from './pages/supplier/Suppliers';
import SupplierLedger from './pages/supplier/SupplierLedger';
import SupplierPendingLedger from './pages/supplier/SupplierPendingLedger';
import Expenses from './pages/expense/Expenses';
import PrintLetter from './pages/residence/PrintLetter';
import CustomerPayments from './pages/payment/CustomerPayments';
import SupplierPayments from './pages/payment/SupplierPayments';
import Agents from './pages/agent/Agents';
import AffiliateLedger from './pages/affiliate/AffiliateLedger';
import AffiliateLedgerView from './pages/affiliate/AffiliateLedgerView';
import StaffManagement from './pages/staff/StaffManagement';
import RoleManagement from './pages/role/RoleManagement';
import PermissionManagement from './pages/permission/PermissionManagement';
import AccountsReport from './pages/accounts/AccountsReport';
import AccountManagement from './pages/accounts/AccountManagement';
import TasheelTransactions from './pages/tasheel/TasheelTransactions';
import Cheques from './pages/cheque/Cheques';
import Salary from './pages/salary/Salary';
import CompanyDocuments from './pages/company-documents/FileManager';
import Notes from './pages/notes/Notes';
import Attachments from './pages/attachments/Attachments';
import ChatRoom from './pages/chatroom/ChatRoom';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppSettingsProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginOTP />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ColorAdminLayout />
                  </ProtectedRoute>
                }
              >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardRedesigned />} />
              <Route path="dashboard/analytics" element={<DashboardAnalytics />} />
              
              {/* Customers */}
              <Route path="customers/payments" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Customer Payments</h1><p className="mt-4 text-gray-600">Customer payments module coming soon...</p></div>} />
              <Route path="customers" element={<Customers />} />
              
              {/* Ledgers */}
              <Route path="ledger/customer" element={<CustomerLedger />} />
              <Route path="ledger/customer/view" element={<CustomerLedgerView />} />
              <Route path="ledger/supplier" element={<SupplierPendingLedger />} />
              <Route path="ledger/affiliate" element={<AffiliateLedger />} />
              <Route path="ledger/affiliate/view" element={<AffiliateLedgerView />} />
              
              {/* Agents */}
              <Route path="agents" element={<Agents />} />
              
              {/* Residence */}
              <Route path="residence" element={<ResidenceReport />} />
              <Route path="residence/report" element={<ResidencePendingReport />} />
              <Route path="residence/list" element={<ResidenceList />} />
              <Route path="residence/create" element={<CreateResidence />} />
              <Route path="residence/ledger/:id" element={<ResidenceLedger />} />
              <Route path="residence/tasks" element={<ResidenceTasks />} />
              <Route path="residence/family" element={<FamilyTasks />} />
              <Route path="residence/:id" element={<ResidenceDetail />} />
              
              {/* Tickets */}
              <Route path="ticket/report" element={<TicketList />} />
              <Route path="ticket/new" element={<CreateTicket />} />
              
              {/* Visa */}
              <Route path="visa/report" element={<VisaList />} />
              <Route path="visa/new" element={<CreateVisa />} />
              <Route path="visa-tasks/emirates-id" element={<EmiratesIdTasks />} />
              <Route path="visa-tasks/freezone" element={<FreezoneTasks />} />
              <Route path="visa/prices" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Visa Prices</h1><p className="mt-4 text-gray-600">Visa prices module coming soon...</p></div>} />
              <Route path="visa/dependents" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Dependents Visa</h1><p className="mt-4 text-gray-600">Dependents visa module coming soon...</p></div>} />
              
              {/* Payments */}
              <Route path="payment/customer" element={<CustomerPayments />} />
              <Route path="payment/supplier" element={<SupplierPayments />} />
              <Route path="payments" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">All Payments</h1><p className="mt-4 text-gray-600">Payments module coming soon...</p></div>} />
              <Route path="payments/pending" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Pending Payments</h1><p className="mt-4 text-gray-600">Pending payments module coming soon...</p></div>} />
              <Route path="payments/receipts" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Receipts</h1><p className="mt-4 text-gray-600">Receipts module coming soon...</p></div>} />
              
              {/* Expenses */}
              <Route path="expenses" element={<Expenses />} />
              
              {/* Bookings */}
              <Route path="bookings/hotels" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Hotels</h1><p className="mt-4 text-gray-600">Hotels module coming soon...</p></div>} />
              <Route path="bookings/car-rental" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Car Rental</h1><p className="mt-4 text-gray-600">Car rental module coming soon...</p></div>} />
              <Route path="bookings/tickets" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Tickets</h1><p className="mt-4 text-gray-600">Tickets module coming soon...</p></div>} />
              
              {/* Accounts */}
              <Route path="accounts" element={<AccountManagement />} />
              <Route path="accounts/report" element={<AccountsReport />} />
              <Route path="accounts/statement" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Account Statement</h1><p className="mt-4 text-gray-600">Account statement module coming soon...</p></div>} />
              <Route path="accounts/profit-loss" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Profit & Loss</h1><p className="mt-4 text-gray-600">Profit & Loss module coming soon...</p></div>} />
              
              {/* Staff */}
              <Route path="staff" element={<StaffManagement />} />
              <Route path="staff/attendance" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Staff Attendance</h1><p className="mt-4 text-gray-600">Staff attendance module coming soon...</p></div>} />
              <Route path="staff/salary" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Staff Salary</h1><p className="mt-4 text-gray-600">Staff salary module coming soon...</p></div>} />
              
              {/* Establishments */}
              <Route path="establishments" element={<Establishments />} />
              <Route path="establishments/manage" element={<ManageEstablishments />} />
              <Route path="establishments/:id/employees" element={<EstablishmentEmployees />} />
              
              {/* Amer Transactions */}
              <Route path="amer/transactions" element={<AmerTransactions />} />
              
              {/* Tasheel Transactions */}
              <Route path="tasheel" element={<TasheelTransactions />} />
              
              {/* Cheques */}
              <Route path="cheques" element={<Cheques />} />
              
              {/* Salary */}
              <Route path="salary" element={<Salary />} />
              
              {/* Loan Management */}
              <Route path="loan/new" element={<Loans />} />
              
              {/* Hotel Management */}
              <Route path="hotel/new" element={<Hotels />} />
              
              {/* Service Management */}
              <Route path="service" element={<Services />} />
              
              {/* Supplier Management */}
              <Route path="supplier" element={<Suppliers />} />
              <Route path="supplier/ledger" element={<SupplierLedger />} />
              
              {/* Print Letter */}
              <Route path="print-letter" element={<PrintLetter />} />
              
              {/* Reports */}
              <Route path="reports/receipts" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Receipt Report</h1><p className="mt-4 text-gray-600">Receipt report module coming soon...</p></div>} />
              <Route path="reports/expenses" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Expense Report</h1><p className="mt-4 text-gray-600">Expense report module coming soon...</p></div>} />
              <Route path="reports/accounts" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Account Report</h1><p className="mt-4 text-gray-600">Account report module coming soon...</p></div>} />
              
              {/* Role & Permission */}
              <Route path="role" element={<RoleManagement />} />
              <Route path="permission" element={<PermissionManagement />} />
              
              {/* Company Documents */}
              <Route path="company-documents" element={<CompanyDocuments />} />
              
              {/* Notes */}
              <Route path="notes" element={<Notes />} />
              
              {/* Attachments */}
              <Route path="attachments" element={<Attachments />} />
              
              {/* Chatroom */}
              <Route path="chatroom" element={<ChatRoom />} />
              
              {/* Settings */}
              <Route path="settings" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">Settings</h1><p className="mt-4 text-gray-600">Settings module coming soon...</p></div>} />
              <Route path="profile" element={<div className="p-6 bg-white rounded-xl shadow-lg"><h1 className="text-2xl font-bold">My Profile</h1><p className="mt-4 text-gray-600">Profile module coming soon...</p></div>} />
            </Route>

            {/* 404 Not Found */}
            <Route path="*" element={<div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-center"><h1 className="text-6xl font-bold text-red-600">404</h1><p className="text-xl text-gray-600 mt-4">Page not found</p></div></div>} />
          </Routes>
        </Router>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
