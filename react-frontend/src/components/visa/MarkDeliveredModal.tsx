import { useState } from 'react';
import Swal from 'sweetalert2';
import visaService from '../../services/visaService';
import '../modals/Modal.css';

interface EIDTask {
  residenceID: number;
  passenger_name: string;
  passportNumber: string;
  EmiratesIDNumber: string;
  completedStep: number;
  customer_name: string;
  remaining_balance: number;
  type: 'ML' | 'FZ';
}

interface MarkDeliveredModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: EIDTask;
  onSuccess: () => void;
}

export default function MarkDeliveredModal({ isOpen, onClose, task, onSuccess }: MarkDeliveredModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const result = await Swal.fire({
      title: 'Confirm',
      text: 'Are you sure you want to mark this Emirates ID as delivered?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark as delivered',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#06b6d4',
      cancelButtonColor: '#6c757d'
    });

    if (result.isConfirmed) {
      setLoading(true);
      try {
        await visaService.markEIDDelivered({
          id: task.residenceID,
          type: task.type
        });

        Swal.fire('Success', 'Emirates ID marked as delivered successfully', 'success');
        onSuccess();
        onClose();
      } catch (error: any) {
        console.error('Error marking as delivered:', error);
        Swal.fire('Error', error.response?.data?.message || 'Failed to mark as delivered', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-check-circle"></i> Mark as Delivered</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to mark this Emirates ID as delivered?</p>
          <div className="mt-3">
            <strong>ID:</strong> {task.residenceID}<br />
            <strong>Passenger:</strong> {task.passenger_name}<br />
            <strong>EID Number:</strong> {task.EmiratesIDNumber || 'N/A'}<br />
            <strong>Type:</strong> {task.type}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="btn btn-info" onClick={handleConfirm} disabled={loading}>
            {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Mark as Delivered
          </button>
        </div>
      </div>
    </div>
  );
}

