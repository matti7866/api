import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import residenceService from '../../services/residenceService';
import type { Residence } from '../../types/residence';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import StepWorkflow from '../../components/residence/StepWorkflow';
import ResidenceInfo from '../../components/residence/ResidenceInfo';
import CancelResidenceModal from '../../components/residence/CancelResidenceModal';
import './ResidenceDetail.css';

export default function ResidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [residence, setResidence] = useState<Residence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadResidence();
    }
  }, [id]);

  const loadResidence = async () => {
    if (!id) return;
    
    setLoading(true);
    setError('');
    try {
      const data = await residenceService.getResidence(parseInt(id));
      setResidence(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred while loading residence');
    } finally {
      setLoading(false);
    }
  };

  const handleStepUpdate = async (step: number, data: Record<string, unknown>, markComplete: boolean) => {
    if (!residence) return false;
    
    try {
      // Flatten the data object - updateStep expects all fields at the root level
      const updateData: any = {
        step,
        markComplete
      };
      
      // Copy all data fields to root level
      Object.keys(data).forEach(key => {
        if (key !== 'step' && key !== 'markComplete' && key !== 'files') {
          updateData[key] = data[key];
        }
      });
      
      // Handle files separately
      if (data.files) {
        updateData.files = data.files;
      }
      
      await residenceService.updateStep(residence.residenceID, updateData);
      // Reload residence data
      await loadResidence();
      return true;
    } catch (err: any) {
      alert(err.response?.data?.message || 'An error occurred while updating step');
      return false;
    }
  };

  const handleCancel = async (reason: string) => {
    if (!residence) return;
    
    try {
      await residenceService.cancelResidence(residence.residenceID, reason);
      setShowCancelModal(false);
      await loadResidence();
      alert('Residence cancelled successfully');
    } catch (err: any) {
      alert(err.response?.data?.message || 'An error occurred while cancelling residence');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !residence) {
    return (
      <div className="p-6">
        <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-4">
          {error || 'Residence not found'}
        </div>
        <Button onClick={() => navigate('/residence')}>
          <i className="fa fa-arrow-left mr-2"></i>
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="residence-detail-page p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => navigate('/residence')}>
                <i className="fa fa-arrow-left"></i>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Residence #{residence.residenceID}
                </h1>
                <p className="text-gray-400 mt-1">{residence.passenger_name}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!residence.cancelled && !residence.hold && residence.completedStep < 10 && (
              <Button variant="danger" onClick={() => setShowCancelModal(true)}>
                <i className="fa fa-times-circle mr-2"></i>
                Cancel Residence
              </Button>
            )}
            <Button variant="secondary" onClick={loadResidence}>
              <i className="fa fa-sync mr-2"></i>
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2">
          {residence.cancelled && (
            <span className="px-3 py-1 text-sm font-semibold rounded bg-red-600 text-white">
              CANCELLED
            </span>
          )}
          {residence.hold && (
            <span className="px-3 py-1 text-sm font-semibold rounded bg-yellow-600 text-white">
              ON HOLD
            </span>
          )}
          {residence.completedStep === 10 && !residence.cancelled && (
            <span className="px-3 py-1 text-sm font-semibold rounded bg-green-600 text-white">
              COMPLETED
            </span>
          )}
          {residence.completedStep < 10 && !residence.cancelled && !residence.hold && (
            <span className="px-3 py-1 text-sm font-semibold rounded bg-blue-600 text-white">
              IN PROGRESS - STEP {residence.completedStep}/10
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Residence Info */}
        <div className="lg:col-span-1">
          <ResidenceInfo residence={residence} />
        </div>

        {/* Right Column - Workflow */}
        <div className="lg:col-span-2">
          <div className="card p-6" style={{ backgroundColor: '#2d353c', border: '1px solid #495057' }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: '#ffffff' }}>
              10-Step Workflow Process
            </h2>
            <StepWorkflow 
              residence={residence} 
              onStepUpdate={handleStepUpdate}
              disabled={residence.cancelled === 1 || residence.hold === 1}
            />
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <CancelResidenceModal
          residence={residence}
          onCancel={handleCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}

