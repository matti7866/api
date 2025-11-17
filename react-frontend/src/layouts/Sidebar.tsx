import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface MenuItem {
  name: string;
  path?: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
}

const Sidebar: React.FC = () => {
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(m => m !== menuName)
        : [...prev, menuName]
    );
  };

  const menuItems: MenuItem[] = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Customers',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      submenu: [
        { name: 'Manage Customers', path: '/customers', icon: null },
        { name: 'Customer Ledger', path: '/customers/ledger', icon: null },
        { name: 'Customer Payments', path: '/customers/payments', icon: null },
      ],
    },
    {
      name: 'Residence',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      submenu: [
        { name: 'Residence Report', path: '/residence', icon: null },
        { name: 'Residence Tasks', path: '/residence/tasks', icon: null },
        { name: 'Residence Ledger', path: '/residence/ledger', icon: null },
      ],
    },
    {
      name: 'Visa Services',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      submenu: [
        { name: 'Visa Management', path: '/visa', icon: null },
        { name: 'Visa Prices', path: '/visa/prices', icon: null },
        { name: 'Dependents Visa', path: '/visa/dependents', icon: null },
      ],
    },
    {
      name: 'Payments',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      submenu: [
        { name: 'All Payments', path: '/payments', icon: null },
        { name: 'Pending Payments', path: '/payments/pending', icon: null },
        { name: 'Receipts', path: '/payments/receipts', icon: null },
      ],
    },
    {
      name: 'Bookings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      submenu: [
        { name: 'Hotels', path: '/bookings/hotels', icon: null },
        { name: 'Car Rental', path: '/bookings/car-rental', icon: null },
        { name: 'Tickets', path: '/bookings/tickets', icon: null },
      ],
    },
    {
      name: 'Accounts',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      submenu: [
        { name: 'Account Management', path: '/accounts', icon: null },
        { name: 'Account Statement', path: '/accounts/statement', icon: null },
        { name: 'Profit & Loss', path: '/accounts/profit-loss', icon: null },
      ],
    },
    {
      name: 'Staff',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      submenu: [
        { name: 'Manage Staff', path: '/staff', icon: null },
        { name: 'Attendance', path: '/staff/attendance', icon: null },
        { name: 'Salary', path: '/staff/salary', icon: null },
      ],
    },
    {
      name: 'Reports',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      submenu: [
        { name: 'Receipt Report', path: '/reports/receipts', icon: null },
        { name: 'Expense Report', path: '/reports/expenses', icon: null },
        { name: 'Account Report', path: '/reports/accounts', icon: null },
      ],
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const isExpanded = expandedMenus.includes(item.name);
    const hasSubmenu = item.submenu && item.submenu.length > 0;

    if (hasSubmenu) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors rounded-lg"
          >
            <div className="flex items-center space-x-3">
              {item.icon}
              <span className="font-medium">{item.name}</span>
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.submenu?.map(subItem => (
                <NavLink
                  key={subItem.path}
                  to={subItem.path!}
                  className={({ isActive }) =>
                    `block px-4 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'bg-red-600 text-white font-semibold'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  {subItem.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path!}
        className={({ isActive }) =>
          `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive
              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold shadow-lg'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`
        }
      >
        {item.icon}
        <span className="font-medium">{item.name}</span>
      </NavLink>
    );
  };

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-gradient-to-b from-gray-900 to-gray-800 border-r-2 border-red-600 overflow-y-auto z-40">
      <nav className="p-4 space-y-2">
        {menuItems.map(item => renderMenuItem(item))}
      </nav>
    </aside>
  );
};

export default Sidebar;

