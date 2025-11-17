import { Link, useLocation } from 'react-router-dom';
import { config } from '../utils/config';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { useAppSettings } from '../context/AppSettingsContext';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

interface MenuItem {
  path?: string;
  icon?: string;
  title: string;
  badge?: string;
  children?: MenuItem[];
  isHeader?: boolean;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { title: 'Navigation', isHeader: true },
  {
    icon: 'fa fa-th-large',
    title: 'Dashboard',
    children: [
      { path: '/dashboard', title: 'Main Dashboard' },
      { path: '/dashboard/analytics', title: 'Analytics Dashboard', adminOnly: true }
    ]
  },
  {
    icon: 'fa fa-plane',
    title: 'Ticket',
    children: [
      { path: '/ticket/new', title: 'New Ticket' },
      { path: '/ticket/report', title: 'Ticket Report' }
    ]
  },
  {
    icon: 'fa fa-ticket',
    title: 'Visa',
    children: [
      { path: '/visa/new', title: 'New Visa' },
      { path: '/residence', title: 'Residence' },
      { path: '/residence/tasks', title: 'Residence Tasks' },
      { path: '/residence/family', title: 'Family Residence Tasks' },
      { path: '/residence/report', title: 'Residence Report' },
      { path: '/visa/report', title: 'Visa Report' },
      { path: '/visa/pending', title: 'Pending Visa' },
      { path: '/visa/supplier-prices', title: 'Supplier Visa Prices' },
      { path: '/visa/customer-prices', title: 'Customer Visa Prices' },
      { path: '/establishments/manage', title: 'Manage Establishments' }
    ]
  },
  {
    icon: 'fa fa-spinner',
    title: 'Visa Tasks',
    children: [
      { path: '/visa-tasks/mainland', title: 'Mainland' },
      { path: '/visa-tasks/freezone', title: 'Free Zone' },
      { path: '/visa-tasks/emirates-id', title: 'Emirates ID' },
      { path: '/visa-tasks/dashboard', title: 'Visa Dashboard' }
    ]
  },
  {
    icon: 'fa fa-bank',
    title: 'Amer',
    children: [
      { path: '/amer/transactions', title: 'Transactions' }
    ]
  },
  {
    icon: 'fa fa-simplybuilt',
    title: 'Loan',
    children: [
      { path: '/loan/new', title: 'New Loan' },
      { path: '/loan/view', title: 'View Loan' }
    ]
  },
  {
    icon: 'fa fa-hotel',
    title: 'Hotel',
    children: [
      { path: '/hotel/new', title: 'New Booking' },
      { path: '/hotel/view', title: 'View Bookings' }
    ]
  },
  {
    icon: 'fa fa-car',
    title: 'Rental Car',
    children: [
      { path: '/car-rental/new', title: 'New Booking' },
      { path: '/car-rental/view', title: 'View Bookings' }
    ]
  },
  {
    path: '/service',
    icon: 'fab fa-servicestack',
    title: 'Service'
  },
  {
    path: '/supplier',
    icon: 'fa fa-truck',
    title: 'Supplier'
  },
  {
    icon: 'fa fa-dollar',
    title: 'Expenses',
    children: [
      { path: '/expenses', title: 'Expense Management' }
    ]
  },
  {
    icon: 'fa fa-dollar',
    title: 'Make Payment',
    children: [
      { path: '/payment/supplier', title: 'Supplier' },
      { path: '/payment/customer', title: 'Customer' }
    ]
  },
  {
    icon: 'fa fa-user',
    title: 'Customers',
    children: [
      { path: '/customers', title: 'Customer Report' },
      { path: '/agents', title: 'Manage Agents' }
    ]
  },
  {
    icon: 'fa fa-dollar',
    title: 'Ledgers',
    children: [
      { path: '/ledger/customer', title: 'Customer' },
      { path: '/ledger/supplier', title: 'Supplier' },
      { path: '/ledger/affiliate', title: 'Affiliate Business' }
    ]
  },
  {
    icon: 'fa fa-user',
    title: 'Manage User',
    children: [
      { path: '/staff', title: 'Employee' },
      { path: '/role', title: 'Role' },
      { path: '/permission', title: 'Permission' }
    ]
  },
  {
    path: '/cheques',
    icon: 'fa fa-bank',
    title: 'Cheques'
  },
  {
    path: '/tasheel',
    icon: 'fa fa-bank',
    title: 'TASHEEL'
  },
  {
    icon: 'fa fa-user',
    title: 'Manage Accounts',
    children: [
      { path: '/accounts', title: 'Accounts' },
      { path: '/accounts/deposits', title: 'Deposits' },
      { path: '/accounts/withdrawals', title: 'Withdrawals' },
      { path: '/accounts/transfers', title: 'Transfers' },
      { path: '/accounts/report', title: 'Accounts Report' }
    ]
  },
  {
    path: '/salary',
    icon: 'fa fa-dollar',
    title: 'Manage Salaries'
  },
  {
    icon: 'fa fa-hdd',
    title: 'Email',
    children: [
      { path: '/email/inbox', title: 'Inbox' },
      { path: '/email/compose', title: 'Compose' },
      { path: '/email/sent', title: 'Sent' }
    ]
  },
  {
    icon: 'fa fa-file-text',
    title: 'Reports',
    children: [
      { path: '/reports/residence-ledger', title: 'Residence Ledger' }
    ]
  },
  {
    path: '/company-documents',
    icon: 'fa fa-files-o',
    title: 'Company Documents'
  },
  {
    path: '/reminder',
    icon: 'fa fa-clock',
    title: 'Set Reminder'
  },
  {
    path: '/currency',
    icon: 'fa fa-money',
    title: 'Currency'
  },
  {
    path: '/delete-requests',
    icon: 'fa fa-trash',
    title: 'Delete Requests',
    adminOnly: true
  },
  {
    path: '/settings',
    icon: 'fa fa-gears',
    title: 'Settings',
    adminOnly: true
  }
];

export default function ColorAdminSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { 
    appSidebarMinify, 
    appSidebarLight, 
    appSidebarTransparent,
    toggleAppSidebarMinify 
  } = useAppSettings();

  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({});

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    // Skip admin-only items if user is not admin
    if (item.adminOnly && user?.staff_id !== 1) {
      return null;
    }

    // Render header
    if (item.isHeader) {
      return (
        <div key={index} className="menu-header">
          {item.title}
        </div>
      );
    }

    const active = item.path ? isActive(item.path) : false;
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openSubmenus[item.title] || false;

    if (hasChildren) {
      return (
        <div key={index} className={'menu-item has-sub ' + (active || isOpen ? 'active' : '')}>
          <a 
            href="#" 
            className="menu-link"
            onClick={(e) => {
              e.preventDefault();
              toggleSubmenu(item.title);
            }}
          >
            {item.icon && <div className="menu-icon"><i className={item.icon}></i></div>}
            <div className="menu-text">
              {item.title}
              {item.badge && <span className="menu-badge">{item.badge}</span>}
            </div>
            <div className="menu-caret"></div>
          </a>
          <div className={'menu-submenu ' + (isOpen ? 'd-block' : '')}>
            {item.children.map((child, childIndex) => {
              // Skip admin-only sub-items
              if (child.adminOnly && user?.staff_id !== 1) {
                return null;
              }
              
              const childActive = child.path && isActive(child.path);
              return (
                <div key={childIndex} className={'menu-item ' + (childActive ? 'active' : '')}>
                  {child.path ? (
                    <Link to={child.path} className="menu-link">
                      <div className="menu-text">{child.title}</div>
                    </Link>
                  ) : (
                    <a href="#" className="menu-link">
                      <div className="menu-text">{child.title}</div>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div key={index} className={'menu-item ' + (active ? 'active' : '')}>
        {item.path ? (
          <Link to={item.path} className="menu-link">
            {item.icon && <div className="menu-icon"><i className={item.icon}></i></div>}
            <div className="menu-text">
              {item.title}
              {item.badge && <span className="menu-badge">{item.badge}</span>}
            </div>
          </Link>
        ) : (
          <a href="#" className="menu-link">
            {item.icon && <div className="menu-icon"><i className={item.icon}></i></div>}
            <div className="menu-text">
              {item.title}
              {item.badge && <span className="menu-badge">{item.badge}</span>}
            </div>
          </a>
        )}
      </div>
    );
  };

  return (
    <div 
      id="sidebar" 
      className={
        'app-sidebar ' +
        (appSidebarLight ? 'app-sidebar-light ' : '') +
        (appSidebarTransparent ? 'app-sidebar-transparent' : '')
      }
    >
      <PerfectScrollbar className="app-sidebar-content" options={{ suppressScrollX: true }}>
        <div className="menu">
          <div className="menu-profile">
            <div className="menu-profile-cover with-shadow"></div>
            <div className="menu-profile-image">
              {user?.staff_pic ? (
                <img 
                  src={user.staff_pic.startsWith('http') ? user.staff_pic : `${config.baseUrl}/${user.staff_pic}`}
                  alt={user?.staff_name || 'User'} 
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="image image-icon bg-gray-900 text-white"><i class="fa fa-user"></i></div>';
                  }}
                />
              ) : (
                <div className="image image-icon bg-gray-900 text-white">
                  <i className="fa fa-user"></i>
                </div>
              )}
            </div>
            <div className="menu-profile-info">
              <div className="d-flex align-items-center">
                <div className="flex-grow-1">
                  {user?.staff_name || 'User'}
                </div>
                <div className="menu-caret ms-auto"></div>
              </div>
              <small>{user?.role_name || 'Staff'}</small>
            </div>
          </div>
          
          {menuItems.map((item, index) => renderMenuItem(item, index))}
          
          <div className="menu-item d-flex">
            <a 
              href="#" 
              className="app-sidebar-minify-btn ms-auto" 
              onClick={toggleAppSidebarMinify}
            >
              <i className="fa fa-angle-double-left"></i>
            </a>
          </div>
        </div>
      </PerfectScrollbar>
    </div>
  );
}
