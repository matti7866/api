import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import residenceService from '../../services/residenceService';
import AddFineModal from './AddFineModal';
import Swal from 'sweetalert2';
import '../modals/Modal.css';

interface FineRecord {
  residenceFineID: number;
  fineAmount: number;
  currencyName: string;
  account_Name: string;
  residenceFineDate: string;
  staff_name: string;
  docName: string | null;
  residenceID: number;
  accountID?: number;
  currencyID?: number;
}

interface ViewFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  residence: Residence | null;
  onAddFine: () => void;
  refreshTrigger?: number;
  accounts: Array<{ accountID: number; accountName: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
  onRefresh?: () => void;
}

export default function ViewFineModal({ isOpen, onClose, residence, onAddFine, refreshTrigger, accounts, currencies, onRefresh }: ViewFineModalProps) {
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedFine, setSelectedFine] = useState<FineRecord | null>(null);

  useEffect(() => {
    if (isOpen && residence) {
      loadFines();
    }
  }, [isOpen, residence, refreshTrigger]); // Add refreshTrigger to dependencies

  const loadFines = async () => {
    if (!residence) return;
    
    setLoading(true);
    try {
      const data = await residenceService.getFines(residence.residenceID);
      console.log('Fines data loaded:', data); // Debug log
      // Handle both array and object responses
      if (Array.isArray(data)) {
        setFines(data);
        // Calculate outstanding from array
        const total = data.reduce((sum, fine) => sum + parseFloat(fine.fineAmount || 0), 0);
        setOutstandingBalance(total);
      } else {
        setFines(Array.isArray(data.fines) ? data.fines : []);
        setOutstandingBalance(data.outstandingBalance || 0);
      }
    } catch (error: any) {
      console.error('Failed to load fines:', error);
      console.error('Error details:', error.response?.data || error.message);
      setFines([]);
      setOutstandingBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const handleEditFine = (fine: FineRecord) => {
    // The fine record should already have accountID and currencyID from the API
    // But if not, try to find account by name as fallback
    if (!fine.accountID) {
      const account = accounts.find(acc => acc.accountName === fine.account_Name);
      fine.accountID = account?.accountID;
    }
    setSelectedFine(fine);
    setEditModalOpen(true);
  };

  const handleDeleteFine = async (fine: FineRecord) => {
    const result = await Swal.fire({
      title: 'Delete Fine?',
      text: `Are you sure you want to delete this fine of ${fine.fineAmount.toLocaleString()} ${fine.currencyName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'swal2-nested-modal'
      },
      zIndex: 30000
    });

    if (result.isConfirmed) {
      try {
        await residenceService.deleteFine(fine.residenceFineID);
        Swal.fire({
          title: 'Deleted!',
          text: 'Fine has been deleted.',
          icon: 'success',
          zIndex: 30000
        });
        loadFines();
        if (onRefresh) onRefresh();
      } catch (error: any) {
        Swal.fire({
          title: 'Error',
          text: error.response?.data?.message || 'Failed to delete fine',
          icon: 'error',
          zIndex: 30000
        });
      }
    }
  };

  const handleUpdateFine = async (data: { residenceFineID?: number; fineAmount: number; accountID: number; currencyID?: number }) => {
    if (!data.residenceFineID) {
      throw new Error('Fine ID is required for update');
    }
    try {
      await residenceService.updateFine({
        residenceFineID: data.residenceFineID,
        fineAmount: data.fineAmount,
        accountID: data.accountID,
        currencyID: data.currencyID
      });
      Swal.fire({
        title: 'Success',
        text: 'Fine updated successfully',
        icon: 'success',
        zIndex: 30000
      });
      setEditModalOpen(false);
      setSelectedFine(null);
      loadFines();
      if (onRefresh) onRefresh();
    } catch (error: any) {
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || 'Failed to update fine',
        icon: 'error',
        zIndex: 30000
      });
      throw error;
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <>
      {editModalOpen && (
        <AddFineModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedFine(null);
          }}
          onSubmit={handleUpdateFine}
          residence={residence}
          accounts={accounts}
          currencies={currencies}
          fineRecord={selectedFine}
          mode="edit"
        />
      )}
      <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-money-bill"></i> Residence Fine Details</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Section */}
          <div className="bg-dark text-white p-3 mb-3 rounded" style={{ backgroundColor: '#1a1a1a !important' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="mb-1 text-white">Outstanding Fine Balance</h6>
                <div className="fs-5 fw-bold text-white">
                  {outstandingBalance > 0 ? (
                    <span className="text-warning">{outstandingBalance.toLocaleString()} AED</span>
                  ) : (
                    <span className="text-success">No outstanding fines</span>
                  )}
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={loadFines}>
                <i className="fa fa-refresh me-1"></i> Refresh
              </button>
            </div>
          </div>

          {/* Fine Table */}
          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead className="bg-primary text-white">
                <tr>
                  <th width="5%">#</th>
                  <th width="8%">Type</th>
                  <th width="15%">Fine Amount</th>
                  <th width="15%">Account</th>
                  <th width="15%">Date</th>
                  <th width="15%">Charged By</th>
                  <th width="12%">Receipt</th>
                  <th width="15%" className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Loading...
                    </td>
                  </tr>
                ) : fines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <i className="fa fa-info-circle me-2"></i>No fine records found
                    </td>
                  </tr>
                ) : (
                  fines.map((fine, index) => (
                    <tr key={fine.residenceFineID} className="align-middle">
                      <td className="text-center">{index + 1}</td>
                      <td><span className="badge bg-warning text-dark">Fine</span></td>
                      <td>
                        {fine.fineAmount.toLocaleString()} <small className="text-primary">{fine.currencyName}</small>
                      </td>
                      <td>{fine.account_Name}</td>
                      <td>{fine.residenceFineDate}</td>
                      <td>{fine.staff_name}</td>
                      <td className="text-center">
                        {fine.docName ? (
                          <div className="btn-group">
                            <a 
                              href={`/api/residence/download-fine-doc.php?id=${fine.residenceFineID}&type=2`}
                              className="btn btn-sm btn-outline-info"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <i className="fa fa-download me-1"></i>Download
                            </a>
                          </div>
                        ) : (
                          <button className="btn btn-sm btn-outline-primary" disabled>
                            <i className="fa fa-upload me-1"></i>Upload
                          </button>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="btn-group">
                          <button 
                            className="btn btn-sm btn-outline-warning" 
                            title="Edit Fine"
                            onClick={() => handleEditFine(fine)}
                          >
                            <i className="fa fa-edit me-1"></i>Edit
                          </button>
                          <button 
                            className="btn btn-sm btn-outline-danger" 
                            title="Delete Fine"
                            onClick={() => handleDeleteFine(fine)}
                          >
                            <i className="fa fa-trash me-1"></i>Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <i className="fa fa-times me-1"></i> Close
          </button>
          <button type="button" className="btn btn-primary" onClick={onAddFine}>
            <i className="fa fa-plus me-1"></i> Add New Fine
          </button>
        </div>
      </div>
    </div>
    </>
  );
}



