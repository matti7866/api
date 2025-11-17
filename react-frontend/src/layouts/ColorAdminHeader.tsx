import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useState, useEffect } from 'react';
import { config } from '../utils/config';

export default function ColorAdminHeader() {
  const { user, logout } = useAuth();
  const { toggleAppSidebarMobile, appHeaderInverse, appSidebarNone } = useAppSettings();
  const [currentTime, setCurrentTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Digital Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Search:', searchQuery);
    // Implement search functionality
  };

  return (
    <div id="header" className={'app-header ' + (appHeaderInverse ? 'app-header-inverse' : '')}>
      <div className="navbar-header">
        <img src="/assets/logo-white.png" className="app-header-logo ms-2" alt="Logo" />
        
        {!appSidebarNone && (
          <button 
            type="button" 
            className="navbar-mobile-toggler" 
            onClick={toggleAppSidebarMobile}
          >
            <span className="icon-bar"></span>
            <span className="icon-bar"></span>
            <span className="icon-bar"></span>
          </button>
        )}
      </div>
      
      <div className="navbar-nav">
        {/* Digital Clock */}
        <div className="navbar-item">
          <div style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px', // Reduced from 18px
            color: '#fff',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '4px 12px', // Reduced from 5px 15px
            borderRadius: '20px',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
            position: 'relative',
            zIndex: 1
          }}>
            <span id="digital-clock">{currentTime}</span>
          </div>
        </div>

        {/* Staff Attendance Status - Desktop */}
        <div className="navbar-item d-none d-md-block">
          <div style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px', // Added smaller font size
            color: '#fff',
            padding: '4px 12px', // Reduced from 5px 15px
            position: 'relative',
            zIndex: 1
          }}>
            <span className="badge bg-secondary me-1" style={{ fontSize: '10px' }}>Absent</span>
            <span style={{ fontSize: '11px' }}>Check-in: <strong>--:--</strong></span>
            <span className="mx-1">|</span>
            <span style={{ fontSize: '11px' }}>Check-out: <strong>--:--</strong></span>
            <span className="mx-1">|</span>
            <span style={{ fontSize: '11px' }}>Break: <strong>--</strong></span>
            <small className="ms-1 text-muted" style={{ fontSize: '10px' }}>(Dubai Time)</small>
          </div>
        </div>

        {/* Search Form */}
        <div className="navbar-item navbar-form">
          <form onSubmit={handleSearch}>
            <div className="form-group">
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-search">
                <i className="fa fa-search"></i>
              </button>
            </div>
          </form>
        </div>

        {/* Chat Icon */}
        <div className="navbar-item">
          <Link to="/chatroom" className="navbar-link" title="Chatroom">
            <i className="fa fa-comments"></i>
          </Link>
        </div>

        {/* Attachments Icon */}
        <div className="navbar-item">
          <Link to="/attachments" className="navbar-link" title="File Attachments">
            <i className="fa fa-paperclip"></i>
          </Link>
        </div>

        {/* Notes Icon */}
        <div className="navbar-item">
          <Link to="/notes" className="navbar-link" title="Notes">
            <i className="fa fa-sticky-note"></i>
          </Link>
        </div>

        {/* Notifications Dropdown */}
        <div className="navbar-item dropdown">
          <a 
            href="#" 
            data-bs-toggle="dropdown" 
            className="navbar-link dropdown-toggle icon"
            style={{ position: 'relative', zIndex: 10 }}
          >
            <i className="fa fa-bell"></i>
            <span className="badge">5</span>
          </a>
          <div className="dropdown-menu media-list dropdown-menu-end">
            <div className="dropdown-header">NOTIFICATIONS (5)</div>
            <a href="#" className="dropdown-item media">
              <div className="media-left">
                <i className="fa fa-plus media-object bg-gray-500"></i>
              </div>
              <div className="media-body">
                <h6 className="media-heading">New User Registered</h6>
                <div className="text-muted fs-10px">1 hour ago</div>
              </div>
            </a>
            <a href="#" className="dropdown-item media">
              <div className="media-left">
                <i className="fa fa-envelope media-object bg-gray-500"></i>
              </div>
              <div className="media-body">
                <h6 className="media-heading">New Email</h6>
                <div className="text-muted fs-10px">2 hour ago</div>
              </div>
            </a>
            <div className="dropdown-footer text-center">
              <Link to="/notifications" className="text-decoration-none">View more</Link>
            </div>
          </div>
        </div>

        {/* User Profile Dropdown */}
        <div className="navbar-item navbar-user dropdown">
          <a 
            href="#" 
            className="navbar-link dropdown-toggle d-flex align-items-center" 
            data-bs-toggle="dropdown"
            style={{ position: 'relative', zIndex: 10 }}
          >
            {user?.staff_pic ? (
              <img 
                src={user.staff_pic.startsWith('http') ? user.staff_pic : `${config.baseUrl}/${user.staff_pic}`}
                alt={user?.staff_name || 'User'} 
                style={{ width: '28px', height: '28px', objectFit: 'cover', marginRight: '8px', borderRadius: '50%' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="image image-icon bg-gray-800 text-gray-600">
                <i className="fa fa-user"></i>
              </div>
            )}
            <span>
              <span className="d-none d-md-inline">{user?.staff_name || 'User'}</span>
              <b className="caret"></b>
            </span>
          </a>
          <div className="dropdown-menu dropdown-menu-end me-1">
            <div className="dropdown-header">
              <div className="d-flex align-items-center">
                {user?.staff_pic ? (
                  <img 
                    src={user.staff_pic.startsWith('http') ? user.staff_pic : `${config.baseUrl}/${user.staff_pic}`}
                    alt={user?.staff_name || 'User'} 
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="image image-icon bg-gray-800 text-gray-600">
                    <i className="fa fa-user"></i>
                  </div>
                )}
                <div className="ms-2">
                  <div className="fw-bold">{user?.staff_name || 'User'}</div>
                  <div className="text-gray-600 small">{user?.staff_email}</div>
                </div>
              </div>
            </div>
            <div className="dropdown-divider"></div>
            <Link to="/profile" className="dropdown-item">
              <i className="fa fa-user fa-fw me-2"></i> Profile
            </Link>
            <Link to="/days-calculator" className="dropdown-item">
              <i className="fa fa-calculator fa-fw me-2"></i> Days Calculator
            </Link>
            <Link to="/change-password" className="dropdown-item">
              <i className="fa fa-key fa-fw me-2"></i> Change Password
            </Link>
            <div className="dropdown-divider"></div>
            <button onClick={handleLogout} className="dropdown-item">
              <i className="fa fa-sign-out-alt fa-fw me-2"></i> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
