import React from 'react';
import './FormSection.css';

interface FormSectionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = false
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className="form-section">
      <div 
        className={`form-section-header ${collapsible ? 'collapsible' : ''}`}
        onClick={toggleCollapse}
      >
        <div className="form-section-title">
          {icon && <i className={`${icon} me-2`}></i>}
          {title}
        </div>
        {collapsible && (
          <i className={`fa fa-chevron-${isCollapsed ? 'down' : 'up'} collapse-icon`}></i>
        )}
      </div>
      
      {!isCollapsed && (
        <div className="form-section-body">
          {children}
        </div>
      )}
    </div>
  );
};

export default FormSection;














