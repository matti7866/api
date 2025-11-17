import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../../utils/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import attachmentsService, { type Attachment, type Folder } from '../../services/attachmentsService';
import './Attachments.css';

interface Breadcrumb {
  id: number | null;
  name: string;
}

export default function Attachments() {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Home' }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadDescription, setUploadDescription] = useState('');
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Fetch folders
  const { data: folders = [], isLoading: foldersLoading, error: foldersError } = useQuery({
    queryKey: ['attachmentsFolders', currentFolderId],
    queryFn: () => attachmentsService.getFolders(currentFolderId || undefined),
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch files
  const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['attachmentsFiles', currentFolderId],
    queryFn: () => attachmentsService.getFiles(currentFolderId || undefined),
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Filter files based on search
  const filteredFiles = files.filter(file =>
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (file.description && file.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => attachmentsService.createFolder(name, currentFolderId || undefined),
    onSuccess: () => {
      Swal.fire('Success', 'Folder created successfully', 'success');
      setShowCreateFolderModal(false);
      setFolderName('');
      queryClient.invalidateQueries({ queryKey: ['attachmentsFolders'] });
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.error || 'Failed to create folder', 'error');
    }
  });

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ files, folderId, description }: { files: File[]; folderId?: number | null; description?: string }) => {
      const results = [];
      for (const file of files) {
        try {
          const result = await attachmentsService.uploadFile(file, folderId, description);
          results.push({ success: true, file: file.name, result });
        } catch (error: any) {
          results.push({ success: false, file: file.name, error: error.message });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0) {
        Swal.fire('Success', `${successCount} file(s) uploaded successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        queryClient.invalidateQueries({ queryKey: ['attachmentsFiles'] });
        setUploadFiles([]);
        setUploadDescription('');
        setShowUploadModal(false);
      } else {
        Swal.fire('Error', 'All uploads failed', 'error');
      }
    },
    onError: () => {
      Swal.fire('Error', 'Upload failed', 'error');
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => attachmentsService.deleteFile(fileId),
    onSuccess: () => {
      Swal.fire('Success', 'File deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['attachmentsFiles'] });
      setSelectedFiles([]);
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.error || 'Failed to delete file', 'error');
    }
  });

  // Delete multiple files mutation
  const deleteMultipleMutation = useMutation({
    mutationFn: (fileIds: number[]) => attachmentsService.deleteMultipleFiles(fileIds),
    onSuccess: (data) => {
      Swal.fire('Success', `${data.deleted || selectedFiles.length} file(s) deleted successfully`, 'success');
      queryClient.invalidateQueries({ queryKey: ['attachmentsFiles'] });
      setSelectedFiles([]);
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.error || 'Failed to delete files', 'error');
    }
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: ({ folderId, force }: { folderId: number; force?: boolean }) => 
      attachmentsService.deleteFolder(folderId, force),
    onSuccess: () => {
      Swal.fire('Success', 'Folder deleted successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['attachmentsFolders'] });
      queryClient.invalidateQueries({ queryKey: ['attachmentsFiles'] });
    },
    onError: (error: any) => {
      const errorData = error.response?.data;
      if (errorData?.needs_confirmation) {
        Swal.fire({
          title: 'Folder Contains Files',
          text: `This folder contains ${errorData.file_count} file(s). Do you want to delete it anyway?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, delete',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            deleteFolderMutation.mutate({ folderId: error.response?.config?.data?.get('delete_folder') || 0, force: true });
          }
        });
      } else {
        Swal.fire('Error', errorData?.error || 'Failed to delete folder', 'error');
      }
    }
  });

  // Handle folder click
  const handleFolderClick = (folder: Folder) => {
    setCurrentFolderId(folder.folder_id);
    setBreadcrumbs(prev => [...prev, { id: folder.folder_id, name: folder.folder_name }]);
    setSelectedFiles([]);
  };

  // Handle breadcrumb click
  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'Home' }]);
    } else {
      const targetBreadcrumb = breadcrumbs[index];
      setCurrentFolderId(targetBreadcrumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
    setSelectedFiles([]);
  };

  // Handle file select
  const handleFileSelect = (fileId: number) => {
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedFiles.length === filteredFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filteredFiles.map(f => f.id));
    }
  };

  // Handle file upload
  const handleFileUpload = (files: FileList | null) => {
    if (files && files.length > 0) {
      setUploadFiles(Array.from(files));
      setShowUploadModal(true);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Handle file preview
  const handleFilePreview = (file: Attachment) => {
    setPreviewFile(file);
    const previewUrl = `${config.baseUrl}/attachmentsController.php?download=${file.id}`;
    setPreviewUrl(previewUrl);
  };

  // Handle file download
  const handleFileDownload = (fileId: number) => {
    attachmentsService.downloadFile(fileId);
  };

  // Get file icon
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const iconMap: { [key: string]: string } = {
      'pdf': 'fa-file-pdf',
      'jpg': 'fa-file-image', 'jpeg': 'fa-file-image', 'png': 'fa-file-image', 'gif': 'fa-file-image',
      'doc': 'fa-file-word', 'docx': 'fa-file-word',
      'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel',
      'ppt': 'fa-file-powerpoint', 'pptx': 'fa-file-powerpoint',
      'zip': 'fa-file-archive', 'rar': 'fa-file-archive',
      'txt': 'fa-file-alt'
    };
    return iconMap[ext] || 'fa-file';
  };

  // Format file size
  const formatFileSize = (size?: string) => {
    return size || 'Unknown';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="attachments-container">
      <div className="attachments-header">
        <h1 className="attachments-title">
          <i className="fa fa-paperclip"></i> Attachments
        </h1>
        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={() => setShowUploadModal(true)}
          >
            <i className="fa fa-upload"></i> Upload Files
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowCreateFolderModal(true)}
          >
            <i className="fa fa-folder-plus"></i> New Folder
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={index} className="breadcrumb-item">
            {index > 0 && <i className="fa fa-chevron-right"></i>}
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={index === breadcrumbs.length - 1 ? 'active' : ''}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Multi-select actions */}
      {selectedFiles.length > 0 && (
        <div className="multi-select-bar">
          <span>{selectedFiles.length} file(s) selected</span>
          <div className="multi-select-actions">
            <button
              className="btn-danger"
              onClick={() => {
                Swal.fire({
                  title: 'Delete Files?',
                  text: `Are you sure you want to delete ${selectedFiles.length} file(s)?`,
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: 'Yes, delete',
                  cancelButtonText: 'Cancel'
                }).then((result) => {
                  if (result.isConfirmed) {
                    deleteMultipleMutation.mutate(selectedFiles);
                  }
                });
              }}
            >
              <i className="fa fa-trash"></i> Delete Selected
            </button>
            <button
              className="btn-secondary"
              onClick={() => setSelectedFiles([])}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        ref={dropzoneRef}
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <i className="fa fa-cloud-upload-alt"></i>
        <p>Drag and drop files here or click to browse</p>
        <small>Maximum file size: 10MB</small>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="folders-section">
          <h3>Folders</h3>
          <div className="folders-grid">
            {folders.map((folder) => (
              <div
                key={folder.folder_id}
                className="folder-card"
                onClick={() => handleFolderClick(folder)}
              >
                <div className="folder-icon">
                  <i className="fa fa-folder"></i>
                </div>
                <div className="folder-name">{folder.folder_name}</div>
                <div className="folder-meta">
                  {folder.created_by && <span>By {folder.created_by}</span>}
                  {folder.is_shared === 1 && <span className="shared-badge">Shared</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div className="files-section">
        <div className="files-header">
          <h3>Files</h3>
          {filteredFiles.length > 0 && (
            <button
              className="btn-link"
              onClick={handleSelectAll}
            >
              {selectedFiles.length === filteredFiles.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        {filesError ? (
          <div className="error-state">
            <i className="fa fa-exclamation-triangle"></i>
            <p>Error loading files</p>
            <small>{(filesError as any)?.response?.data?.error || (filesError as any)?.message || 'Unknown error'}</small>
          </div>
        ) : filesLoading ? (
          <div className="loading-state">
            <i className="fa fa-spinner fa-spin"></i> Loading files...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <i className="fa fa-file"></i>
            <p>No files found</p>
          </div>
        ) : (
          <div className="files-grid">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`file-card ${selectedFiles.includes(file.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="file-checkbox"
                  checked={selectedFiles.includes(file.id)}
                  onChange={() => handleFileSelect(file.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="file-thumbnail"
                  onClick={() => handleFilePreview(file)}
                >
                  {file.thumbnail_url && (file.mimeType === 'image' || file.mimeType === 'pdf') ? (
                    <>
                      <img
                        src={file.thumbnail_url}
                        alt={file.original_name}
                        className="thumbnail-image"
                        onError={(e) => {
                          // Fallback to icon if thumbnail fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const iconDiv = document.createElement('div');
                          iconDiv.className = 'file-icon';
                          iconDiv.innerHTML = `<i class="fa ${getFileIcon(file.original_name)}"></i>`;
                          target.parentElement?.appendChild(iconDiv);
                        }}
                      />
                      <div className="thumbnail-overlay">
                        <i className={`fa ${getFileIcon(file.original_name)}`}></i>
                      </div>
                    </>
                  ) : (
                    <div className="file-icon">
                      <i className={`fa ${getFileIcon(file.original_name)}`}></i>
                    </div>
                  )}
                </div>
                <div className="file-info">
                  <div className="file-name" title={file.original_name}>
                    {file.original_name}
                  </div>
                  <div className="file-meta">
                    {formatFileSize(file.file_size)} • {formatDate(file.upload_date)}
                  </div>
                  {file.description && (
                    <div className="file-description">{file.description}</div>
                  )}
                </div>
                <div className="file-actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleFilePreview(file)}
                    title="Preview"
                  >
                    <i className="fa fa-eye"></i>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleFileDownload(file.id)}
                    title="Download"
                  >
                    <i className="fa fa-download"></i>
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => {
                      Swal.fire({
                        title: 'Delete File?',
                        text: 'Are you sure you want to delete this file?',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Yes, delete',
                        cancelButtonText: 'Cancel'
                      }).then((result) => {
                        if (result.isConfirmed) {
                          deleteFileMutation.mutate(file.id);
                        }
                      });
                    }}
                    title="Delete"
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button className="modal-close" onClick={() => setShowCreateFolderModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-input"
                placeholder="Folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && folderName.trim()) {
                    createFolderMutation.mutate(folderName.trim());
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateFolderModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (folderName.trim()) {
                    createFolderMutation.mutate(folderName.trim());
                  }
                }}
                disabled={createFolderMutation.isPending || !folderName.trim()}
              >
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Files</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Files</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                />
                {uploadFiles.length > 0 && (
                  <div className="upload-files-list">
                    {uploadFiles.map((file, index) => (
                      <div key={index} className="upload-file-item">
                        <i className={`fa ${getFileIcon(file.name)}`}></i>
                        <span>{file.name}</span>
                        <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Add a description..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (uploadFiles.length > 0) {
                    uploadMutation.mutate({
                      files: uploadFiles,
                      folderId: currentFolderId,
                      description: uploadDescription || undefined
                    });
                  }
                }}
                disabled={uploadMutation.isPending || uploadFiles.length === 0}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && previewUrl && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewFile.original_name}</h3>
              <button className="modal-close" onClick={() => setPreviewFile(null)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <iframe src={previewUrl} className="preview-iframe" />
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => handleFileDownload(previewFile.id)}>
                <i className="fa fa-download"></i> Download
              </button>
              <button className="btn-secondary" onClick={() => setPreviewFile(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

