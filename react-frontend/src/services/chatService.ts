import apiClient from './api';
import config from '../utils/config';

export interface ChatMessage {
  id: number;
  staff_id: number;
  staff_name: string;
  staff_pic?: string;
  chat_id: string;
  message?: string;
  attachment?: string;
  filename?: string;
  thumbnail?: string;
  voice_message?: string;
  voice_duration?: number;
  timestamp: string;
  type: 'text' | 'attachment' | 'voice' | 'bot';
  bot_name?: string;
  is_read?: number;
}

export interface StaffMember {
  staff_id: number;
  staff_name: string;
  staff_pic?: string;
  status?: number;
}

export interface ChatRoom {
  chat_id: string;
  name: string;
  avatar?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  is_group?: boolean;
}

export interface SendMessageResponse {
  status: string;
  message?: string;
  firebase_data?: ChatMessage;
  message_id?: number;
}

export interface TypingStatus {
  [userId: string]: {
    isTyping: boolean;
    name: string;
    timestamp: number;
  };
}

const chatService = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || `${config.baseUrl}`,

  // Get all staff members
  async getStaffMembers(): Promise<StaffMember[]> {
    try {
      const response = await apiClient.get<StaffMember[]>(
        `${this.baseUrl}/chatroomController.php?action=getStaff`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Get messages for a chat
  async getMessages(chatId: string): Promise<ChatMessage[]> {
    try {
      const response = await apiClient.get<ChatMessage[]>(
        `${this.baseUrl}/get_messages.php?chat=${chatId}`
      );
      console.log('API response for chat', chatId, ':', response.data);
      console.log('Response type:', typeof response.data, 'Is array:', Array.isArray(response.data));
      return response.data || [];
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },

  // Send text message
  async sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
    try {
      const params = new URLSearchParams();
      params.append('chat_id', chatId);
      params.append('message', message);
      
      console.log('Sending params:', { chat_id: chatId, message: message });

      const response = await apiClient.post<SendMessageResponse>(
        `${this.baseUrl}/send_message.php`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      console.log('Server response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  // Send file attachments
  async sendAttachments(chatId: string, files: File[]): Promise<SendMessageResponse> {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      files.forEach((file, index) => {
        console.log(`Appending file ${index}:`, file.name, file.size, file.type);
        formData.append('attachments[]', file, file.name);
      });

      console.log('Sending attachments to chat:', chatId);
      
      const response = await apiClient.post<SendMessageResponse>(
        `${this.baseUrl}/send_message.php`,
        formData
      );
      
      console.log('Attachment upload response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Attachment upload error:', error);
      throw error;
    }
  },

  // Send voice message
  async sendVoiceMessage(chatId: string, audioBlob: Blob, duration: number): Promise<SendMessageResponse> {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('voice_message', audioBlob, 'voice.webm');
      formData.append('voice_duration', duration.toString());

      console.log('Sending voice message:', {
        chatId,
        duration,
        blobSize: audioBlob.size,
        blobType: audioBlob.type
      });

      const response = await apiClient.post<SendMessageResponse>(
        `${this.baseUrl}/send_message.php`,
        formData
      );
      
      console.log('Voice message response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Voice message error:', error);
      throw error;
    }
  },

  // Send bot command
  async sendBotCommand(chatId: string, command: string, params?: Record<string, any>): Promise<SendMessageResponse> {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('bot_command', command);
      if (params) {
        formData.append('bot_params', JSON.stringify(params));
      }

      const response = await apiClient.post<SendMessageResponse>(
        `${this.baseUrl}/send_message.php`,
        formData
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Get unread message counts
  async getUnreadCounts(): Promise<Record<string, number>> {
    try {
      const response = await apiClient.get<Record<string, number>>(
        `${this.baseUrl}/get_unread_messages.php`
      );
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Mark messages as read
  async markAsRead(chatId: string): Promise<void> {
    try {
      await apiClient.get(
        `${this.baseUrl}/get_unread_messages.php?mark_read=${chatId}`
      );
    } catch (error: any) {
      throw error;
    }
  },

  // Search messages
  async searchMessages(query: string, chatId?: string): Promise<ChatMessage[]> {
    try {
      const url = chatId
        ? `${this.baseUrl}/chatroomController.php?action=search&query=${encodeURIComponent(query)}&chat_id=${chatId}`
        : `${this.baseUrl}/chatroomController.php?action=search&query=${encodeURIComponent(query)}`;
      const response = await apiClient.get<ChatMessage[]>(url);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Update typing status
  async updateTypingStatus(chatId: string, isTyping: boolean): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('typing', isTyping ? '1' : '0');

      await apiClient.post(
        `${this.baseUrl}/typing_status.php`,
        formData
      );
    } catch (error: any) {
      // Silently fail typing status updates
      console.error('Typing status error:', error);
    }
  },
};

export default chatService;

