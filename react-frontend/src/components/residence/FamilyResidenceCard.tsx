import type { Residence } from '../../types/residence';
import './ResidenceCard.css';

interface FamilyResidenceCardProps {
  residence: Residence;
  onPaymentHistory: (residence: Residence) => void;
  onPayTotal: (residence: Residence) => void;
  onAttachments: (residence: Residence) => void;
}

export default function FamilyResidenceCard({ 
  residence, 
  onPaymentHistory, 
  onPayTotal,
  onAttachments
}: FamilyResidenceCardProps) {
  // Calculate financial summary
  const salePrice = parseFloat(residence.sale_price as any) || 0;
  const totalPaid = parseFloat((residence as any).paid_amount as any) || 0;
  const totalRemaining = salePrice - totalPaid;

  // Get status badge
  const getStatusBadge = () => {
    if (totalPaid >= salePrice) {
      return { class: 'bg-success', text: 'Paid' };
    } else {
      return { class: 'bg-danger', text: 'Outstanding' };
    }
  };

  const status = getStatusBadge();
  const hasOutstanding = totalRemaining > 0;

  return (
    <div className="card mb-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
      <div className="card-body">
        {/* Header Row */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h4 className="text-white mb-1">
              <strong>{residence.passenger_name || 'N/A'}</strong>
            </h4>
            <p className="text-gray-400 mb-0" style={{ fontSize: '0.875rem' }}>
              Family Residence ID: #{residence.residenceID}
            </p>
            {(residence as any).main_residence_id || (residence as any).main_residence_residenceID ? (
              <div className="mt-2">
                <span className="badge bg-info px-2 py-1" style={{ fontSize: '0.75rem' }}>
                  <i className="fa fa-link me-1"></i>
                  Main Residence: #{(residence as any).main_residence_residenceID || (residence as any).main_residence_id}
                  {(residence as any).main_passenger && (
                    <span className="ms-2">({(residence as any).main_passenger})</span>
                  )}
                </span>
              </div>
            ) : null}
          </div>
          <span className={`badge ${status.class} px-3 py-2`} style={{ fontSize: '0.875rem' }}>
            {status.text}
          </span>
        </div>

        {/* Details Grid */}
        <div className="row mb-3">
          <div className="col-md-6 mb-2">
            <div className="text-gray-400" style={{ fontSize: '0.875rem' }}>Customer</div>
            <div className="text-white">{residence.customer_name || 'N/A'}</div>
          </div>
          <div className="col-md-6 mb-2">
            <div className="text-gray-400" style={{ fontSize: '0.875rem' }}>Passport Number</div>
            <div className="text-white">{(residence as any).passportNumber || residence.passportNumber || 'N/A'}</div>
          </div>
          {(residence as any).main_residence_id || (residence as any).main_residence_residenceID ? (
            <div className="col-md-6 mb-2">
              <div className="text-gray-400" style={{ fontSize: '0.875rem' }}>
                <i className="fa fa-link me-1"></i>Main Residence
              </div>
              <div className="text-white">
                <strong>ID: #{(residence as any).main_residence_residenceID || (residence as any).main_residence_id}</strong>
                {(residence as any).main_passenger && (
                  <div className="text-info" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                    {(residence as any).main_passenger}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div className="col-md-6 mb-2">
            <div className="text-gray-400" style={{ fontSize: '0.875rem' }}>Nationality</div>
            <div className="text-white">{(residence as any).countryName || (residence as any).nationality_name || 'N/A'}</div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="card mb-3" style={{ backgroundColor: '#343a40', border: '1px solid #495057' }}>
          <div className="card-body p-3">
            <h6 className="text-white mb-3" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
              <i className="fa fa-money-bill-wave me-2"></i>
              Financial Summary
            </h6>
            <div className="row">
              <div className="col-md-4 mb-2">
                <div className="text-gray-400" style={{ fontSize: '0.8rem' }}>Sale Price</div>
                <div className="text-white" style={{ fontSize: '1rem', fontWeight: '600' }}>
                  AED {salePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="col-md-4 mb-2">
                <div className="text-gray-400" style={{ fontSize: '0.8rem' }}>Paid Amount</div>
                <div className="text-success" style={{ fontSize: '1rem', fontWeight: '600' }}>
                  AED {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="col-md-4 mb-2">
                <div className="text-gray-400" style={{ fontSize: '0.8rem' }}>Outstanding</div>
                <div className={`${hasOutstanding ? 'text-danger' : 'text-success'}`} style={{ fontSize: '1rem', fontWeight: '600' }}>
                  AED {totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            {salePrice > 0 && (
              <div className="mt-2">
                <div className="text-gray-400 mb-1" style={{ fontSize: '0.75rem' }}>
                  Payment Progress
                </div>
                <div className="progress" style={{ height: '8px', backgroundColor: '#495057' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{
                      width: `${Math.min(100, (totalPaid / salePrice) * 100)}%`
                    }}
                  ></div>
                </div>
                <div className="text-gray-400 mt-1" style={{ fontSize: '0.75rem' }}>
                  {Math.round((totalPaid / salePrice) * 100)}% Paid
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons - Payment History, Pay Total, and Attachments */}
        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-info btn-sm"
            onClick={() => onPaymentHistory(residence)}
            style={{ minWidth: '140px' }}
          >
            <i className="fa fa-history me-2"></i>
            Payment History
          </button>
          {hasOutstanding && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => onPayTotal(residence)}
              style={{ minWidth: '140px' }}
            >
              <i className="fa fa-credit-card me-2"></i>
              Pay Total Outstanding
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onAttachments(residence)}
            style={{ minWidth: '140px' }}
          >
            <i className="fa fa-paperclip me-2"></i>
            Attachments
          </button>
        </div>
      </div>
    </div>
  );
}

