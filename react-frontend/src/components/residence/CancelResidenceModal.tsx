import { useState } from 'react';
import type { Residence } from '../../types/residence';
import Modal from '../common/Modal';
import Button from '../common/Button';

interface CancelResidenceModalProps {
  residence: Residence;
  onCancel: (charges: number, remarks: string) => void;
  onClose: () => void;
}

export default function CancelResidenceModal({ residence, onCancel, onClose }: CancelResidenceModalProps) {
  const [charges, setCharges] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!remarks.trim()) {
      alert('Please provide cancellation remarks');
      return;
    }

    if (confirm(`Are you sure you want to cancel this residence?\n\nPassenger: ${residence.passenger_name}\nCancellation Charges: AED ${charges}\n\nThis action cannot be undone.`)) {
      setSaving(true);
      try {
        await onCancel(charges, remarks);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Cancel Residence">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Residence Info */}
          <div className="bg-gray-700 p-4 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Residence ID:</span>
                <span className="ml-2 text-white font-bold">#{residence.residenceID}</span>
              </div>
              <div>
                <span className="text-gray-400">Passenger:</span>
                <span className="ml-2 text-white">{residence.passenger_name}</span>
              </div>
              <div>
                <span className="text-gray-400">Customer:</span>
                <span className="ml-2 text-white">{residence.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-400">Current Step:</span>
                <span className="ml-2 text-white">{residence.completedStep}/10</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-900/30 border border-red-700 p-4 rounded">
            <div className="flex items-start gap-3">
              <i className="fa fa-exclamation-triangle text-red-400 mt-1"></i>
              <div>
                <h4 className="font-bold text-red-400 mb-1">Warning</h4>
                <p className="text-sm text-gray-300">
                  Cancelling this residence will permanently mark it as cancelled. 
                  This action cannot be undone. Any costs incurred up to this point will need to be processed.
                </p>
              </div>
            </div>
          </div>

          {/* Cancellation Charges */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cancellation Charges (AED) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              className="input-field w-full"
              value={charges}
              onChange={(e) => setCharges(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              required
              placeholder="Enter cancellation charges"
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the amount to charge the customer for cancellation
            </p>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cancellation Remarks <span className="text-red-400">*</span>
            </label>
            <textarea
              className="input-field w-full"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              required
              rows={4}
              placeholder="Provide reason for cancellation..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Explain why this residence is being cancelled
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={saving}
            >
              <i className="fa fa-times-circle mr-2"></i>
              {saving ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}














