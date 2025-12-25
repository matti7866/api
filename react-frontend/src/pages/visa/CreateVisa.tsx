import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import visaService from '../../services/visaService';
import Swal from 'sweetalert2';
import { FormSection, FormField } from '../../components/form';
import type { VisaDropdowns } from '../../types/visa';
import '../ticket/CreateTicket.css';

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function CreateVisa() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Dropdown data
  const [dropdowns, setDropdowns] = useState<VisaDropdowns>({
    customers: [],
    suppliers: [],
    countries: [],
    nationalities: [],
    currencies: [],
    accounts: []
  });
  
  // Form data
  const [formData, setFormData] = useState({
    customer_id: 0,
    passenger_name: '',
    PassportNum: '',
    nationalityID: 0,
    address: '',
    gaurantee: '',
    country_id: 0,
    supp_id: 0,
    net_price: 0,
    netCurrencyID: 1,
    sale: 0,
    saleCurrencyID: 1,
    pendingvisa: 1
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadDropdowns();
  }, []);

  const loadDropdowns = async () => {
    try {
      const data = await visaService.getDropdowns();
      setDropdowns(data);
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
      Swal.fire('Error', 'Failed to load form data', 'error');
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customer_id) {
      Swal.fire('Error', 'Please select a customer', 'error');
      return;
    }
    if (!formData.passenger_name) {
      Swal.fire('Error', 'Please enter passenger name', 'error');
      return;
    }
    if (!formData.country_id) {
      Swal.fire('Error', 'Please select a country/visa type', 'error');
      return;
    }
    if (!formData.supp_id) {
      Swal.fire('Error', 'Please select a supplier', 'error');
      return;
    }
    if (!formData.nationalityID) {
      Swal.fire('Error', 'Please select nationality', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const formDataToSend = new FormData();
      
      // Append all form data
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, String(formData[key as keyof typeof formData]));
      });
      
      // Append file if selected
      if (selectedFile) {
        formDataToSend.append('visaCopy', selectedFile);
      }
      
      await visaService.createVisa(formDataToSend);
      
      Swal.fire('Success!', 'Visa created successfully', 'success');
      navigate('/visa/report');
    } catch (error: any) {
      console.error('Failed to create visa:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to create visa', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row mb-3">
        <div className="col-md-12">
          <h3><i className="fa fa-cc-visa"></i> Create New Visa</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <FormSection title="Customer Information" icon="fa fa-user">
          <div className="row g-3">
            <div className="col-md-4">
              <FormField
                label="Customer"
                name="customer_id"
                type="select"
                value={formData.customer_id}
                onChange={(value) => handleChange('customer_id', parseInt(value))}
                options={[
                  { value: 0, label: 'Select Customer' },
                  ...dropdowns.customers.map(c => ({
                    value: c.customer_id,
                    label: `${c.customer_name} - ${c.customer_phone}`
                  }))
                ]}
                required
                searchable
                icon="fa fa-user"
              />
            </div>
            <div className="col-md-4">
              <FormField
                label="Nationality"
                name="nationalityID"
                type="select"
                value={formData.nationalityID}
                onChange={(value) => handleChange('nationalityID', parseInt(value))}
                options={[
                  { value: 0, label: 'Select Nationality' },
                  ...dropdowns.nationalities.map(n => ({
                    value: n.nationalityID,
                    label: n.nationality
                  }))
                ]}
                required
                searchable
                icon="fa fa-flag"
              />
            </div>
            <div className="col-md-4">
              <FormField
                label="Address"
                name="address"
                value={formData.address}
                onChange={(value) => handleChange('address', value)}
                placeholder="Enter address"
                required
                icon="fa fa-map-marker"
              />
            </div>
          </div>
          <div className="row g-3 mt-2">
            <div className="col-md-12">
              <FormField
                label="Guarantee Person"
                name="gaurantee"
                value={formData.gaurantee}
                onChange={(value) => handleChange('gaurantee', value)}
                placeholder="Enter guarantee person name"
                required
                icon="fa fa-user-shield"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Visa Details" icon="fa fa-cc-visa">
          <div className="row g-3">
            <div className="col-md-6">
              <FormField
                label="Country & Visa Type"
                name="country_id"
                type="select"
                value={formData.country_id}
                onChange={(value) => handleChange('country_id', parseInt(value))}
                options={[
                  { value: 0, label: 'Select Country' },
                  ...dropdowns.countries.map(c => ({
                    value: c.country_id,
                    label: c.country_names
                  }))
                ]}
                required
                searchable
                icon="fa fa-flag"
              />
            </div>
            <div className="col-md-6">
              <FormField
                label="Supplier"
                name="supp_id"
                type="select"
                value={formData.supp_id}
                onChange={(value) => handleChange('supp_id', parseInt(value))}
                options={[
                  { value: 0, label: 'Select Supplier' },
                  ...dropdowns.suppliers.map(s => ({
                    value: s.supp_id,
                    label: s.supp_name
                  }))
                ]}
                required
                searchable
                icon="fa fa-building"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Passenger Details" icon="fa fa-users">
          <div className="row g-3">
            <div className="col-md-6">
              <FormField
                label="Passenger Name"
                name="passenger_name"
                value={formData.passenger_name}
                onChange={(value) => handleChange('passenger_name', value)}
                placeholder="Enter passenger name"
                required
                icon="fa fa-user"
              />
            </div>
            <div className="col-md-6">
              <FormField
                label="Passport Number"
                name="PassportNum"
                value={formData.PassportNum}
                onChange={(value) => handleChange('PassportNum', value)}
                placeholder="Enter passport number"
                icon="fa fa-passport"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Pricing Information" icon="fa fa-dollar-sign">
          <div className="row g-3">
            <div className="col-md-3">
              <FormField
                label="Net Price"
                name="net_price"
                type="number"
                value={formData.net_price}
                onChange={(value) => handleChange('net_price', parseFloat(value))}
                placeholder="0.00"
                required
                icon="fa fa-dollar-sign"
              />
            </div>
            <div className="col-md-3">
              <FormField
                label="Net Currency"
                name="netCurrencyID"
                type="select"
                value={formData.netCurrencyID}
                onChange={(value) => handleChange('netCurrencyID', parseInt(value))}
                options={dropdowns.currencies.map(c => ({
                  value: c.currencyID,
                  label: c.currencyName
                }))}
                required
                icon="fa fa-coins"
              />
            </div>
            <div className="col-md-3">
              <FormField
                label="Sale Price"
                name="sale"
                type="number"
                value={formData.sale}
                onChange={(value) => handleChange('sale', parseFloat(value))}
                placeholder="0.00"
                required
                icon="fa fa-dollar-sign"
              />
            </div>
            <div className="col-md-3">
              <FormField
                label="Sale Currency"
                name="saleCurrencyID"
                type="select"
                value={formData.saleCurrencyID}
                onChange={(value) => handleChange('saleCurrencyID', parseInt(value))}
                options={dropdowns.currencies.map(c => ({
                  value: c.currencyID,
                  label: c.currencyName
                }))}
                required
                icon="fa fa-coins"
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Upload Visa Copy" icon="fa fa-upload">
          <div className="row g-3">
            <div className="col-md-12">
              <label className="form-label">Visa Copy (Optional)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <small className="text-muted">Selected: {selectedFile.name}</small>
              )}
            </div>
          </div>
        </FormSection>

        <div className="row mt-4">
          <div className="col-md-12">
            <button
              type="submit"
              className="btn btn-danger me-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa fa-save me-2"></i>
                  Save Visa
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/visa/report')}
              disabled={loading}
            >
              <i className="fa fa-times me-2"></i>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}






