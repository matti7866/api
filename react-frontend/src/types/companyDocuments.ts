export interface CompanyDocument {
  document_id: number;
  file_name: string;
  dir_id: number;
  uploaded_by: number;
  uploaded_at?: string;
}

export interface CompanyDirectory {
  directory_id: number;
  directory_name: string;
}

export interface TreeNode {
  text: string;
  parent: string | number;
  isFile: 'true' | 'false';
  customID: number;
  parentCustomID?: number;
  children?: TreeNode[];
  type?: 'file' | 'default';
  is_public?: number;
  user_id?: number | null;
}

export interface CreateFolderRequest {
  Foler_Name: string;
  isPublic?: string; // '1' for public, '0' or undefined for private
}

export interface UploadFileRequest {
  uploadFile: File;
  DID: number;
  Agree?: number;
}

export interface DeleteRequest {
  CustomID: number;
  ParentCustomID?: number;
  IsFile: 'true' | 'false';
}

export interface ApiResponse {
  msg: 'success' | 'error' | 'info';
  msgDetails?: string;
  id?: number;
}

