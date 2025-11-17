import type { Residence } from '../../types/residence';
import './ResidenceCard.css';

interface ResidenceCardProps {
  residence: Residence;
  onContinue: (residence: Residence) => void;
  onAttachments: (residence: Residence) => void;
  onTawjeeh: (residence: Residence) => void;
  onILOE: (residence: Residence) => void;
  onPaymentHistory: (residence: Residence) => void;
  onLedger?: (residence: Residence) => void;
  onNOC: (residence: Residence) => void;
  onSalaryCertificate: (residence: Residence) => void;
  onPayTotal: (residence: Residence) => void;
  onCancellationFee?: (residence: Residence) => void;
  onCreditAdjustment?: (residence: Residence) => void;
  onAddFine?: (residence: Residence) => void;
  onViewFine?: (residence: Residence) => void;
  onAddCustomCharge?: (residence: Residence) => void;
  onGenerateInvoice?: (residence: Residence) => void;
  onPerformTawjeeh?: (residence: Residence) => void;
  onIssueInsurance?: (residence: Residence) => void;
  onDeleteResidence?: (residence: Residence) => void;
  onCancelResidence?: (residence: Residence) => void;
  onRenew?: (residence: Residence) => void;
  isAdmin?: boolean;
}

export default function ResidenceCard({ 
  residence, 
  onContinue, 
  onAttachments, 
  onTawjeeh, 
  onILOE, 
  onPaymentHistory, 
  onLedger,
  onNOC, 
  onSalaryCertificate, 
  onPayTotal, 
  onCancellationFee, 
  onCreditAdjustment,
  onAddFine,
  onViewFine,
  onAddCustomCharge,
  onGenerateInvoice,
  onPerformTawjeeh,
  onIssueInsurance,
  onDeleteResidence,
  onCancelResidence,
  onRenew,
  isAdmin = false
}: ResidenceCardProps) {
  // Calculate financial summary first - ensure all values are numbers
  const salePrice = parseFloat(residence.sale_price as any) || 0;
  const tawjeehAmount = residence.tawjeehIncluded === 0 ? (parseFloat(residence.tawjeeh_amount as any) || 150) : 0;
  const insuranceAmount = residence.insuranceIncluded === 0 ? (parseFloat(residence.insuranceAmount as any) || 126) : 0;
  const iloeFine = parseFloat(residence.iloe_fine as any) || 0;
  const totalFine = parseFloat(residence.total_Fine as any) || 0;
  const totalFinePaid = parseFloat(residence.totalFinePaid as any) || 0;
  const customChargesTotal = parseFloat((residence as any).custom_charges_total as any) || 0;
  const totalAmount = salePrice + tawjeehAmount + insuranceAmount + iloeFine + totalFine + customChargesTotal;
  const totalPaid = parseFloat(residence.total_paid as any) || 0;
  const totalRemaining = totalAmount - totalPaid - totalFinePaid;

  // Calculate completion percentage
  const completionPercentage = (residence.completedStep / 10) * 100;

  // Determine status badge - match old app logic exactly
  const getStatusBadge = () => {
    if (residence.completedStep === 10) {
      return { class: 'bg-success', text: 'Completed' };
    } else if (totalPaid >= salePrice) {
      return { class: 'bg-warning', text: 'Pending Processing (Payment Complete)' };
    } else {
      return { class: 'bg-danger', text: 'Pending Payment' };
    }
  };

  // Get step name
  const getStepName = (step: number) => {
    const steps: Record<number, string> = {
      0: 'Pending Payment',
      1: 'Offer Letter',
      2: 'Insurance',
      3: 'Labor Card',
      4: 'E-Visa',
      5: 'Change Status',
      6: 'Medical',
      7: 'Emirates ID',
      8: 'Visa Stamping',
      9: 'Final Review',
      10: 'Completed'
    };
    return steps[step] || `Step ${step}`;
  };

  // Check if has outstanding
  const hasOutstanding = totalRemaining > 0;

  // Check if ILOE fine exists
  const hasILOEFine = iloeFine > 0;

  // Check if cancelled or replaced status - match old app logic
  const isCancelledOrReplaced = residence.current_status && 
    (residence.current_status.toLowerCase() === 'cancelled' || 
     residence.current_status.toLowerCase() === 'replaced' ||
     residence.current_status.toLowerCase() === 'cancelled & replaced');

  const statusBadge = getStatusBadge();

  return (
    <>
    <div 
      className="card residence-card" 
      style={{ 
        backgroundColor: '#2d353c',
        border: '1px solid #495057',
        borderRadius: '8px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}
    >
      <div className="card-body p-4">
        {/* Header with name and progress indicator - match old app exactly */}
        <div className="row mb-3 align-items-center">
          <div className="col-md-8">
            <h2 className="mb-2" style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '1.75rem' }}>
              <i style={{ color: '#ffffff', fontWeight: 'bold', fontStyle: 'italic' }}>{residence.passenger_name}</i>
            </h2>
            <div className={`badge ${statusBadge.class} mb-2 me-1`}>{statusBadge.text}</div>
            {residence.current_status && (
              <span className="badge bg-secondary mb-2">{residence.current_status}</span>
            )}
            {/* Tawjeeh and Insurance completion badges */}
            {residence.tawjeeh_completed && residence.tawjeeh_completed > 0 && (
              <span className="badge bg-success mb-2 me-1"><i className="fa fa-check"></i> Tawjeeh</span>
            )}
            {residence.insurance_completed && residence.insurance_completed > 0 && (
              <span className="badge bg-info mb-2 me-1"><i className="fa fa-shield"></i> Insurance</span>
            )}
          </div>
          <div className="col-md-4 text-end">
            <div className="d-flex justify-content-end align-items-center">
              <div className="text-white-50 me-3">Completion: </div>
              <div className="progress-container p-2" style={{ minWidth: '100px' }}>
                <svg className="progress-circle-old" viewBox="0 0 100 100" style={{ height: '80px', width: '80px' }}>
                  <circle className="progress-circle-bg-old" cx="50" cy="50" r="45" />
                  <circle 
                    className="progress-circle-fill-old" 
                    cx="50" 
                    cy="50" 
                    r="45"
                    style={{
                      strokeDasharray: `${completionPercentage * 2.827}, 282.7`,
                      stroke: '#ff423e' // Red color matching old app
                    }}
                  />
                  <text className="progress-circle-text-old" x="50" y="50" dominantBaseline="middle" textAnchor="middle">
                    {Math.round(completionPercentage)}%
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="row">
          {/* Left side - Customer and Company info */}
          <div className="col-md-8">
            {/* Customer section */}
            <div className="row mb-3 border-bottom pb-2">
              <div className="col-md-12">
                <h6 className="text-white-50 mb-1 small">CUSTOMER INFORMATION</h6>
                <div className="row">
                  <div className="col-md-6">
                    <strong className="text-white">Customer Name:</strong> <span className="text-light">{residence.customer_name}</span>
                  </div>
                  <div className="col-md-6">
                    <strong className="text-white">Nationality:</strong> <span className="text-light">{residence.nationality_name}</span>
                  </div>
                </div>
                <div className="row mt-1">
                  <div className="col-md-6">
                    <strong className="text-white">Status Type:</strong> <span className="text-light">{residence.res_type || (residence.insideOutside === 'inside' ? 'mainland' : 'freezone')}</span>
                  </div>
                </div>
                <div className="row mt-1">
                  <div className="col-md-12">
                    <strong className="text-white">Entry Date:</strong> <span className="text-light">{residence.datetime ? new Date(residence.datetime).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Company section */}
            <div className="row mb-3 border-bottom pb-2">
              <div className="col-md-12">
                <h6 className="text-white-50 mb-1 small">COMPANY INFORMATION</h6>
                <div className="row">
                  <div className="col-md-6">
                    <strong className="text-white">Company Name:</strong> <span className="text-light">{residence.company_name || 'null'}</span>
                  </div>
                  <div className="col-md-6">
                    <strong className="text-white">Company Number:</strong> <span className="text-light">{residence.company_number || 'null'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Financial summary */}
          <div className="col-md-4 border-start border-dark">
            <div className="row">
              <div className="col-md-12">
                <h6 className="text-white-50 mb-1 small">FINANCIAL SUMMARY</h6>
                
                {/* Sale price */}
                <div className="mb-2">
                  <strong className="text-white">Sale Price:</strong> <span className="text-info">{salePrice.toLocaleString()} {residence.sale_currency_name}</span>
                </div>

                {/* TAWJEEH */}
                {residence.tawjeehIncluded === 0 ? (
                  <div className="mb-2">
                    <strong className="text-white">TAWJEEH:</strong> <span className="text-warning">{(residence.tawjeeh_amount || 150).toLocaleString()} AED (To be charged)</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <strong className="text-white">TAWJEEH:</strong> <span className="text-success">Included in sale price</span>
                  </div>
                )}

                {/* Insurance */}
                {residence.insuranceIncluded === 0 ? (
                  <div className="mb-2">
                    <strong className="text-white">ILOE Insurance:</strong> <span className="text-warning">{(residence.insuranceAmount || 126).toLocaleString()} AED (To be charged)</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <strong className="text-white">ILOE Insurance:</strong> <span className="text-success">Included in sale price</span>
                  </div>
                )}

                {/* ILOE Fine if exists */}
                {hasILOEFine && (
                  <div className="mb-2">
                    <strong className="text-white">ILOE Fine:</strong> <span className="text-danger">{iloeFine.toLocaleString()} AED</span>
                  </div>
                )}

                {/* E-Visa Fine if exists */}
                {totalFine > 0 && (
                  <div className="mb-2">
                    <strong className="text-white">E-Visa Fine:</strong> <span className="text-danger">{totalFine.toLocaleString()} {residence.sale_currency_name}</span>
                    {totalFinePaid > 0 && (
                      <small className="text-muted ms-2">(Paid: {totalFinePaid.toLocaleString()})</small>
                    )}
                  </div>
                )}

                {/* Custom Charges if exists */}
                {customChargesTotal > 0 && (
                  <div className="mb-2">
                    <strong className="text-white">Custom Charges:</strong> <span className="text-warning">{customChargesTotal.toLocaleString()} {residence.sale_currency_name}</span>
                  </div>
                )}

                {/* Total Invoice */}
                <div className="mb-2 border-top pt-2">
                  <strong className="text-white">Total Invoice Amount:</strong> <span className="text-info fw-bold">{totalAmount.toLocaleString()} {residence.sale_currency_name}</span>
                </div>

                {/* Total Paid */}
                <div className="mb-2">
                  <strong className="text-white">Total Paid:</strong> <span className="text-info">{totalPaid.toLocaleString()} {residence.sale_currency_name}</span>
                </div>

                {/* Total Remaining */}
                <div className="mb-2">
                  <strong className="text-white fw-bold">Total Remaining:</strong> <span className="text-danger fw-bold">{totalRemaining.toLocaleString()} {residence.sale_currency_name}</span>
                </div>

                {/* Action Buttons - Main (Continue and Attachments) */}
                <div className="mt-3">
                  <div className="btn-group w-100" role="group">
                    <button 
                      className="btn btn-info"
                      onClick={() => onContinue(residence)}
                    >
                      <i className={`fa fa-${residence.completedStep === 10 ? 'eye' : 'arrow-right'}`}></i> {residence.completedStep === 10 ? 'View' : 'Continue'}
                    </button>
                    <button 
                      className="btn btn-success"
                      onClick={() => onAttachments(residence)}
                    >
                      <i className="fa fa-paperclip"></i> Attachments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Row - match old app exactly */}
        <div className="row mt-3">
          <div className="col-12">
            <div className="d-flex flex-wrap gap-2">
              {isCancelledOrReplaced ? (
                <>
                  {/* Cancelled/Replaced Status Buttons */}
                  {onCancellationFee && (
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() => onCancellationFee(residence)}
                    >
                      <i className="fa fa-cc-paypal"></i> Pay Cancellation Fee
                    </button>
                  )}
                  {onCreditAdjustment && (
                    <button
                      className="btn btn-success"
                      type="button"
                      onClick={() => onCreditAdjustment(residence)}
                    >
                      <i className="fa fa-exchange"></i> Credit Adjustment
                    </button>
                  )}
                  <button
                    className="btn btn-warning"
                    type="button"
                    title="Add/Update ILOE Insurance Fine"
                    onClick={() => onILOE(residence)}
                  >
                    <i className="fa fa-exclamation-triangle"></i> ILOE Fine{hasILOEFine ? ` (${iloeFine.toLocaleString()} AED)` : ''}
                  </button>
                  <button className="btn btn-info" type="button" disabled>
                    <i className="fa fa-history"></i> Payment History
                  </button>
                  <button className="btn btn-primary" type="button" disabled>
                    <i className="fa fa-file-text"></i> NOC
                  </button>
                  <button className="btn btn-success" type="button" disabled>
                    <i className="fa fa-file-text"></i> Salary Certificate
                  </button>
                  {/* More dropdown disabled for cancelled */}
                  <div className="btn-group">
                    <button type="button" className="btn btn-danger dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" disabled>
                      More <i className="fa fa-caret-down" aria-hidden="true"></i>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Normal Status Buttons */}
                  {/* Pay Total Outstanding - Unified Payment Button */}
                  <button
                    className="btn btn-primary text-white unified-payment-btn"
                    type="button"
                    title="Pay All Outstanding Charges"
                    onClick={() => onPayTotal(residence)}
                  >
                    <i className="fa fa-credit-card"></i> Pay Total Outstanding
                  </button>

                  {/* TAWJEEH Management */}
                  <button
                    className="btn btn-secondary text-white"
                    type="button"
                    title="Manage TAWJEEH Charges"
                    onClick={() => onTawjeeh(residence)}
                  >
                    <i className="fa fa-check-circle"></i> TAWJEEH
                  </button>

                  {/* ILOE Management */}
                  <button
                    className="btn btn-secondary text-white"
                    type="button"
                    title="Manage ILOE Insurance & Fines"
                    onClick={() => onILOE(residence)}
                  >
                    <i className="fa fa-shield-alt"></i> ILOE
                  </button>

                  {/* Payment History */}
                  <button
                    className="btn btn-info"
                    type="button"
                    onClick={() => onPaymentHistory(residence)}
                  >
                    <i className="fa fa-history"></i> Payment History
                  </button>

                  {/* Ledger */}
                  {onLedger && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => onLedger(residence)}
                    >
                      <i className="fa fa-book"></i> Ledger
                    </button>
                  )}

                  {/* NOC */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onNOC(residence);
                    }}
                    className="btn btn-primary"
                    type="button"
                  >
                    <i className="fa fa-file-text"></i> NOC
                  </button>

                  {/* Salary Certificate */}
                  <button
                    className="btn btn-success"
                    type="button"
                    onClick={() => onSalaryCertificate(residence)}
                  >
                    <i className="fa fa-file-text"></i> Salary Certificate
                  </button>

                  {/* Renew button - conditional */}
                  {residence.current_status === 'Active' && residence.completedStep === 10 && onRenew && (
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => onRenew(residence)}
                    >
                      <i className="fa fa-refresh"></i> Renew
                    </button>
                  )}

                  {/* More Dropdown */}
                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-danger dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      More <i className="fa fa-caret-down" aria-hidden="true"></i>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      {/* Fine Management */}
                      {onAddFine && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onAddFine(residence)}>
                            <i className="fa fa-plus"></i> Add Fine
                          </button>
                        </li>
                      )}
                      {onViewFine && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onViewFine(residence)}>
                            <i className="fa fa-eye"></i> View Fine
                          </button>
                        </li>
                      )}

                      {/* Custom Charges */}
                      {onAddCustomCharge && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onAddCustomCharge(residence)}>
                            <i className="fa fa-plus-circle"></i> Add Custom Charge
                          </button>
                        </li>
                      )}

                      <li><hr className="dropdown-divider" /></li>

                      {/* Invoice */}
                      {onGenerateInvoice && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onGenerateInvoice(residence)}>
                            <i className="fa fa-file-pdf-o"></i> Generate Invoice
                          </button>
                        </li>
                      )}

                      <li><hr className="dropdown-divider" /></li>

                      {/* TAWJEEH & Insurance Operations */}
                      {residence.tawjeeh_completed && residence.tawjeeh_completed > 0 ? (
                        <li>
                          <button className="dropdown-item text-success" type="button" disabled>
                            <i className="fa fa-check"></i> Tawjeeh Completed
                          </button>
                        </li>
                      ) : onPerformTawjeeh && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onPerformTawjeeh(residence)}>
                            <i className="fa fa-id-card"></i> Perform Tawjeeh
                          </button>
                        </li>
                      )}

                      {residence.insurance_completed && residence.insurance_completed > 0 ? (
                        <li>
                          <button className="dropdown-item text-success" type="button" disabled>
                            <i className="fa fa-check"></i> Insurance Issued
                          </button>
                        </li>
                      ) : onIssueInsurance && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onIssueInsurance(residence)}>
                            <i className="fa fa-shield"></i> Issue Insurance
                          </button>
                        </li>
                      )}

                      <li><hr className="dropdown-divider" /></li>

                      {/* Delete (Admin Only) */}
                      {isAdmin && onDeleteResidence && (
                        <li>
                          <button className="dropdown-item text-danger" type="button" onClick={() => {
                            if (window.confirm(`Are you sure you want to delete residence for ${residence.passenger_name}?`)) {
                              onDeleteResidence(residence);
                            }
                          }}>
                            <i className="fa fa-trash"></i> Delete Residence
                          </button>
                        </li>
                      )}

                      {/* Cancel/Replace */}
                      {onCancelResidence && (
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => onCancelResidence(residence)}>
                            <i className="fa fa-times"></i> Cancel (& Replace if Company)
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    <hr className="reportLineBreaker" />
  </>
  );
}
