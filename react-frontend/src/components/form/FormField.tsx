import React from 'react';
import SearchableSelect from './SearchableSelect';
import './FormField.css';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'time' | 'select' | 'textarea';
  value: string | number;
  onChange: (value: any) => void;
  options?: { value: string | number; label: string }[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  icon?: string;
  error?: string;
  helpText?: string;
  rows?: number;
  min?: string | number;
  max?: string | number;
  searchable?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  options = [],
  required = false,
  disabled = false,
  placeholder,
  icon,
  error,
  helpText,
  rows = 3,
  min,
  max,
  searchable = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    onChange(newValue);
  };

  const renderInput = () => {
    const commonProps = {
      id: name,
      name,
      value,
      onChange: handleChange,
      required,
      disabled,
      placeholder: placeholder || label,
      className: `form-field-input ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`
    };

    switch (type) {
      case 'select':
        if (searchable) {
          return (
            <SearchableSelect
              options={options}
              value={value}
              onChange={onChange}
              placeholder={placeholder || `Select ${label}`}
              disabled={disabled}
              required={required}
            />
          );
        }
        return (
          <select {...commonProps}>
            <option value="">Select {label}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      
      case 'textarea':
        return (
          <textarea {...commonProps} rows={rows} />
        );
      
      default:
        return (
          <input {...commonProps} type={type} min={min} max={max} />
        );
    }
  };

  return (
    <div className={`form-field-wrapper ${disabled ? 'disabled' : ''}`}>
      <label htmlFor={name} className="form-field-label">
        {icon && <i className={`${icon} me-2`}></i>}
        {label}
        {required && <span className="required-indicator">*</span>}
      </label>
      
      <div className="form-field-input-wrapper">
        {renderInput()}
        {error && (
          <div className="form-field-error">
            <i className="fa fa-exclamation-circle me-1"></i>
            {error}
          </div>
        )}
        {helpText && !error && (
          <div className="form-field-help">
            <i className="fa fa-info-circle me-1"></i>
            {helpText}
          </div>
        )}
      </div>
    </div>
  );
};

export default FormField;

