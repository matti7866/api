import type { Residence } from '../../types/residence';

interface ResidenceInfoProps {
  residence: Residence;
}

export default function ResidenceInfo({ residence }: ResidenceInfoProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount?: number, symbol: string = 'AED') => {
    if (!amount) return '-';
    return `${symbol} ${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Customer Information */}
      <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
          <i className="fa fa-user mr-2"></i>
          Customer Information
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Customer:</span>
            <span className="text-white font-medium">{residence.customer_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Phone:</span>
            <span className="text-white">{residence.customer_phone || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Email:</span>
            <span className="text-white text-xs">{residence.customer_email || '-'}</span>
          </div>
        </div>
      </div>

      {/* Passenger Information */}
      <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
          <i className="fa fa-passport mr-2"></i>
          Passenger Information
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Name:</span>
            <span className="text-white font-medium">{residence.passenger_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Nationality:</span>
            <span className="text-white">{residence.nationality_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DOB:</span>
            <span className="text-white">{formatDate(residence.dob)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Gender:</span>
            <span className="text-white">{residence.gender || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Passport:</span>
            <span className="text-white">{residence.passportNumber || '-'}</span>
          </div>
          {residence.passportExpiryDate && (
            <div className="flex justify-between">
              <span className="text-gray-400">Passport Expiry:</span>
              <span className="text-white">{formatDate(residence.passportExpiryDate)}</span>
            </div>
          )}
          {residence.uid && (
            <div className="flex justify-between">
              <span className="text-gray-400">UID:</span>
              <span className="text-white">{residence.uid}</span>
            </div>
          )}
          {residence.EmiratesIDNumber && (
            <div className="flex justify-between">
              <span className="text-gray-400">Emirates ID:</span>
              <span className="text-white">{residence.EmiratesIDNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* Visa & Employment */}
      <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
          <i className="fa fa-briefcase mr-2"></i>
          Visa & Employment
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Visa Type:</span>
            <span className="text-white">{residence.visa_type_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Company:</span>
            <span className="text-white">{residence.company_name || 'Individual'}</span>
          </div>
          {residence.position_name && (
            <div className="flex justify-between">
              <span className="text-gray-400">Position:</span>
              <span className="text-white">{residence.position_name}</span>
            </div>
          )}
          {residence.salary_amount && (
            <div className="flex justify-between">
              <span className="text-gray-400">Salary:</span>
              <span className="text-white">{formatCurrency(residence.salary_amount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white">{residence.InsideOutside || '-'}</span>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
          <i className="fa fa-money-bill mr-2"></i>
          Financial Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Sale Price:</span>
            <span className="text-green-400 font-bold">
              {formatCurrency(residence.sale_price, residence.sale_currency_symbol)}
            </span>
          </div>
          
          {/* Calculate total costs */}
          {(() => {
            const customChargesTotal = parseFloat((residence as any).custom_charges_total as any) || 0;
            const totalCost = (residence.offerLetterCost || 0) +
                             (residence.insuranceCost || 0) +
                             (residence.laborCardFee || 0) +
                             (residence.eVisaCost || 0) +
                             (residence.changeStatusCost || 0) +
                             (residence.medicalTCost || 0) +
                             (residence.emiratesIDCost || 0) +
                             (residence.visaStampingCost || 0) +
                             (residence.iloe_cost || 0) +
                             (residence.tawjeeh_cost || 0) +
                             customChargesTotal;
            
            const profit = residence.sale_price - totalCost;
            
            return (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Costs:</span>
                  <span className="text-red-400 font-bold">
                    AED {totalCost.toLocaleString()}
                  </span>
                </div>
                {customChargesTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Custom Charges:</span>
                    <span className="text-yellow-400 font-bold">
                      AED {customChargesTotal.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Profit:</span>
                  <span className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    AED {profit.toLocaleString()}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Timestamps */}
      <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
        <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
          <i className="fa fa-clock mr-2"></i>
          Important Dates
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Created:</span>
            <span className="text-white">{formatDate(residence.datetime)}</span>
          </div>
          {residence.expiry_date && (
            <div className="flex justify-between">
              <span className="text-gray-400">Visa Expiry:</span>
              <span className="text-white">{formatDate(residence.expiry_date)}</span>
            </div>
          )}
          {residence.eid_expiry && (
            <div className="flex justify-between">
              <span className="text-gray-400">EID Expiry:</span>
              <span className="text-white">{formatDate(residence.eid_expiry)}</span>
            </div>
          )}
          {residence.cancelDate && (
            <div className="flex justify-between">
              <span className="text-red-400">Cancelled:</span>
              <span className="text-red-300">{formatDate(residence.cancelDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Remarks */}
      {residence.remarks && (
        <div className="card p-4" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
          <h3 className="text-lg font-bold text-white mb-3 border-b border-gray-700 pb-2">
            <i className="fa fa-comment mr-2"></i>
            Remarks
          </h3>
          <p className="text-sm text-gray-300">{residence.remarks}</p>
        </div>
      )}
    </div>
  );
}






