import React, { useState, useEffect } from 'react';
import { config } from '../../utils/config';
import Swal from 'sweetalert2';
import residenceService from '../../services/residenceService';
import '../modals/Modal.css';

interface Attachment {
  attachment_id: number;
  residenceID: number;
  file_path: string;
  file_name: string;
  file_type: string | number;
  step_number: number;
  uploaded_at?: string;
}

interface AttachmentsModalProps {
	isOpen: boolean;
	onClose: () => void;
	residence?: any;
  onLoadAttachments?: (residenceID: number) => Promise<Attachment[]>;
	onUploadAttachment?: (residenceID: number, stepNumber: number, file: File, fileType?: number) => Promise<void>;
	onDeleteAttachment?: (attachmentId: number) => Promise<void>;
}

const fileTypeNames: Record<number, string> = {
  1: 'Passport Copy',
  2: 'Offer Letter',
  3: 'Insurance',
  4: 'Labour Card',
  5: 'E-Visa',
  6: 'Change Status',
  7: 'Medical',
  8: 'Emirates ID',
  9: 'Visa Stamping',
  10: 'Contract Submission',
  11: 'Photo',
  12: 'ID Front',
  13: 'ID Back',
  14: 'Other'
};

const stepToFileType: Record<string, number> = {
  '1': 2,   // Offer Letter
  '2': 3,   // Insurance
  '3': 4,   // Labour Card
  '4': 5,   // E-Visa
  '5': 6,   // Change Status
  '6': 7,   // Medical
  '7': 8,   // Emirates ID
  '8': 9,   // Visa Stamping
  '9': 10,  // Contract Submission
  '0': 1,   // Initial Documents (Passport)
};

const AttachmentsModal: React.FC<AttachmentsModalProps> = ({ 
  isOpen, 
  onClose, 
  residence,
  onLoadAttachments,
  onUploadAttachment,
  onDeleteAttachment
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStep, setSelectedStep] = useState<string>('0');

  useEffect(() => {
    if (isOpen && (residence?.residenceID || residence?.familyResidenceID)) {
      loadAttachments();
    }
  }, [isOpen, residence]);

  const loadAttachments = async () => {
    const residenceID = residence?.familyResidenceID || residence?.residenceID;
    if (!residenceID) {
      console.log('No residenceID found:', residence);
      return;
    }
    
    setLoading(true);
    try {
      if (onLoadAttachments) {
        const data = await onLoadAttachments(residenceID);
        console.log('Loaded attachments via callback:', data);
        setAttachments(Array.isArray(data) ? data : []);
      } else {
        const data = await residenceService.getAttachments(residenceID);
        console.log('Loaded attachments via service:', data);
        setAttachments(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      console.error('Error loading attachments:', error);
      console.error('Error response:', error.response);
      Swal.fire('Error', 'Failed to load attachments: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    const residenceID = residence?.familyResidenceID || residence?.residenceID;
    if (!selectedFile || !residenceID) {
      Swal.fire('Error', 'Please select a file', 'error');
      return;
    }

    setUploading(true);
    try {
      const stepNumber = parseInt(selectedStep);
      const fileType = stepToFileType[selectedStep] || 14; // Default to 'Other'
      
      if (onUploadAttachment) {
        await onUploadAttachment(residenceID, stepNumber, selectedFile, fileType);
      } else {
        await residenceService.uploadAttachment(residenceID, stepNumber, selectedFile, fileType);
      }
      Swal.fire('Success', 'File uploaded successfully', 'success');
      setSelectedFile(null);
      setSelectedStep('0');
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Reload attachments
      await loadAttachments();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: number, fileName: string) => {
    const result = await Swal.fire({
      title: 'Delete Attachment?',
      text: `Are you sure you want to delete "${fileName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        if (onDeleteAttachment) {
          await onDeleteAttachment(attachmentId);
        } else {
          await residenceService.deleteAttachment(attachmentId);
        }
        Swal.fire('Deleted!', 'Attachment has been deleted.', 'success');
        await loadAttachments();
      } catch (error: any) {
        console.error('Error deleting attachment:', error);
        Swal.fire('Error', error.response?.data?.message || 'Failed to delete attachment', 'error');
      }
    }
  };

  const getFileIcon = (fileType: string | number) => {
    const ext = typeof fileType === 'number' 
      ? (fileType === 1 ? 'pdf' : fileType === 11 ? 'jpg' : 'pdf')
      : fileType.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return { icon: 'fa-image', color: '#4CAF50' };
    }
    if (ext === 'pdf' || fileType === 1) {
      return { icon: 'fa-file-pdf', color: '#F44336' };
    }
    if (['doc', 'docx'].includes(ext)) {
      return { icon: 'fa-file-word', color: '#2196F3' };
    }
    if (['xls', 'xlsx'].includes(ext)) {
      return { icon: 'fa-file-excel', color: '#4CAF50' };
    }
    if (['zip', 'rar'].includes(ext)) {
      return { icon: 'fa-file-archive', color: '#FF9800' };
    }
    return { icon: 'fa-file', color: '#757575' };
  };

  const isImage = (fileType: string | number) => {
    if (typeof fileType === 'number') {
      return fileType === 11; // Photo
    }
    const ext = fileType.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  };

  const isPDF = (fileType: string | number) => {
    if (typeof fileType === 'number') {
      return fileType === 1; // Passport/PDF
    }
    return fileType.toLowerCase() === 'pdf';
  };

  const getFileUrl = (filePath: string) => {
    // If file path doesn't start with http, prepend the base URL
    if (filePath.startsWith('http')) {
      return filePath;
    }
    // Handle family_residence_documents path
    if (filePath.includes('family_residence_documents')) {
      return `${config.baseUrl}/${filePath}`;
    }
    // Remove 'api/' prefix if present and construct URL
    // File paths are relative to the root, e.g., 'residence/filename.jpg'
    return `${config.baseUrl}/${filePath}`;
  };

		if (!isOpen) return null;

		return (
			<div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
					<div className="modal-header">
          <h3><i className="fa fa-paperclip me-2"></i>Attachments</h3>
						<button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Upload Section */}
          <div className="mb-4 p-3" style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
            <h5 className="mb-3"><i className="fa fa-upload me-2"></i>Upload New Attachment</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Step</label>
                <select 
                  className="form-select" 
                  value={selectedStep} 
                  onChange={(e) => setSelectedStep(e.target.value)}
                >
                  <option value="0">Initial Documents</option>
                  <option value="1">Offer Letter</option>
                  <option value="2">Insurance</option>
                  <option value="3">Labour Card</option>
                  <option value="4">E-Visa</option>
                  <option value="5">Change Status</option>
                  <option value="6">Medical</option>
                  <option value="7">Emirates ID</option>
                  <option value="8">Visa Stamping</option>
                  <option value="9">Contract Submission</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">File</label>
                <input
                  id="file-input"
                  type="file"
                  className="form-control"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button
                  className="btn btn-primary w-100"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <><i className="fa fa-spinner fa-spin me-2"></i>Uploading...</>
                  ) : (
                    <><i className="fa fa-upload me-2"></i>Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Attachments Grid */}
          {loading ? (
            <div className="text-center py-5">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading attachments...</p>
            </div>
          ) : attachments.length === 0 ? (
            <div className="alert alert-info text-center">
              <i className="fa fa-info-circle me-2"></i>No attachments found
            </div>
          ) : (
            <div className="row g-3">
              {attachments.map((attachment) => {
                const fileIcon = getFileIcon(attachment.file_type);
                const fileUrl = getFileUrl(attachment.file_path);
                const isImg = isImage(attachment.file_type);
                const isPdf = isPDF(attachment.file_type);
                
                return (
                  <div key={attachment.attachment_id} className="col-md-4 col-sm-6">
                    <div className="card h-100 shadow-sm" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                      {/* Thumbnail/Icon Section */}
                      <div 
                        className="position-relative" 
                        style={{ 
                          height: '180px', 
                          background: isImg || isPdf ? '#f8f9fa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden'
                        }}
                        onClick={() => window.open(fileUrl, '_blank')}
                      >
                        {isImg ? (
                          <img 
                            src={fileUrl} 
                            alt={attachment.file_name}
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover' 
                            }}
                            onError={(e) => {
                              // Fallback to icon if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<i class="fa ${fileIcon.icon}" style="font-size: 64px; color: ${fileIcon.color}"></i>`;
                              }
                            }}
                          />
                        ) : isPdf ? (
                          <object
                            data={`${fileUrl}#page=1&zoom=50`}
                            type="application/pdf"
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              pointerEvents: 'none'
                            }}
                            title={attachment.file_name}
                          >
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              height: '100%',
                              background: '#f8f9fa'
                            }}>
                              <i className={`fa ${fileIcon.icon}`} style={{ fontSize: '64px', color: fileIcon.color, marginBottom: '10px' }}></i>
                              <span style={{ fontSize: '12px', color: '#666' }}>PDF Preview</span>
                            </div>
                          </object>
                        ) : (
                          <i className={`fa ${fileIcon.icon}`} style={{ fontSize: '64px', color: fileIcon.color }}></i>
                        )}
                        
                        {/* File Type Badge */}
                        <span 
                          className="badge bg-primary position-absolute top-0 start-0 m-2" 
                          style={{ fontSize: '10px' }}
                        >
                          {typeof attachment.file_type === 'number'
                            ? fileTypeNames[attachment.file_type] || 'Other'
                            : fileTypeNames[stepToFileType[attachment.step_number.toString()] || 14] || 'Other'}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="card-body p-3">
                        <h6 
                          className="card-title mb-2 text-truncate" 
                          title={attachment.file_name}
                          style={{ fontSize: '13px', fontWeight: '600' }}
                        >
                          {attachment.file_name}
                        </h6>
                        <p className="card-text mb-2">
                          <small className="text-muted">
                            <i className="fa fa-tag me-1"></i>
                            {typeof attachment.file_type === 'number' 
                              ? fileTypeNames[attachment.file_type] || 'Other'
                              : attachment.file_type.toUpperCase()} File
                          </small>
                        </p>
                        {attachment.uploaded_at && (
                          <p className="card-text mb-2">
                            <small className="text-muted">
                              <i className="fa fa-clock me-1"></i>
                              {new Date(attachment.uploaded_at).toLocaleDateString()}
                            </small>
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-info flex-fill"
                            onClick={() => window.open(fileUrl, '_blank')}
                            title="View"
                          >
                            <i className="fa fa-eye me-1"></i>View
                          </button>
                          <a
                            href={fileUrl}
                            download
                            className="btn btn-sm btn-outline-success flex-fill"
                            title="Download"
                          >
                            <i className="fa fa-download me-1"></i>Download
                          </a>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(attachment.attachment_id, attachment.file_name)}
                            title="Delete"
                          >
                            <i className="fa fa-trash"></i>
						</button>
					</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
					</div>
				</div>
			</div>
		);
};

export default AttachmentsModal;
