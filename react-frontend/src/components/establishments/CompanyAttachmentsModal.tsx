import { useState, useEffect } from 'react';
import { config } from '../../utils/config';
import axios from '../../services/api';
import Swal from 'sweetalert2';

interface CompanyFile {
  file_id: number;
  file_name: string;
  display_name: string;
  file_path: string;
  file_size: number;
  file_extension: string;
  upload_date: string;
}

interface CompanyAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: number;
  companyName: string;
}

export default function CompanyAttachmentsModal({ isOpen, onClose, companyId, companyName }: CompanyAttachmentsModalProps) {
  const [standardDocs, setStandardDocs] = useState<any>({});
  const [additionalFiles, setAdditionalFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileType, setUploadFileType] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingStandard, setUploadingStandard] = useState(false);
  const [standardUploadType, setStandardUploadType] = useState('');

  useEffect(() => {
    if (isOpen && companyId) {
      loadFiles();
    }
  }, [isOpen, companyId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'getCompanyFiles');
      formData.append('companyId', companyId.toString());

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        setStandardDocs(response.data.company || {});
        setAdditionalFiles(response.data.additionalFiles || []);
      }
    } catch (error: any) {
      console.error('Error loading files:', error);
      Swal.fire('Error', 'Failed to load attachments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!uploadFileType || !uploadFile) {
      Swal.fire('Error', 'Please select file type and a file', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('action', 'uploadCompanyFile');
      formData.append('companyId', companyId.toString());
      formData.append('fileName', uploadFileType);
      formData.append('file', uploadFile);

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        Swal.fire('Success', 'File uploaded successfully', 'success');
        setUploadFileType('');
        setUploadFile(null);
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        loadFiles();
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to upload file', 'error');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to upload file', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadStandardDoc = async (docType: string, file: File) => {
    setUploadingStandard(true);
    setStandardUploadType(docType);
    
    try {
      // First, get current company data
      const loadFormData = new FormData();
      loadFormData.append('action', 'loadCompany');
      loadFormData.append('companyId', companyId.toString());

      const currentData = await axios.post('/establishments/manage-establishments.php', loadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (currentData.data && currentData.data.success && currentData.data.company) {
        const company = currentData.data.company;
        
        // Now update with the new document
        const formData = new FormData();
        formData.append('action', 'updateCompany');
        formData.append('idEdit', companyId.toString());
        formData.append('nameEdit', company.company_name);
        formData.append('typeEdit', company.company_type);
        formData.append('numberEdit', company.company_number);
        formData.append('expiryEdit', company.company_expiry || company.expiry_date);
        formData.append('quotaEdit', company.starting_quota?.toString() || company.quota?.toString() || '0');
        formData.append('usernameEdit', company.username || '');
        formData.append('passwordEdit', company.password || '');
        
        // Append the specific document file
        const fieldMap: any = {
          'letterhead': 'letterHeadEdit',
          'stamp': 'stampEdit',
          'signature': 'signatureEdit',
          'trade_license_copy': 'tradeLicenseEdit',
          'establishment_card': 'establishmentCardEdit'
        };
        
        formData.append(fieldMap[docType], file);

        const response = await axios.post('/establishments/manage-establishments.php', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (response.data && response.data.success) {
          Swal.fire('Success', 'Document uploaded successfully', 'success');
          loadFiles();
        } else {
          Swal.fire('Error', response.data?.message || 'Failed to upload document', 'error');
        }
      } else {
        Swal.fire('Error', 'Failed to load company data', 'error');
      }
    } catch (error: any) {
      console.error('Error uploading standard document:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to upload document', 'error');
    } finally {
      setUploadingStandard(false);
      setStandardUploadType('');
    }
  };

  const handleDelete = async (fileId: number) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the file permanently!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const formData = new FormData();
      formData.append('action', 'deleteCompanyFile');
      formData.append('fileId', fileId.toString());

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        Swal.fire('Deleted!', 'File has been deleted.', 'success');
        loadFiles();
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to delete file', 'error');
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete file', 'error');
    }
  };

  const getFileIcon = (extension: string) => {
    const ext = extension.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'fa-file-image';
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['xls', 'xlsx'].includes(ext)) return 'fa-file-excel';
    return 'fa-file';
  };

  const isImage = (extension: string) => {
    const ext = extension.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  };

  const isPDF = (extension: string) => {
    return extension.toLowerCase() === 'pdf';
  };

  const getFileUrl = (filePath: string) => {
    return `${config.baseUrl}/${filePath}`;
  };

  const getThumbnailUrl = (filePath: string, extension: string) => {
    if (isImage(extension)) {
      return getFileUrl(filePath);
    }
    return null;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' bytes';
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-primary">
            <h3 className="modal-title text-white">
              <i className="fa fa-files-o"></i> Attachments - {companyName}
            </h3>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"></div>
              </div>
            ) : (
              <>
                {/* Standard Documents */}
                <div className="mb-4">
                  <h5>Standard Documents</h5>
                  <div className="row">
                    {[
                      { key: 'letterhead', label: 'Letterhead' },
                      { key: 'stamp', label: 'Stamp' },
                      { key: 'signature', label: 'Signature' },
                      { key: 'trade_license_copy', label: 'Trade License' },
                      { key: 'establishment_card', label: 'Establishment Card' }
                    ].map(doc => {
                      const fileExt = standardDocs[doc.key] ? standardDocs[doc.key].split('.').pop() : '';
                      const filePath = standardDocs[doc.key] ? `letters/${standardDocs[doc.key]}` : '';
                      
                      return (
                        <div key={doc.key} className="col-md-4 mb-3">
                          <div className="border rounded p-3" style={{ minHeight: '200px' }}>
                            <strong className="d-block mb-2">{doc.label}:</strong>
                            {standardDocs[doc.key] ? (
                              <>
                                {/* Thumbnail */}
                                <div 
                                  className="mb-2" 
                                  style={{ 
                                    height: '120px', 
                                    background: '#f5f5f5',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    border: '2px solid #dee2e6'
                                  }}
                                >
                                  {isImage(fileExt) ? (
                                    <img 
                                      src={getFileUrl(filePath)} 
                                      alt={doc.label}
                                      style={{ 
                                        width: '100%', 
                                        height: '100%',
                                        objectFit: 'cover'
                                      }}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML = `<i class="fa fa-file-image" style="font-size: 48px; color: #4CAF50"></i>`;
                                        }
                                      }}
                                    />
                                  ) : isPDF(fileExt) ? (
                                    <object
                                      data={`${getFileUrl(filePath)}#page=1&zoom=50`}
                                      type="application/pdf"
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        pointerEvents: 'none'
                                      }}
                                      title={doc.label}
                                    >
                                      <div style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        height: '100%'
                                      }}>
                                        <i className="fa fa-file-pdf" style={{ fontSize: '48px', color: '#F44336' }}></i>
                                        <span style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>PDF Preview</span>
                                      </div>
                                    </object>
                                  ) : (
                                    <i className={`fa ${getFileIcon(fileExt)}`} style={{ fontSize: '48px', color: '#2196F3' }}></i>
                                  )}
                                </div>
                                
                                <div className="d-flex gap-1 flex-wrap">
                                  <a 
                                    href={getFileUrl(filePath)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-primary"
                                    style={{ flex: '1' }}
                                  >
                                    <i className="fa fa-eye"></i>
                                  </a>
                                  <a 
                                    href={getFileUrl(filePath)} 
                                    download
                                    className="btn btn-sm btn-info"
                                  >
                                    <i className="fa fa-download"></i>
                                  </a>
                                  <label className="btn btn-sm btn-warning mb-0" style={{ flex: '1' }}>
                                    <i className="fa fa-upload"></i>
                                    <input
                                      type="file"
                                      className="d-none"
                                      accept="image/*,.pdf"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUploadStandardDoc(doc.key, file);
                                      }}
                                      disabled={uploadingStandard && standardUploadType === doc.key}
                                    />
                                  </label>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Empty state */}
                                <div 
                                  className="mb-2" 
                                  style={{ 
                                    height: '120px', 
                                    background: '#f8f9fa',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '2px dashed #dee2e6'
                                  }}
                                >
                                  <div className="text-center">
                                    <i className="fa fa-upload text-muted" style={{ fontSize: '36px', opacity: 0.5 }}></i>
                                    <p className="text-muted small mb-0 mt-2">Not uploaded</p>
                                  </div>
                                </div>
                                
                                <label className="btn btn-sm btn-success w-100 mb-0">
                                  <i className="fa fa-upload"></i> {uploadingStandard && standardUploadType === doc.key ? 'Uploading...' : 'Upload'}
                                  <input
                                    type="file"
                                    className="d-none"
                                    accept="image/*,.pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadStandardDoc(doc.key, file);
                                    }}
                                    disabled={uploadingStandard && standardUploadType === doc.key}
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <hr />

                {/* Upload New File */}
                <div className="mb-4">
                  <h5>Upload Additional Document</h5>
                  <form onSubmit={handleUpload}>
                    <div className="row">
                      <div className="col-md-4 mb-2">
                        <select
                          className="form-select"
                          value={uploadFileType}
                          onChange={(e) => setUploadFileType(e.target.value)}
                          required
                        >
                          <option value="">Select document type</option>
                          <option value="Contract">Contract</option>
                          <option value="Agreement">Agreement</option>
                          <option value="Invoice">Invoice</option>
                          <option value="Receipt">Receipt</option>
                          <option value="Certificate">Certificate</option>
                          <option value="License">License</option>
                          <option value="Permit">Permit</option>
                          <option value="Insurance">Insurance</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="col-md-5 mb-2">
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          required
                        />
                      </div>
                      <div className="col-md-3 mb-2">
                        <button 
                          type="submit" 
                          className="btn btn-success w-100"
                          disabled={uploading}
                        >
                          {uploading ? (
                            <><i className="fa fa-spinner fa-spin"></i> Uploading...</>
                          ) : (
                            <><i className="fa fa-upload"></i> Upload</>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                <hr />

                {/* Additional Files */}
                <div>
                  <h5>Additional Files ({additionalFiles.length})</h5>
                  {additionalFiles.length === 0 ? (
                    <p className="text-muted">No additional files uploaded.</p>
                  ) : (
                    <div className="row">
                      {additionalFiles.map(file => {
                        const thumbnailUrl = getThumbnailUrl(file.file_path, file.file_extension);
                        
                        return (
                          <div key={file.file_id} className="col-md-3 mb-3">
                            <div className="border rounded p-2" style={{ minHeight: '250px' }}>
                              {/* Thumbnail */}
                              <div 
                                className="position-relative"
                                style={{ 
                                  height: '140px', 
                                  background: isImage(file.file_extension) || isPDF(file.file_extension) ? '#f8f9fa' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  cursor: 'pointer'
                                }}
                                onClick={() => window.open(getFileUrl(file.file_path), '_blank')}
                              >
                                {isImage(file.file_extension) ? (
                                  <img 
                                    src={getFileUrl(file.file_path)} 
                                    alt={file.display_name}
                                    style={{ 
                                      width: '100%', 
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const iconData = getFileIcon(file.file_extension);
                                        parent.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                                        parent.innerHTML = `<i class="fa ${iconData}" style="font-size: 64px; color: white"></i>`;
                                      }
                                    }}
                                  />
                                ) : isPDF(file.file_extension) ? (
                                  <object
                                    data={`${getFileUrl(file.file_path)}#page=1&zoom=50`}
                                    type="application/pdf"
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      border: 'none',
                                      pointerEvents: 'none'
                                    }}
                                    title={file.display_name}
                                  >
                                    <div style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      height: '100%'
                                    }}>
                                      <i className="fa fa-file-pdf" style={{ fontSize: '64px', color: '#F44336', marginBottom: '10px' }}></i>
                                      <span style={{ fontSize: '12px', color: '#666' }}>PDF Preview</span>
                                    </div>
                                  </object>
                                ) : (
                                  <i className={`fa ${getFileIcon(file.file_extension)}`} style={{ fontSize: '64px', color: 'white' }}></i>
                                )}
                                
                                {/* File Type Badge */}
                                <span 
                                  className="badge bg-primary position-absolute top-0 start-0 m-2" 
                                  style={{ fontSize: '10px' }}
                                >
                                  {file.display_name.toUpperCase()}
                                </span>
                              </div>
                              
                              {/* File Info */}
                              <div className="mb-2">
                                <strong 
                                  className="d-block text-truncate" 
                                  title={file.display_name}
                                  style={{ fontSize: '0.9rem' }}
                                >
                                  {file.display_name}
                                </strong>
                                <small className="text-muted d-block">
                                  {formatFileSize(file.file_size)}
                                </small>
                                <small className="text-muted d-block">
                                  {new Date(file.upload_date).toLocaleDateString()}
                                </small>
                              </div>
                              
                              {/* Actions */}
                              <div className="d-flex gap-1">
                                <a
                                  href={getFileUrl(file.file_path)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-primary flex-grow-1"
                                >
                                  <i className="fa fa-eye"></i>
                                </a>
                                <a
                                  href={getFileUrl(file.file_path)}
                                  download
                                  className="btn btn-sm btn-info"
                                >
                                  <i className="fa fa-download"></i>
                                </a>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(file.file_id)}
                                >
                                  <i className="fa fa-trash"></i>
                                </button>
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

