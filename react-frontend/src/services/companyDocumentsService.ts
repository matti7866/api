import axios from 'axios';
import { config } from '../utils/config';
import type {
  TreeNode,
  CreateFolderRequest,
  UploadFileRequest,
  DeleteRequest,
  ApiResponse
} from '../types/companyDocuments';
import logger from '../utils/logger';

class CompanyDocumentsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || `${config.baseUrl}`;

  async getDocuments(): Promise<TreeNode[]> {
    try {
      const formData = new FormData();
      formData.append('GetDocuments', 'getDocuments');

      const response = await axios.post(
        `${this.baseUrl}/company_documentsController.php`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      logger.debug('Documents fetched:', response.data);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      logger.error('Error fetching documents:', error);
      throw error;
    }
  }

  async createFolder(data: CreateFolderRequest): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('CreateFolder', 'createFolder');
      formData.append('Foler_Name', data.Foler_Name);
      // Always send isPublic value - default to '0' (private) if not provided
      formData.append('isPublic', data.isPublic !== undefined ? data.isPublic : '0');

      const response = await axios.post(
        `${this.baseUrl}/company_documentsController.php`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      logger.debug('Create folder response:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Error creating folder:', error);
      throw error;
    }
  }

  async uploadFile(data: UploadFileRequest): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('uploadCompanyFiles', 'uploadCompanyFiles');
      
      // Ensure file is properly appended - handle both File objects and FileList items
      const file = data.uploadFile;
      
      logger.debug('uploadFile service called with:', {
        file: file,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        fileConstructor: file?.constructor?.name,
        isFile: file instanceof File,
        isBlob: file instanceof Blob,
        fileKeys: file ? Object.keys(file) : []
      });
      
      // Check if it's a valid file object
      if (!file) {
        throw new Error('No file provided');
      }
      
      // Check if it has the required properties of a File
      if (!file.name) {
        logger.error('File missing name:', file);
        throw new Error('File is missing name property');
      }
      
      if (file.size === undefined || file.size === null) {
        logger.error('File missing size:', file);
        throw new Error('File is missing size property');
      }
      
      // Append file to FormData - use the file directly
      // FormData.append accepts File, Blob, or string
      formData.append('uploadFile', file, file.name);
      
      formData.append('DID', data.DID.toString());
      if (data.Agree !== undefined) {
        formData.append('Agree', data.Agree.toString());
      }

      logger.debug('Uploading file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'unknown',
        directoryId: data.DID,
        fileConstructor: file.constructor.name
      });

      const response = await axios.post(
        `${this.baseUrl}/company_documentsController.php`,
        formData,
        {
          withCredentials: true,
          // Don't set Content-Type header - axios will automatically set it with boundary for FormData
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      logger.debug('Upload file response:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Error uploading file:', error);
      if (error.response) {
        logger.error('Error response data:', error.response.data);
      }
      throw error;
    }
  }

  async deleteItem(data: DeleteRequest): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('DELETE_VAR', 'delete_var');
      formData.append('CustomID', data.CustomID.toString());
      formData.append('IsFile', data.IsFile);
      if (data.ParentCustomID !== undefined) {
        formData.append('ParentCustomID', data.ParentCustomID.toString());
      }

      const response = await axios.post(
        `${this.baseUrl}/company_documentsController.php`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      logger.debug('Delete response:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('Error deleting item:', error);
      throw error;
    }
  }

  downloadFile(customID: number, parentCustomID: number): void {
    window.open(
      `${this.baseUrl}/downloadCompanyFiles.php?CustomID=${customID}&ParentCustomID=${parentCustomID}`,
      '_blank'
    );
  }
}

export const companyDocumentsService = new CompanyDocumentsService();
export default companyDocumentsService;

