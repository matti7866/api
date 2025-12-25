import apiClient from './api';
import { config } from '../utils/config';

export interface Category {
  id: number;
  name: string;
}

export interface Note {
  id?: number;
  content: string;
  category_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  categories?: Category[];
  category?: Category;
  notes?: string;
}

const notesService = {
  baseUrl: `${config.baseUrl}`,

  async getCategories(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get<ApiResponse>(
        `${this.baseUrl}/notesController.php?action=getCategories`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async addCategory(name: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/notesController.php?action=addCategory`,
        { name }
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async loadNotes(categoryId: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.get<ApiResponse>(
        `${this.baseUrl}/notesController.php?action=load&category_id=${categoryId}`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async saveNotes(content: string, categoryId: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.post<ApiResponse>(
        `${this.baseUrl}/notesController.php?action=save`,
        { notes: content, category_id: categoryId }
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }
};

export default notesService;

