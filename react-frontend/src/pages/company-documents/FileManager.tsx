import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../../utils/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import companyDocumentsService from '../../services/companyDocumentsService';
import type { TreeNode } from '../../types/companyDocuments';
import logger from '../../utils/logger';
import './FileManager.css';

interface FileItem {
  id: number;
  name: string;
  type: 'folder' | 'file';
  parentId?: number;
  children?: FileItem[];
  size?: number;
  modified?: string;
  isPublic?: boolean;
  userId?: number | null;
  extension?: string;
  mimeType?: string;
  thumbnailUrl?: string;
}

interface Column {
  id: string;
  folderId: number | null;
  items: FileItem[];
  selectedId: number | null;
}

export default function FileManager() {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<Column[]>([{ id: 'root', folderId: null, items: [], selectedId: null }]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: number | null; name: string }>>([{ id: null, name: 'All Folders' }]);
  const [currentView, setCurrentView] = useState<'public' | 'private' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isPublicFolder, setIsPublicFolder] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);
  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null);
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get file extension and type
  const getFileInfo = useCallback((fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const pdfTypes = ['pdf'];
    const documentTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
    
    let mimeType = 'file';
    if (imageTypes.includes(extension)) mimeType = 'image';
    else if (pdfTypes.includes(extension)) mimeType = 'pdf';
    else if (documentTypes.includes(extension)) mimeType = 'document';
    else if (archiveTypes.includes(extension)) mimeType = 'archive';
    else if (extension === 'txt') mimeType = 'text';
    
    return { extension, mimeType };
  }, []);
  
  // Get file icon class
  const getFileIcon = useCallback((fileName: string) => {
    const { extension, mimeType } = getFileInfo(fileName);
    
    const iconMap: { [key: string]: string } = {
      'image': 'fa-file-image',
      'pdf': 'fa-file-pdf',
      'document': extension === 'doc' || extension === 'docx' ? 'fa-file-word' : 
                  extension === 'xls' || extension === 'xlsx' ? 'fa-file-excel' :
                  extension === 'ppt' || extension === 'pptx' ? 'fa-file-powerpoint' : 'fa-file-alt',
      'archive': 'fa-file-archive',
      'text': 'fa-file-alt',
      'file': 'fa-file'
    };
    
    return iconMap[mimeType] || 'fa-file';
  }, [getFileInfo]);

  // Convert tree structure to flat structure and separate Public/Private
  const convertTreeToFiles = useCallback((tree: TreeNode[]): { public: FileItem[]; private: FileItem[] } => {
    const publicItems: FileItem[] = [];
    const privateItems: FileItem[] = [];
    
    tree.forEach(node => {
      const isFile = node.isFile === 'true';
      const fileInfo = isFile ? getFileInfo(node.text) : { extension: '', mimeType: 'folder' };
      
      const parentId = node.parent === '#' ? null : (typeof node.parent === 'number' ? node.parent : null);
      const thumbnailUrl = isFile && (fileInfo.mimeType === 'image' || fileInfo.mimeType === 'pdf') 
        ? `${config.baseUrl}/generateThumbnail.php?CustomID=${node.customID}&ParentCustomID=${parentId || 0}`
        : undefined;
      
      const item: FileItem = {
        id: node.customID,
        name: node.text,
        type: isFile ? 'file' : 'folder',
        parentId: parentId,
        children: node.children?.map(child => {
          const childFileInfo = child.isFile === 'true' ? getFileInfo(child.text) : { extension: '', mimeType: 'folder' };
          const childParentId = node.customID;
          const childThumbnailUrl = child.isFile === 'true' && (childFileInfo.mimeType === 'image' || childFileInfo.mimeType === 'pdf')
            ? `${config.baseUrl}/generateThumbnail.php?CustomID=${child.customID}&ParentCustomID=${childParentId}`
            : undefined;
          return {
            id: child.customID,
            name: child.text,
            type: child.isFile === 'true' ? 'file' : 'folder',
            parentId: node.customID,
            extension: child.isFile === 'true' ? childFileInfo.extension : undefined,
            mimeType: child.isFile === 'true' ? childFileInfo.mimeType : undefined,
            thumbnailUrl: childThumbnailUrl
          };
        }),
        // Check if it's Public folder (name is "Public" or is_public flag)
        isPublic: node.text === 'Public' || node.is_public === 1 || node.user_id === null,
        extension: isFile ? fileInfo.extension : undefined,
        mimeType: isFile ? fileInfo.mimeType : undefined,
        thumbnailUrl: thumbnailUrl
      };
      
      if (item.isPublic || item.name === 'Public') {
        publicItems.push(item);
      } else {
        privateItems.push(item);
      }
    });
    
    return { public: publicItems, private: privateItems };
  }, []);

  // Find folder in tree
  const findFolderInTree = useCallback((folderId: number, tree: TreeNode[]): TreeNode | null => {
    for (const node of tree) {
      if (node.customID === folderId) {
        return node;
      }
      if (node.children) {
        const found = findFolderInTree(folderId, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['companyDocuments'],
    queryFn: () => companyDocumentsService.getDocuments(),
    refetchOnWindowFocus: false
  });

  // Helper function to rebuild columns from breadcrumbs
  const rebuildColumnsFromBreadcrumbs = useCallback((docs: TreeNode[], crumbs: Array<{ id: number | null; name: string }>) => {
    if (crumbs.length === 1 && crumbs[0].id === null) {
      // At root - show root items
      const { public: publicItems, private: privateItems } = convertTreeToFiles(docs);
      let rootItems: FileItem[] = [];
      if (currentView === 'all') {
        rootItems = [...publicItems, ...privateItems];
      } else if (currentView === 'public') {
        rootItems = publicItems;
      } else {
        rootItems = privateItems;
      }
      return [{ id: 'root', folderId: null, items: rootItems, selectedId: null }];
    }
    
    // Rebuild columns based on breadcrumbs path
    const { public: publicItems, private: privateItems } = convertTreeToFiles(docs);
    let rootItems: FileItem[] = [];
    if (currentView === 'all') {
      rootItems = [...publicItems, ...privateItems];
    } else if (currentView === 'public') {
      rootItems = publicItems;
    } else {
      rootItems = privateItems;
    }
    
    const rebuiltColumns: Column[] = [{ id: 'root', folderId: null, items: rootItems, selectedId: null }];
    
    // Navigate through breadcrumbs to rebuild path
    for (let i = 1; i < crumbs.length; i++) {
      const crumb = crumbs[i];
      if (crumb.id === null) continue;
      
      const parentColumn = rebuiltColumns[rebuiltColumns.length - 1];
      const parentItem = parentColumn.items.find(item => item.id === crumb.id);
      
      if (parentItem && parentItem.type === 'folder') {
        // Mark as selected
        parentColumn.selectedId = parentItem.id;
        
        // Get children
        const folderNode = findFolderInTree(parentItem.id, docs);
        const children: FileItem[] = folderNode?.children?.map(child => {
          const childFileInfo = child.isFile === 'true' ? getFileInfo(child.text) : { extension: '', mimeType: 'folder' };
          const childThumbnailUrl = child.isFile === 'true' && (childFileInfo.mimeType === 'image' || childFileInfo.mimeType === 'pdf')
            ? `${config.baseUrl}/generateThumbnail.php?CustomID=${child.customID}&ParentCustomID=${parentItem.id}`
            : undefined;
          return {
            id: child.customID,
            name: child.text,
            type: child.isFile === 'true' ? 'file' : 'folder',
            parentId: parentItem.id,
            isPublic: child.text === 'Public' || child.is_public === 1 || child.user_id === null,
            extension: child.isFile === 'true' ? childFileInfo.extension : undefined,
            mimeType: child.isFile === 'true' ? childFileInfo.mimeType : undefined,
            thumbnailUrl: childThumbnailUrl,
            children: child.children?.map(grandchild => ({
              id: grandchild.customID,
              name: grandchild.text,
              type: grandchild.isFile === 'true' ? 'file' : 'folder',
              parentId: child.customID
            }))
          };
        }) || [];
        
        rebuiltColumns.push({
          id: `col-${parentItem.id}`,
          folderId: parentItem.id,
          items: children,
          selectedId: null
        });
      }
    }
    
    return rebuiltColumns;
  }, [convertTreeToFiles, currentView, findFolderInTree, getFileInfo]);

  // Initialize columns when documents load - preserve current navigation state
  useEffect(() => {
    if (documents.length > 0) {
      const rebuiltColumns = rebuildColumnsFromBreadcrumbs(documents, breadcrumbs);
      setColumns(rebuiltColumns);
    }
  }, [documents, rebuildColumnsFromBreadcrumbs, breadcrumbs]);

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (data: { folderName: string; isPublic: boolean }) =>
      companyDocumentsService.createFolder({ 
        Foler_Name: data.folderName,
        isPublic: data.isPublic ? '1' : '0'
      }),
    onSuccess: (response) => {
      if (response.msg === 'success') {
        Swal.fire('Success', 'Folder created successfully', 'success');
        setFolderName('');
        setIsPublicFolder(false);
        setShowCreateModal(false);
        queryClient.invalidateQueries({ queryKey: ['companyDocuments'] });
      } else {
        Swal.fire('Error', response.msgDetails || 'Failed to create folder', 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.msgDetails || 'Failed to create folder', 'error');
    }
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (data: { file: File; directoryId: number; agree?: number }) => {
      // Ensure file object is preserved
      const file = data.file;
      
      logger.debug('mutationFn received:', {
        file: file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        directoryId: data.directoryId,
        fileConstructor: file?.constructor?.name,
        isFile: file instanceof File,
        isBlob: file instanceof Blob
      });
      
      if (!file || !file.name || file.size === undefined) {
        logger.error('Invalid file in mutationFn:', file);
        throw new Error('Invalid file object passed to mutation');
      }
      
      return companyDocumentsService.uploadFile({
        uploadFile: file,
        DID: data.directoryId,
        Agree: data.agree
      });
    },
    onSuccess: (response) => {
      if (response.msg === 'success') {
        Swal.fire('Success', response.msgDetails || 'File uploaded successfully', 'success');
        setSelectedFile(null);
        setSelectedDirectoryId(null);
        setShowUploadModal(false);
        setIsDraggingFiles(false);
        setDragOverFolder(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        queryClient.invalidateQueries({ queryKey: ['companyDocuments'] });
      } else if (response.msg === 'info') {
        Swal.fire({
          title: 'File Exists',
          text: response.msgDetails || 'File already exists. Do you want to replace it?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Yes, replace it',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed && selectedFile && selectedDirectoryId) {
            uploadFileMutation.mutate({
              file: selectedFile,
              directoryId: selectedDirectoryId,
              agree: 1
            });
          }
        });
      } else {
        Swal.fire('Error', response.msgDetails || 'Failed to upload file', 'error');
      }
    },
    onError: (error: any) => {
      let errorMessage = 'Failed to upload file';
      
      if (error.response?.data?.msgDetails) {
        errorMessage = error.response.data.msgDetails;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      logger.error('Upload error details:', {
        message: errorMessage,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        error: error
      });
      
      Swal.fire({
        title: 'Upload Failed',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (data: { customID: number; parentCustomID?: number; isFile: 'true' | 'false' }) =>
      companyDocumentsService.deleteItem({
        CustomID: data.customID,
        ParentCustomID: data.parentCustomID,
        IsFile: data.isFile
      }),
    onSuccess: (response) => {
      if (response.msg === 'success') {
        Swal.fire('Success', response.msgDetails || 'Item deleted successfully', 'success');
        queryClient.invalidateQueries({ queryKey: ['companyDocuments'] });
        // Reset to root if deleted item was in current path
        setColumns([{ id: 'root', folderId: null, items: convertTreeToFiles(documents), selectedId: null }]);
        setBreadcrumbs([{ id: null, name: 'All Folders' }]);
      } else {
        Swal.fire('Error', response.msgDetails || 'Failed to delete item', 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.msgDetails || 'Failed to delete item', 'error');
    }
  });

  // Handle folder click - navigate into folder
  const handleFolderClick = (item: FileItem, columnIndex: number) => {
    // Remove columns after this one
    const newColumns = columns.slice(0, columnIndex + 1);
    
    // Update selected item in current column
    newColumns[columnIndex].selectedId = item.id;
    
    // Find children of this folder in the tree
    const folderNode = findFolderInTree(item.id, documents);
    const children: FileItem[] = folderNode?.children?.map(child => {
      const childFileInfo = child.isFile === 'true' ? getFileInfo(child.text) : { extension: '', mimeType: 'folder' };
      const childThumbnailUrl = child.isFile === 'true' && (childFileInfo.mimeType === 'image' || childFileInfo.mimeType === 'pdf')
        ? `${config.baseUrl}/generateThumbnail.php?CustomID=${child.customID}&ParentCustomID=${item.id}`
        : undefined;
      return {
        id: child.customID,
        name: child.text,
        type: child.isFile === 'true' ? 'file' : 'folder',
        parentId: item.id,
        isPublic: child.text === 'Public' || child.is_public === 1 || child.user_id === null,
        extension: child.isFile === 'true' ? childFileInfo.extension : undefined,
        mimeType: child.isFile === 'true' ? childFileInfo.mimeType : undefined,
        thumbnailUrl: childThumbnailUrl,
        children: child.children?.map(grandchild => ({
          id: grandchild.customID,
          name: grandchild.text,
          type: grandchild.isFile === 'true' ? 'file' : 'folder',
          parentId: child.customID
        }))
      };
    }) || [];
    
    // Add new column
    newColumns.push({
      id: `col-${item.id}`,
      folderId: item.id,
      items: children,
      selectedId: null
    });
    
    setColumns(newColumns);
    
    // Update breadcrumbs
    const newBreadcrumbs = breadcrumbs.slice(0, columnIndex + 1);
    newBreadcrumbs.push({ id: item.id, name: item.name });
    setBreadcrumbs(newBreadcrumbs);
  };

  // Handle breadcrumb click
  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      // Go to root
      const { public: publicItems, private: privateItems } = convertTreeToFiles(documents);
      let rootItems: FileItem[] = [];
      if (currentView === 'all') {
        rootItems = [...publicItems, ...privateItems];
      } else if (currentView === 'public') {
        rootItems = publicItems;
      } else {
        rootItems = privateItems;
      }
      setColumns([{ id: 'root', folderId: null, items: rootItems, selectedId: null }]);
      setBreadcrumbs([{ id: null, name: 'All Folders' }]);
    } else {
      // Navigate to specific folder - rebuild columns up to this point
      const targetBreadcrumb = breadcrumbs[index];
      const { public: publicItems, private: privateItems } = convertTreeToFiles(documents);
      let rootItems: FileItem[] = [];
      if (currentView === 'all') {
        rootItems = [...publicItems, ...privateItems];
      } else if (currentView === 'public') {
        rootItems = publicItems;
      } else {
        rootItems = privateItems;
      }
      
      const newColumns: Column[] = [{ id: 'root', folderId: null, items: rootItems, selectedId: null }];
      const newBreadcrumbs = [{ id: null, name: 'All Folders' }];
      
      // Rebuild path
      for (let i = 1; i <= index; i++) {
        const crumb = breadcrumbs[i];
        const parentColumn = newColumns[newColumns.length - 1];
        const folderNode = findFolderInTree(crumb.id!, documents);
        
        if (folderNode) {
          parentColumn.selectedId = crumb.id!;
          const children: FileItem[] = folderNode.children?.map(child => ({
            id: child.customID,
            name: child.text,
            type: child.isFile === 'true' ? 'file' : 'folder',
            parentId: crumb.id!,
            isPublic: child.text === 'Public' || (child as any).is_public === 1
          })) || [];
          
          newColumns.push({
            id: `col-${crumb.id}`,
            folderId: crumb.id!,
            items: children,
            selectedId: null
          });
          newBreadcrumbs.push(crumb);
        }
      }
      
      setColumns(newColumns);
      setBreadcrumbs(newBreadcrumbs);
    }
  };

  // Handle file preview
  const handleFilePreview = (item: FileItem) => {
    if (item.type === 'file') {
      const { mimeType } = getFileInfo(item.name);
      if (mimeType === 'image' || mimeType === 'pdf') {
        const parentId = columns[columns.length - 1].folderId || item.parentId || 0;
        const previewUrl = `${config.baseUrl}/downloadCompanyFiles.php?CustomID=${item.id}&ParentCustomID=${parentId}&preview=1`;
        setPreviewItem(item);
        setPreviewUrl(previewUrl);
      } else {
        // For other files, just download
        handleFileDownload(item);
      }
    }
  };
  
  // Handle file download
  const handleFileDownload = (item: FileItem) => {
    if (item.type === 'file') {
      const parentId = columns[columns.length - 1].folderId || item.parentId || 0;
      companyDocumentsService.downloadFile(item.id, parentId);
    }
  };
  
  // Handle file double click
  const handleFileDoubleClick = (item: FileItem) => {
    if (item.type === 'file') {
      handleFilePreview(item);
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Handle create folder
  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      Swal.fire('Error', 'Please enter folder name', 'error');
      return;
    }
    createFolderMutation.mutate({ 
      folderName: folderName.trim(),
      isPublic: isPublicFolder
    });
  };

  // Handle upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10485760) {
        Swal.fire('Error', 'File size is greater than 10 MB. Please select a file less than 10 MB', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = (file?: File, directoryId?: number) => {
    const fileToUpload = file || selectedFile;
    const dirId = directoryId !== undefined ? directoryId : selectedDirectoryId;
    
    logger.debug('handleUpload called:', {
      fileProvided: !!file,
      selectedFile: !!selectedFile,
      fileToUpload: fileToUpload,
      fileName: fileToUpload?.name,
      fileSize: fileToUpload?.size,
      directoryIdProvided: directoryId,
      selectedDirectoryId: selectedDirectoryId,
      finalDirId: dirId
    });
    
    if (!fileToUpload) {
      Swal.fire('Error', 'Please select a file', 'error');
      return;
    }
    
    // Validate file object properties
    if (!fileToUpload.name) {
      logger.error('File missing name in handleUpload:', fileToUpload);
      Swal.fire('Error', 'File is missing name property', 'error');
      return;
    }
    
    if (fileToUpload.size === undefined || fileToUpload.size === null) {
      logger.error('File missing size in handleUpload:', fileToUpload);
      Swal.fire('Error', 'File is missing size property', 'error');
      return;
    }
    
    if (dirId === null || dirId === undefined) {
      Swal.fire('Error', 'Please select a folder first. Right-click on a folder and select "Upload File Here"', 'error');
      return;
    }
    
    if (fileToUpload.size > 10485760) {
      Swal.fire('Error', 'File size is greater than 10 MB. Please select a file less than 10 MB', 'error');
      return;
    }
    
    logger.debug('Calling uploadFileMutation with:', {
      fileName: fileToUpload.name,
      fileSize: fileToUpload.size,
      fileType: fileToUpload.type,
      directoryId: dirId,
      fileConstructor: fileToUpload.constructor.name
    });
    
    uploadFileMutation.mutate({
      file: fileToUpload,
      directoryId: dirId
    });
  };

  // Handle drag and drop for files
  const handleDragEnter = (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFiles(true);
      if (folderId !== null) {
        setDragOverFolder(folderId);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      if (folderId !== null) {
        setDragOverFolder(folderId);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear if we're leaving the folder area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverFolder(null);
    }
  };

  const handleDrop = (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingFiles(false);
    setDragOverFolder(null);
    
    if (folderId === null) {
      Swal.fire('Info', 'Please drop files on a specific folder', 'info');
      return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      logger.debug('No files in drop event');
      Swal.fire('Error', 'No files detected in drop event', 'error');
      return;
    }
    
    // Upload first file (can extend to multiple files later)
    const file = files[0];
    
    logger.debug('File dropped - raw file object:', {
      file: file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      folderId: folderId,
      fileKeys: file ? Object.keys(file) : [],
      fileConstructor: file?.constructor?.name,
      isFile: file instanceof File,
      isBlob: file instanceof Blob
    });
    
    // Validate file object
    if (!file) {
      Swal.fire('Error', 'No file selected', 'error');
      return;
    }
    
    // Check if file has required properties
    if (!file.name) {
      logger.error('File missing name property:', file);
      Swal.fire('Error', 'File is missing name property', 'error');
      return;
    }
    
    if (file.size === undefined || file.size === null) {
      logger.error('File missing size property:', file);
      Swal.fire('Error', 'File is missing size property', 'error');
      return;
    }
    
    if (file.size > 10485760) {
      Swal.fire('Error', 'File size is greater than 10 MB. Please select a file less than 10 MB', 'error');
      return;
    }
    
    logger.debug('File validated successfully, uploading:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folderId: folderId
    });
    
    handleUpload(file, folderId);
  };

  // Handle container drag events for root level
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFiles(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingFiles(false);
      setDragOverFolder(null);
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingFiles(false);
    setDragOverFolder(null);
    
    // Get the current folder (last column's folderId)
    const currentFolderId = columns[columns.length - 1].folderId;
    
    if (currentFolderId === null) {
      Swal.fire({
        title: 'Select a Folder',
        text: 'Please drop files on a specific folder, or navigate into a folder first',
        icon: 'info',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      logger.debug('No files in container drop event');
      Swal.fire('Error', 'No files detected in drop event', 'error');
      return;
    }
    
    // Upload first file to current folder
    const file = files[0];
    
    logger.debug('File dropped on container - raw file object:', {
      file: file,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      currentFolderId: currentFolderId,
      fileKeys: file ? Object.keys(file) : [],
      fileConstructor: file?.constructor?.name,
      isFile: file instanceof File,
      isBlob: file instanceof Blob
    });
    
    // Validate file object
    if (!file) {
      Swal.fire('Error', 'No file selected', 'error');
      return;
    }
    
    // Check if file has required properties
    if (!file.name) {
      logger.error('File missing name property:', file);
      Swal.fire('Error', 'File is missing name property', 'error');
      return;
    }
    
    if (file.size === undefined || file.size === null) {
      logger.error('File missing size property:', file);
      Swal.fire('Error', 'File is missing size property', 'error');
      return;
    }
    
    if (file.size > 10485760) {
      Swal.fire('Error', 'File size is greater than 10 MB. Please select a file less than 10 MB', 'error');
      return;
    }
    
    logger.debug('File validated successfully, uploading:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      currentFolderId: currentFolderId
    });
    
    handleUpload(file, currentFolderId);
  };

  // Handle delete
  const handleDelete = (item: FileItem) => {
    Swal.fire({
      title: 'Are you sure?',
      text: item.type === 'file' 
        ? `Delete "${item.name}"?` 
        : `Delete folder "${item.name}" and all its contents?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        const parentId = item.parentId || columns[columns.length - 1].folderId;
        deleteMutation.mutate({
          customID: item.id,
          parentCustomID: parentId || undefined,
          isFile: item.type === 'file' ? 'true' : 'false'
        });
      }
    });
  };

  // Handle rename
  const handleRename = () => {
    if (!renameName.trim() || !renameItem) {
      Swal.fire('Error', 'Please enter a new name', 'error');
      return;
    }
    // TODO: Implement rename API call
    Swal.fire('Info', 'Rename functionality will be implemented soon', 'info');
    setShowRenameModal(false);
    setRenameName('');
    setRenameItem(null);
  };

  // Filter items by search
  const filteredItems = (items: FileItem[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  };

  // Get current column items
  const currentItems = columns.length > 0 
    ? filteredItems(columns[columns.length - 1].items)
    : [];

  return (
    <div className="file-manager" ref={containerRef}>
      {/* Header */}
      <div className="file-manager-header">
        <div className="file-manager-title">
          <i className="fa fa-folder-open"></i>
          <span>Company Documents</span>
        </div>
        <div className="file-manager-actions">
          <div className="view-toggle">
            <button
              className={`view-btn ${currentView === 'all' ? 'active' : ''}`}
              onClick={() => setCurrentView('all')}
              title="All Folders"
            >
              <i className="fa fa-th"></i>
              <span>All</span>
            </button>
            <button
              className={`view-btn ${currentView === 'public' ? 'active' : ''}`}
              onClick={() => setCurrentView('public')}
              title="Public Folders"
            >
              <i className="fa fa-globe"></i>
              <span>Public</span>
            </button>
            <button
              className={`view-btn ${currentView === 'private' ? 'active' : ''}`}
              onClick={() => setCurrentView('private')}
              title="My Folders"
            >
              <i className="fa fa-user"></i>
              <span>My Files</span>
            </button>
          </div>
          <div className="search-box">
            <i className="fa fa-search"></i>
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className="btn-action"
            onClick={() => {
              const currentFolderId = columns[columns.length - 1].folderId;
              if (currentFolderId === null) {
                Swal.fire({
                  title: 'Select Folder',
                  text: 'Please right-click on a folder and select "Upload File Here", or double-click to open a folder first.',
                  icon: 'info',
                  confirmButtonText: 'OK'
                });
                return;
              }
              setSelectedDirectoryId(currentFolderId);
              setShowUploadModal(true);
            }}
            title="Upload File (Select a folder first)"
          >
            <i className="fa fa-upload"></i>
            <span>Upload</span>
          </button>
          <button
            className="btn-action btn-primary"
            onClick={() => {
              setIsPublicFolder(false);
              setShowCreateModal(true);
            }}
            title="New Folder"
          >
            <i className="fa fa-folder-plus"></i>
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="breadcrumb-nav">
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

      {/* Column View */}
      <div 
        className={`file-manager-columns ${isDraggingFiles ? 'drag-over-active' : ''}`}
        data-drop-message={columns[columns.length - 1].folderId !== null 
          ? `Drop files here to upload to current folder` 
          : 'Drop files on a folder to upload'}
        onDragOver={handleContainerDragOver}
        onDragLeave={handleContainerDragLeave}
        onDrop={handleContainerDrop}
      >
        {isLoading ? (
          <div className="loading-state">
            <i className="fa fa-spinner fa-spin fa-2x"></i>
            <p>Loading documents...</p>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="empty-state">
            <i className="fa fa-folder-open fa-3x"></i>
            <p>{searchQuery ? 'No files match your search' : 'This folder is empty'}</p>
            {!searchQuery && (
              <button
                className="btn-action btn-primary"
                onClick={() => {
                  setIsPublicFolder(false);
                  setShowCreateModal(true);
                }}
              >
                <i className="fa fa-folder-plus"></i>
                Create Folder
              </button>
            )}
          </div>
        ) : (
          <div className="file-grid">
            {currentItems.map((item) => (
              <div
                key={item.id}
                className={`file-item ${item.type} ${item.isPublic ? 'public-folder' : ''} ${dragOverFolder === item.id ? 'drag-over-folder' : ''}`}
                onDoubleClick={() => {
                  if (item.type === 'folder') {
                    handleFolderClick(item, columns.length - 1);
                  } else {
                    handleFileDoubleClick(item);
                  }
                }}
                onClick={(e) => {
                  if (item.type === 'folder' && e.detail === 1) {
                    // Single click - could be used for selection in future
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, item)}
                draggable={item.type === 'folder'}
                onDragStart={(e) => {
                  if (item.type === 'folder') {
                    setDraggedItem(item);
                    e.dataTransfer.effectAllowed = 'move';
                  }
                }}
                onDragEnter={(e) => {
                  if (item.type === 'folder' && isDraggingFiles) {
                    handleDragEnter(e, item.id);
                  } else if (item.type === 'folder') {
                    e.preventDefault();
                    e.currentTarget.classList.add('drag-over');
                  }
                }}
                onDragOver={(e) => {
                  if (item.type === 'folder' && isDraggingFiles) {
                    handleDragOver(e, item.id);
                  } else if (item.type === 'folder') {
                    e.preventDefault();
                    e.currentTarget.classList.add('drag-over');
                  }
                }}
                onDragLeave={(e) => {
                  if (item.type === 'folder' && isDraggingFiles) {
                    handleDragLeave(e);
                  } else {
                    e.currentTarget.classList.remove('drag-over');
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove('drag-over');
                  
                  if (isDraggingFiles && item.type === 'folder') {
                    // Handle file drop
                    handleDrop(e, item.id);
                  } else if (draggedItem && item.type === 'folder' && draggedItem.id !== item.id) {
                    // Handle folder move
                    // TODO: Implement move functionality
                    Swal.fire('Info', 'Move functionality will be implemented soon', 'info');
                  }
                }}
              >
                <div className="file-icon-container">
                  {item.type === 'folder' ? (
                    <div className="file-icon">
                      <i className={`fa fa-folder ${item.isPublic ? 'public' : ''}`}></i>
                    </div>
                  ) : item.thumbnailUrl && (item.mimeType === 'image' || item.mimeType === 'pdf') ? (
                    <div className="file-thumbnail">
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.name}
                        className="thumbnail-image"
                        onError={(e) => {
                          // Fallback to icon if thumbnail fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const iconDiv = document.createElement('div');
                          iconDiv.className = 'file-icon';
                          iconDiv.innerHTML = `<i class="fa ${getFileIcon(item.name)}"></i>`;
                          target.parentElement?.appendChild(iconDiv);
                        }}
                      />
                      <div className="thumbnail-overlay">
                        <i className={`fa ${getFileIcon(item.name)}`}></i>
                      </div>
                    </div>
                  ) : (
                    <div className="file-icon">
                      <i className={`fa ${getFileIcon(item.name)}`}></i>
                    </div>
                  )}
                </div>
                <div className="file-name" title={item.name}>
                  {item.name}
                  {item.isPublic && (
                    <span className="public-badge" title="Public Folder - Visible to all staff">
                      <i className="fa fa-globe"></i>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item.type === 'folder' && (
            <>
              <button onClick={() => {
                setSelectedDirectoryId(contextMenu.item.id);
                setShowUploadModal(true);
                setContextMenu(null);
              }}>
                <i className="fa fa-upload"></i> Upload File Here
              </button>
              <button onClick={() => {
                setRenameItem(contextMenu.item);
                setRenameName(contextMenu.item.name);
                setShowRenameModal(true);
                setContextMenu(null);
              }}>
                <i className="fa fa-edit"></i> Rename
              </button>
            </>
          )}
          {contextMenu.item.type === 'file' && (
            <>
              <button onClick={() => {
                handleFilePreview(contextMenu.item);
                setContextMenu(null);
              }}>
                <i className="fa fa-eye"></i> Preview
              </button>
              <button onClick={() => {
                handleFileDownload(contextMenu.item);
                setContextMenu(null);
              }}>
                <i className="fa fa-download"></i> Download
              </button>
              <button onClick={() => {
                setRenameItem(contextMenu.item);
                setRenameName(contextMenu.item.name);
                setShowRenameModal(true);
                setContextMenu(null);
              }}>
                <i className="fa fa-edit"></i> Rename
              </button>
            </>
          )}
          <div className="context-menu-divider"></div>
          <button
            className="danger"
            onClick={() => {
              handleDelete(contextMenu.item);
              setContextMenu(null);
            }}
          >
            <i className="fa fa-trash"></i> Delete
          </button>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => {
          setIsPublicFolder(false);
          setShowCreateModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button className="modal-close" onClick={() => {
                setIsPublicFolder(false);
                setShowCreateModal(false);
              }}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <label>Folder Name</label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
              <div className="folder-type-selector">
                <label className="folder-type-label">
                  <input
                    type="radio"
                    name="folderType"
                    checked={!isPublicFolder}
                    onChange={() => setIsPublicFolder(false)}
                  />
                  <span>
                    <i className="fa fa-user"></i> Private Folder (Only you can see)
                  </span>
                </label>
                <label className="folder-type-label">
                  <input
                    type="radio"
                    name="folderType"
                    checked={isPublicFolder}
                    onChange={() => setIsPublicFolder(true)}
                  />
                  <span>
                    <i className="fa fa-globe"></i> Public Folder (All staff can see)
                  </span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setIsPublicFolder(false);
                setShowCreateModal(false);
              }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateFolder}
                disabled={createFolderMutation.isPending}
              >
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload File</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <label>Select File</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.ppt,.zip"
              />
              <small>Max file size: 10MB</small>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleUpload();
                }}
                disabled={uploadFileMutation.isPending || !selectedFile}
              >
                {uploadFileMutation.isPending ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && renameItem && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename {renameItem.type === 'folder' ? 'Folder' : 'File'}</h3>
              <button className="modal-close" onClick={() => setShowRenameModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <label>New Name</label>
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Enter new name"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRenameModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleRename}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && previewUrl && (
        <div className="preview-modal-overlay" onClick={() => {
          setPreviewItem(null);
          setPreviewUrl(null);
        }}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3>
                <i className={`fa ${getFileIcon(previewItem.name)}`}></i>
                {previewItem.name}
              </h3>
              <button className="modal-close" onClick={() => {
                setPreviewItem(null);
                setPreviewUrl(null);
              }}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="preview-modal-body">
              {previewItem.mimeType === 'image' ? (
                <img src={previewUrl} alt={previewItem.name} className="preview-image" />
              ) : previewItem.mimeType === 'pdf' ? (
                <iframe src={previewUrl} className="preview-iframe" title={previewItem.name}></iframe>
              ) : (
                <div className="preview-unsupported">
                  <i className="fa fa-file fa-4x"></i>
                  <p>Preview not available for this file type</p>
                  <button className="btn-action btn-primary" onClick={() => {
                    handleFileDownload(previewItem);
                    setPreviewItem(null);
                    setPreviewUrl(null);
                  }}>
                    <i className="fa fa-download"></i> Download File
                  </button>
                </div>
              )}
            </div>
            <div className="preview-modal-footer">
              <button className="btn-secondary" onClick={() => {
                setPreviewItem(null);
                setPreviewUrl(null);
              }}>
                Close
              </button>
              <button className="btn-action btn-primary" onClick={() => {
                handleFileDownload(previewItem);
              }}>
                <i className="fa fa-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

