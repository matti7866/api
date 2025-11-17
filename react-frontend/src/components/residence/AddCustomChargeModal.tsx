import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import residenceService from '../../services/residenceService';
import Swal from 'sweetalert2';
import '../modals/Modal.css';

interface CustomCharge {
  id: number;
  charge_title: string;
  net_cost: number;
  sale_price: number;
  profit: number;
  staff_name: string;
  created_at: string;
  remarks?: string;
}

interface AddCustomChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  residence: Residence | null;
  accounts: Array<{ accountID: number; accountName: string }>;
  onChargeAdded?: () => void; // Callback to refresh residence data
}

export default function AddCustomChargeModal({ isOpen, onClose, residence, accounts, onChargeAdded }: AddCustomChargeModalProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'view'>('add');
  const [chargeTitle, setChargeTitle] = useState('');
  const [netCost, setNetCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [accountID, setAccountID] = useState('');
  const [remarks, setRemarks] = useState('');
  const [charges, setCharges] = useState<CustomCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      if (activeTab === 'view') {
        loadCharges();
      }
    }
  }, [isOpen, residence, activeTab]);

  const calculateProfit = () => {
    const net = parseFloat(netCost) || 0;
    const sale = parseFloat(salePrice) || 0;
    return sale - net;
  };

  const loadCharges = async () => {
    if (!residence) return;
    setLoadingCharges(true);
    try {
      const data = await residenceService.getCustomCharges(residence.residenceID);
      setCharges(data.charges || []);
    } catch (error) {
      console.error('Failed to load charges:', error);
      setCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residence) return;

    if (!chargeTitle.trim()) {
      Swal.fire('Validation Error', 'Please enter a charge title', 'error');
      return;
    }

    if (!netCost || parseFloat(netCost) < 0) {
      Swal.fire('Validation Error', 'Please enter a valid net cost', 'error');
      return;
    }

    if (!salePrice || parseFloat(salePrice) < 0) {
      Swal.fire('Validation Error', 'Please enter a valid sale price', 'error');
      return;
    }

    if (!accountID) {
      Swal.fire('Validation Error', 'Please select an account', 'error');
      return;
    }

    setLoading(true);
    try {
      await residenceService.addCustomCharge({
        residenceID: residence.residenceID,
        chargeTitle,
        netCost: parseFloat(netCost),
        salePrice: parseFloat(salePrice),
        accountID: parseInt(accountID),
        remarks
      });
      
      Swal.fire('Success', 'Custom charge added successfully', 'success');
      
      // Reset form
      setChargeTitle('');
      setNetCost('');
      setSalePrice('');
      setAccountID('');
      setRemarks('');
      
      // Switch to view tab
      setActiveTab('view');
      loadCharges();
      
      // Notify parent to refresh residence data
      if (onChargeAdded) {
        onChargeAdded();
      }
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add custom charge', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (chargeId: number) => {
    const result = await Swal.fire({
      title: 'Delete Custom Charge?',
      text: 'Are you sure you want to delete this charge?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await residenceService.deleteCustomCharge(chargeId);
        Swal.fire('Success', 'Custom charge deleted successfully', 'success');
        loadCharges();
      } catch (error: any) {
        Swal.fire('Error', error.response?.data?.message || 'Failed to delete charge', 'error');
      }
    }
  };

  if (!isOpen || !residence) return null;

  const profit = calculateProfit();
  const totalCharges = charges.reduce((sum, charge) => sum + charge.sale_price, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-plus-circle"></i> Custom Charges Management</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs px-3 pt-2" role="tablist">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
              type="button"
            >
              <i className="fa fa-plus me-1"></i>Add New Charge
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'view' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('view');
                loadCharges();
              }}
              type="button"
            >
              <i className="fa fa-list me-1"></i>View Charges
            </button>
          </li>
        </ul>

        {activeTab === 'add' ? (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p className="mb-3">Adding charge for: <strong>{residence.passenger_name}</strong></p>

              <div className="alert alert-info mb-3">
                <i className="fa fa-info-circle me-2"></i>
                <strong>Custom Charges:</strong> Add any additional charges not covered by standard fees.
              </div>

              <div className="mb-3">
                <label className="form-label"><strong>Charge Title/Description <span className="text-danger">*</span></strong></label>
                <input
                  type="text"
                  className="form-control"
                  value={chargeTitle}
                  onChange={(e) => setChargeTitle(e.target.value)}
                  placeholder="e.g., Medical Test, Typing Fee, etc."
                  required
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label"><strong>Net Cost (Your Cost) <span className="text-danger">*</span></strong></label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      value={netCost}
                      onChange={(e) => setNetCost(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                    <span className="input-group-text">AED</span>
                  </div>
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label"><strong>Sale Price (Customer Pays) <span className="text-danger">*</span></strong></label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                    />
                    <span className="input-group-text">AED</span>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label"><strong>Profit Margin</strong></label>
                  <div className="input-group">
                    <input
                      type="text"
                      className={`form-control bg-light ${profit >= 0 ? 'text-success' : 'text-danger'}`}
                      value={profit.toFixed(2)}
                      readOnly
                    />
                    <span className="input-group-text">AED</span>
                  </div>
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label"><strong>Account <span className="text-danger">*</span></strong></label>
                  {!accounts || accounts.length === 0 ? (
                    <div className="alert alert-warning mb-0">
                      <i className="fa fa-exclamation-triangle me-2"></i>
                      No accounts available. Please refresh the page or contact administrator.
                    </div>
                  ) : (
                  <select
                    className="form-control"
                    value={accountID}
                    onChange={(e) => setAccountID(e.target.value)}
                    required
                  >
                    <option value="">Select Account</option>
                    {accounts.map(acc => (
                      <option key={acc.accountID} value={acc.accountID}>{acc.accountName}</option>
                    ))}
                  </select>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label"><strong>Remarks</strong></label>
                <textarea
                  className="form-control"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Optional notes about this charge"
                />
              </div>

              <div className="card bg-light">
                <div className="card-body">
                  <h6 className="card-title"><i className="fa fa-calculator me-2"></i>Summary</h6>
                  <div className="row">
                    <div className="col-6">
                      <strong>Net Cost:</strong> <span>{parseFloat(netCost || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</span>
                    </div>
                    <div className="col-6">
                      <strong>Sale Price:</strong> <span>{parseFloat(salePrice || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</span>
                    </div>
                  </div>
                  <div className="row mt-2">
                    <div className="col-12">
                      <strong>Profit:</strong> <span className={profit >= 0 ? 'text-success' : 'text-danger'}>{profit.toFixed(2)} AED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                <i className="fa fa-times"></i> Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fa fa-save me-2"></i>
                    Save Charge
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th width="5%">#</th>
                      <th width="25%">Charge Title</th>
                      <th width="15%">Net Cost</th>
                      <th width="15%">Sale Price</th>
                      <th width="15%">Profit</th>
                      <th width="15%">Added By</th>
                      <th width="10%" className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCharges ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Loading...
                        </td>
                      </tr>
                    ) : charges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-4">
                          <i className="fa fa-info-circle me-2"></i>No custom charges added yet
                        </td>
                      </tr>
                    ) : (
                      charges.map((charge, index) => (
                        <tr key={charge.id}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{charge.charge_title}</strong>
                            {charge.remarks && (
                              <>
                                <br />
                                <small className="text-muted">{charge.remarks}</small>
                              </>
                            )}
                          </td>
                          <td>{charge.net_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</td>
                          <td>{charge.sale_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</td>
                          <td className={charge.profit >= 0 ? 'text-success' : 'text-danger'}>
                            {charge.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                          </td>
                          <td>
                            {charge.staff_name}<br />
                            <small className="text-muted">{charge.created_at}</small>
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(charge.id)}
                              title="Delete Charge"
                            >
                              <i className="fa fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="alert alert-info mt-3">
                <strong>Total Custom Charges:</strong> <span>{totalCharges.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                <i className="fa fa-times"></i> Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

