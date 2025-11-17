import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../services/residenceService';
import type { Residence } from '../../types/residence';
import '../modals/Modal.css';

interface DependentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  residence: Residence | null;
}

export default function DependentsModal({ isOpen, onClose, residence }: DependentsModalProps) {
  const [dependents, setDependents] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      loadDependents();
    }
  }, [isOpen, residence]);

  const loadDependents = async () => {
    if (!residence) return;
    
    setLoading(true);
    try {
      const data = await residenceService.getDependentsByResidence(residence.residenceID);
      setDependents(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading dependents:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load dependents', 'error');
      setDependents([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
        <div className="modal-header">
          <h3>
            <i className="fa fa-users me-2"></i>
            Dependents - Residence #{residence.residenceID}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-5">
              <i className="fa fa-spinner fa-spin fa-2x text-primary"></i>
              <p className="mt-2 text-muted">Loading dependents...</p>
            </div>
          ) : dependents.length === 0 ? (
            <div className="alert alert-info text-center">
              <i className="fa fa-info-circle me-2"></i>
              No dependents found for this residence
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Passenger Name</th>
                    <th>Passport Number</th>
                    <th>Nationality</th>
                    <th>Sale Price</th>
                    <th>Paid Amount</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dependents.map((dependent) => {
                    const salePrice = parseFloat(dependent.sale_price as any) || 0;
                    const paidAmount = parseFloat((dependent as any).paid_amount as any) || 0;
                    const outstanding = salePrice - paidAmount;
                    const isPaid = paidAmount >= salePrice;
                    
                    return (
                      <tr key={dependent.residenceID || (dependent as any).familyResidenceID}>
                        <td>#{(dependent as any).familyResidenceID || dependent.residenceID}</td>
                        <td>
                          <strong>{dependent.passenger_name || 'N/A'}</strong>
                        </td>
                        <td>{(dependent as any).passportNumber || dependent.passportNumber || 'N/A'}</td>
                        <td>{(dependent as any).countryName || (dependent as any).nationality_name || 'N/A'}</td>
                        <td>
                          <strong>AED {salePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </td>
                        <td className="text-success">
                          AED {paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={outstanding > 0 ? 'text-danger' : 'text-success'}>
                          <strong>AED {outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </td>
                        <td>
                          <span className={`badge ${isPaid ? 'bg-success' : 'bg-danger'}`}>
                            {isPaid ? 'Paid' : 'Outstanding'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

