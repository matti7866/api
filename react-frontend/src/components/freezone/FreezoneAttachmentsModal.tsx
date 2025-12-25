import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import freezoneService from '../../services/freezoneService';
import '../modals/Modal.css';

interface Attachment {
  id: number;
  file_name: string;
  original_name: string;
  fileType: string;
  uploaded_at?: string;
}

interface FreezoneAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceId: number | null;
}

const getFileUrl = (fileName: string) => {
  return `/freezoneFiles/${fileName}`;
};

const getFileIcon = (fileType: string) => {
  const ext = fileType.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'fa fa-file-image';
  if (ext === 'pdf') return 'fa fa-file-pdf';
  if (['doc', 'docx'].includes(ext)) return 'fa fa-file-word';
  if (['xls', 'xlsx'].includes(ext)) return 'fa fa-file-excel';
  return 'fa fa-file';
};

const FreezoneAttachmentsModal: React.FC<FreezoneAttachmentsModalProps> = ({ 
  isOpen, 
  onClose, 
  residenceId
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('');

  useEffect(() => {
    if (isOpen && residenceId) {
      loadAttachments();
    }
  }, [isOpen, residenceId]);

  const loadAttachments = async () => {
    if (!residenceId) return;
    
    setLoading(true);
    try {
      const data = await freezoneService.getAttachments(residenceId);
      console.log('Loaded freezone attachments:', data);
      setAttachments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error loading attachments:', error);
      Swal.fire('Error', 'Failed to load attachments: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId || !selectedFile || !fileType) {
      Swal.fire('Error', 'Please select a file and file type', 'error');
      return;
    }

    setUploading(true);
    try {
      await freezoneService.uploadAttachment(residenceId, fileType, selectedFile);
      Swal.fire('Success', 'File uploaded successfully', 'success');
      setSelectedFile(null);
      setFileType('');
      loadAttachments();
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Delete File',
      text: 'Are you sure you want to delete this file?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
      try {
        await freezoneService.deleteAttachment(id);
        Swal.fire('Success', 'File deleted successfully', 'success');
        loadAttachments();
      } catch (error: any) {
        console.error('Error deleting attachment:', error);
        Swal.fire('Error', error.response?.data?.message || 'Failed to delete file', 'error');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-paperclip"></i> Freezone Attachments</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="text-center py-4">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading attachments...</p>
            </div>
          ) : (
            <>
              {/* Upload Form */}
              <form onSubmit={handleUpload} className="mb-4 p-3 border rounded">
                <h5 className="mb-3">Upload New File</h5>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">File Type <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={fileType}
                      onChange={(e) => setFileType(e.target.value)}
                      placeholder="e.g., passport, eVisa, medical"
                      required
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">File <span className="text-danger">*</span></label>
                    <input
                      type="file"
                      className="form-control"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div className="col-md-2 mb-3 d-flex align-items-end">
                    <button type="submit" className="btn btn-primary w-100" disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Attachments List */}
              <div>
                <h5 className="mb-3">Attachments</h5>
                {attachments.length === 0 ? (
                  <div className="alert alert-info">No attachments found</div>
                ) : (
                  <div className="row">
                    {attachments.map((attachment) => {
                      const fileExt = attachment.file_name.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt);
                      const isPdf = fileExt === 'pdf';
                      
                      return (
                        <div key={attachment.id} className="col-md-4 mb-3">
                          <div className="card">
                            <div className="card-body text-center">
                              {isImage ? (
                                <img
                                  src={getFileUrl(attachment.file_name)}
                                  alt={attachment.original_name}
                                  style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('d-none');
                                  }}
                                />
                              ) : isPdf ? (
                                <object
                                  data={getFileUrl(attachment.file_name)}
                                  type="application/pdf"
                                  width="100%"
                                  height="150px"
                                  style={{ borderRadius: '4px' }}
                                >
                                  <i className={`${getFileIcon(fileExt)} fa-3x text-primary`}></i>
                                </object>
                              ) : (
                                <i className={`${getFileIcon(fileExt)} fa-3x text-primary`}></i>
                              )}
                              <h6 className="mt-2 mb-1" style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
                                {attachment.fileType}
                              </h6>
                              <p className="text-muted small mb-2">{attachment.original_name}</p>
                              <div className="d-flex gap-1 justify-content-center">
                                <a
                                  href={getFileUrl(attachment.file_name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-primary"
                                >
                                  <i className="fa fa-eye"></i>
                                </a>
                                <a
                                  href={getFileUrl(attachment.file_name)}
                                  download
                                  className="btn btn-sm btn-info"
                                >
                                  <i className="fa fa-download"></i>
                                </a>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(attachment.id)}
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
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default FreezoneAttachmentsModal;




