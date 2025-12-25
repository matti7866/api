import apiClient from './api';
import { config } from '../utils/config';

export interface Attachment {
  id: number;
  file_name: string;
  original_name: string;
  description?: string;
  staff_id: number;
  folder_id?: number | null;
  upload_date: string;
  file_size?: string;
  thumbnail_url?: string;
  extension?: string;
  mimeType?: string;
}

export interface Folder {
  folder_id: number;
  folder_name: string;
  staff_id: number;
  parent_id?: number | null;
  created_by?: string;
  is_shared?: number;
}

export interface StaffMember {
  staff_id: number;
  staff_name: string;
}

export interface FolderShare {
  share_id: number;
  folder_id: number;
  staff_id: number;
  staff_name: string;
  permission: 'view' | 'edit';
}

export interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  folder_id?: number;
  folder_name?: string;
  new_name?: string;
  file_id?: number;
  compressed?: boolean;
  deleted?: number;
  failed?: number;
  text?: string;
  extracted_fields?: any;
  debug?: any;
}

const attachmentsService = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || `${config.baseUrl}`,

  async getFolders(parentId?: number | null): Promise<Folder[]> {
    try {
      const url = parentId 
        ? `${this.baseUrl}/attachmentsController.php?get_folders=1&parent_id=${parentId}`
        : `${this.baseUrl}/attachmentsController.php?get_folders=1`;
      const response = await apiClient.get<Folder[]>(url);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createFolder(folderName: string, parentId?: number | null): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('create_folder', '1');
      formData.append('folder_name', folderName);
      if (parentId) {
        formData.append('parent_id', parentId.toString());
      }
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async renameFolder(folderId: number, newName: string): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('rename_folder', '1');
      formData.append('folder_id', folderId.toString());
      formData.append('new_name', newName);
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteFolder(folderId: number, force?: boolean): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('delete_folder', folderId.toString());
      if (force) {
        formData.append('force', '1');
      }
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getFiles(folderId?: number | null): Promise<Attachment[]> {
    try {
      const url = folderId
        ? `${this.baseUrl}/attachmentsController.php?folder_id=${folderId}`
        : `${this.baseUrl}/attachmentsController.php?root_folder=1`;
      const response = await apiClient.get<Attachment[]>(url);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async uploadFile(file: File, folderId?: number | null, description?: string): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (folderId) {
        formData.append('folder_id', folderId.toString());
      }
      if (description) {
        formData.append('description', description);
      }
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteFile(fileId: number): Promise<ApiResponse> {
    try {
      // Use URLSearchParams for simpler form encoding
      const params = new URLSearchParams();
      params.append('delete', fileId.toString());
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteMultipleFiles(fileIds: number[]): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('delete_multiple', '1');
      fileIds.forEach(id => {
        formData.append('file_ids[]', id.toString());
      });
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  downloadFile(fileId: number): void {
    window.open(`${this.baseUrl}/attachmentsController.php?download=${fileId}`, '_blank');
  },

  async getStaff(): Promise<StaffMember[]> {
    try {
      const response = await apiClient.get<StaffMember[]>(
        `${this.baseUrl}/attachmentsController.php?get_staff=1`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getFolderShares(folderId: number): Promise<FolderShare[]> {
    try {
      const response = await apiClient.get<FolderShare[]>(
        `${this.baseUrl}/attachmentsController.php?get_folder_shares=${folderId}`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async addFolderShare(folderId: number, staffId: number, permission: 'view' | 'edit'): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('add_share', '1');
      formData.append('folder_id', folderId.toString());
      formData.append('staff_id', staffId.toString());
      formData.append('permission', permission);
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async removeFolderShare(shareId: number): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('remove_share', shareId.toString());
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async processOCR(fileId: number): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('process_ocr', '1');
      formData.append('file_id', fileId.toString());
      
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/attachmentsController.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }
};

export default attachmentsService;

