import { createContext, useContext, useState, type ReactNode } from 'react';

interface AppSettingsState {
  appHeaderNone: boolean;
  appHeaderInverse: boolean;
  appHeaderMegaMenu: boolean;
  appHeaderLanguageBar: boolean;
  hasScroll: boolean;
  
  appSidebarNone: boolean;
  appSidebarWide: boolean;
  appSidebarLight: boolean;
  appSidebarMinify: boolean;
  appSidebarMobileToggled: boolean;
  appSidebarTransparent: boolean;
  appSidebarSearch: boolean;
  
  appSidebarFloatSubMenuActive: boolean;
  appSidebarFloatSubMenu: any;
  appSidebarFloatSubMenuTop: string;
  appSidebarFloatSubMenuLeft: string;
  appSidebarFloatSubMenuBottom: string;
  appSidebarFloatSubMenuLineTop: string;
  appSidebarFloatSubMenuLineBottom: string;
  appSidebarFloatSubMenuArrowTop: string;
  appSidebarFloatSubMenuArrowBottom: string;
  appSidebarFloatSubMenuOffset: any;
  
  appContentNone: boolean;
  appContentClass: string;
  appContentFullHeight: boolean;
  
  appTopMenu: boolean;
  appTopMenuMobileToggled: boolean;
  
  appSidebarTwo: boolean;
  appSidebarEnd: boolean;
  appSidebarEndToggled: boolean;
  appSidebarEndMobileToggled: boolean;
  
  // Methods
  toggleAppSidebarMinify: (e: React.MouseEvent) => void;
  toggleAppSidebarMobile: (e: React.MouseEvent) => void;
  toggleAppSidebarEnd: (e: React.MouseEvent) => void;
  toggleAppSidebarEndMobile: (e: React.MouseEvent) => void;
  toggleAppTopMenuMobile: (e: React.MouseEvent) => void;
  
  handleSetAppHeaderNone: (value: boolean) => void;
  handleSetAppHeaderInverse: (value: boolean) => void;
  handleSetAppHeaderMegaMenu: (value: boolean) => void;
  handleSetAppHeaderLanguageBar: (value: boolean) => void;
  
  handleSetAppSidebarNone: (value: boolean) => void;
  handleSetAppSidebarWide: (value: boolean) => void;
  handleSetAppSidebarLight: (value: boolean) => void;
  handleSetAppSidebarMinified: (value: boolean) => void;
  handleSetAppSidebarTransparent: (value: boolean) => void;
  handleSetAppSidebarSearch: (value: boolean) => void;
  handleAppSidebarOnMouseOut: (e: React.MouseEvent) => void;
  handleAppSidebarOnMouseOver: (e: React.MouseEvent, menu: any) => void;
  
  handleAppSidebarFloatSubMenuOnMouseOver: (e: React.MouseEvent) => void;
  handleAppSidebarFloatSubMenuOnMouseOut: (e: React.MouseEvent) => void;
  handleAppSidebarFloatSubMenuClick: () => void;
  
  handleSetAppContentNone: (value: boolean) => void;
  handleSetAppContentClass: (value: string) => void;
  handleSetAppContentFullHeight: (value: boolean) => void;
  
  handleSetAppTopMenu: (value: boolean) => void;
  handleSetAppSidebarTwo: (value: boolean) => void;
  handleSetAppSidebarEnd: (value: boolean) => void;
  handleSetAppBoxedLayout: (value: boolean) => void;
}

const defaultState: AppSettingsState = {
  appHeaderNone: false,
  appHeaderInverse: true, // Set to true by default to match nav.php dark theme
  appHeaderMegaMenu: false,
  appHeaderLanguageBar: false,
  hasScroll: false,
  
  appSidebarNone: false,
  appSidebarWide: false,
  appSidebarLight: false,
  appSidebarMinify: false,
  appSidebarMobileToggled: false,
  appSidebarTransparent: false,
  appSidebarSearch: false,
  
  appSidebarFloatSubMenuActive: false,
  appSidebarFloatSubMenu: '',
  appSidebarFloatSubMenuTop: 'auto',
  appSidebarFloatSubMenuLeft: 'auto',
  appSidebarFloatSubMenuBottom: 'auto',
  appSidebarFloatSubMenuLineTop: 'auto',
  appSidebarFloatSubMenuLineBottom: 'auto',
  appSidebarFloatSubMenuArrowTop: 'auto',
  appSidebarFloatSubMenuArrowBottom: 'auto',
  appSidebarFloatSubMenuOffset: '',
  
  appContentNone: false,
  appContentClass: '',
  appContentFullHeight: false,
  
  appTopMenu: false,
  appTopMenuMobileToggled: false,
  
  appSidebarTwo: false,
  appSidebarEnd: false,
  appSidebarEndToggled: false,
  appSidebarEndMobileToggled: false,
  
  // Placeholder methods
  toggleAppSidebarMinify: () => {},
  toggleAppSidebarMobile: () => {},
  toggleAppSidebarEnd: () => {},
  toggleAppSidebarEndMobile: () => {},
  toggleAppTopMenuMobile: () => {},
  
  handleSetAppHeaderNone: () => {},
  handleSetAppHeaderInverse: () => {},
  handleSetAppHeaderMegaMenu: () => {},
  handleSetAppHeaderLanguageBar: () => {},
  
  handleSetAppSidebarNone: () => {},
  handleSetAppSidebarWide: () => {},
  handleSetAppSidebarLight: () => {},
  handleSetAppSidebarMinified: () => {},
  handleSetAppSidebarTransparent: () => {},
  handleSetAppSidebarSearch: () => {},
  handleAppSidebarOnMouseOut: () => {},
  handleAppSidebarOnMouseOver: () => {},
  
  handleAppSidebarFloatSubMenuOnMouseOver: () => {},
  handleAppSidebarFloatSubMenuOnMouseOut: () => {},
  handleAppSidebarFloatSubMenuClick: () => {},
  
  handleSetAppContentNone: () => {},
  handleSetAppContentClass: () => {},
  handleSetAppContentFullHeight: () => {},
  
  handleSetAppTopMenu: () => {},
  handleSetAppSidebarTwo: () => {},
  handleSetAppSidebarEnd: () => {},
  handleSetAppBoxedLayout: () => {},
};

export const AppSettings = createContext<AppSettingsState>(defaultState);

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Omit<AppSettingsState, keyof typeof methods>>(defaultState);
  
  const toggleAppSidebarMinify = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, appSidebarMinify: !prev.appSidebarMinify }));
  };
  
  const toggleAppSidebarMobile = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, appSidebarMobileToggled: !prev.appSidebarMobileToggled }));
  };
  
  const toggleAppSidebarEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, appSidebarEndToggled: !prev.appSidebarEndToggled }));
  };
  
  const toggleAppSidebarEndMobile = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, appSidebarEndMobileToggled: !prev.appSidebarEndMobileToggled }));
  };
  
  const toggleAppTopMenuMobile = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, appTopMenuMobileToggled: !prev.appTopMenuMobileToggled }));
  };
  
  const methods = {
    toggleAppSidebarMinify,
    toggleAppSidebarMobile,
    toggleAppSidebarEnd,
    toggleAppSidebarEndMobile,
    toggleAppTopMenuMobile,
    
    handleSetAppHeaderNone: (value: boolean) => setState(prev => ({ ...prev, appHeaderNone: value })),
    handleSetAppHeaderInverse: (value: boolean) => setState(prev => ({ ...prev, appHeaderInverse: value })),
    handleSetAppHeaderMegaMenu: (value: boolean) => setState(prev => ({ ...prev, appHeaderMegaMenu: value })),
    handleSetAppHeaderLanguageBar: (value: boolean) => setState(prev => ({ ...prev, appHeaderLanguageBar: value })),
    
    handleSetAppSidebarNone: (value: boolean) => setState(prev => ({ ...prev, appSidebarNone: value })),
    handleSetAppSidebarWide: (value: boolean) => setState(prev => ({ ...prev, appSidebarWide: value })),
    handleSetAppSidebarLight: (value: boolean) => setState(prev => ({ ...prev, appSidebarLight: value })),
    handleSetAppSidebarMinified: (value: boolean) => setState(prev => ({ ...prev, appSidebarMinify: value })),
    handleSetAppSidebarTransparent: (value: boolean) => setState(prev => ({ ...prev, appSidebarTransparent: value })),
    handleSetAppSidebarSearch: (value: boolean) => setState(prev => ({ ...prev, appSidebarSearch: value })),
    handleAppSidebarOnMouseOut: () => {},
    handleAppSidebarOnMouseOver: () => {},
    
    handleAppSidebarFloatSubMenuOnMouseOver: () => {},
    handleAppSidebarFloatSubMenuOnMouseOut: () => {},
    handleAppSidebarFloatSubMenuClick: () => {},
    
    handleSetAppContentNone: (value: boolean) => setState(prev => ({ ...prev, appContentNone: value })),
    handleSetAppContentClass: (value: string) => setState(prev => ({ ...prev, appContentClass: value })),
    handleSetAppContentFullHeight: (value: boolean) => setState(prev => ({ ...prev, appContentFullHeight: value })),
    
    handleSetAppTopMenu: (value: boolean) => setState(prev => ({ ...prev, appTopMenu: value })),
    handleSetAppSidebarTwo: (value: boolean) => {
      setState(prev => ({ ...prev, appSidebarTwo: value, appSidebarEndToggled: value }));
    },
    handleSetAppSidebarEnd: (value: boolean) => setState(prev => ({ ...prev, appSidebarEnd: value })),
    handleSetAppBoxedLayout: (value: boolean) => {
      if (value) {
        document.body.classList.add('boxed-layout');
      } else {
        document.body.classList.remove('boxed-layout');
      }
    },
  };
  
  return (
    <AppSettings.Provider value={{ ...state, ...methods }}>
      {children}
    </AppSettings.Provider>
  );
};

export const useAppSettings = () => useContext(AppSettings);

