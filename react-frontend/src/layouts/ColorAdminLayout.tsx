import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext';
import ColorAdminHeader from './ColorAdminHeader';
import ColorAdminSidebar from './ColorAdminSidebar';

export default function ColorAdminLayout() {
  const {
    appHeaderNone,
    appSidebarNone,
    appSidebarMinify,
    appSidebarMobileToggled,
    appContentFullHeight,
    appContentClass,
    hasScroll
  } = useAppSettings();

  // Handle scroll detection
  useEffect(() => {
    const handleScroll = () => {
      // Scroll detection logic can be added here if needed
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={
        'app app-sidebar-fixed app-header-fixed ' +
        (appHeaderNone ? 'app-without-header ' : '') +
        (appSidebarNone ? 'app-without-sidebar ' : '') +
        (appSidebarMinify ? 'app-sidebar-minified ' : '') +
        (appSidebarMobileToggled ? 'app-sidebar-mobile-toggled ' : '') +
        (appContentFullHeight ? 'app-content-full-height ' : '') +
        (hasScroll ? 'has-scroll ' : '')
      }
    >
      {!appHeaderNone && <ColorAdminHeader />}
      {!appSidebarNone && <ColorAdminSidebar />}
      
      <div id="content" className={'app-content ' + appContentClass}>
        <Outlet />
      </div>
    </div>
  );
}














