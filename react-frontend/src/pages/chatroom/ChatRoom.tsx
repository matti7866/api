import React, { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../../utils/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import type { ChatMessage, StaffMember } from '../../services/chatService';
import chatService from '../../services/chatService';
import Swal from 'sweetalert2';
import './ChatRoom.css';

const ChatRoom: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id || user?.staff_id || 0;
  
  const [currentChatId, setCurrentChatId] = useState<string>('main');
  const [messageInput, setMessageInput] = useState('');
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBotCommands, setShowBotCommands] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();

  // Get staff members
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['chatStaff'],
    queryFn: () => chatService.getStaffMembers(),
    refetchOnWindowFocus: false,
  });

  // Get messages for current chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chatMessages', currentChatId],
    queryFn: async () => {
      const msgs = await chatService.getMessages(currentChatId);
      console.log('Fetched messages for chat', currentChatId, ':', msgs);
      return msgs;
    },
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });

  // Get unread counts
  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['chatUnreadCounts'],
    queryFn: () => chatService.getUnreadCounts(),
    refetchInterval: 5000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      console.log('Sending message:', message, 'to chat:', currentChatId);
      return chatService.sendMessage(currentChatId, message);
    },
    onSuccess: async (data) => {
      console.log('Message sent successfully:', data);
      setMessageInput('');
      
      // Clear draft for this chat after sending
      setMessageDrafts(prev => {
        const newDrafts = { ...prev };
        delete newDrafts[currentChatId];
        return newDrafts;
      });
      
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ queryKey: ['chatMessages', currentChatId] });
      await queryClient.refetchQueries({ queryKey: ['chatMessages', currentChatId] });
      queryClient.invalidateQueries({ queryKey: ['chatUnreadCounts'] });
      chatService.updateTypingStatus(currentChatId, false);
      
      // Scroll to bottom after sending (multiple attempts for reliability)
      const scrollToBottom = () => {
        if (chatBoxRef.current) {
          chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      };
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
      
      console.log('Queries invalidated and refetched');
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Failed to send message',
        text: error?.response?.data?.message || error?.message || 'Please try again',
      });
    },
  });

  // Send attachments mutation
  const sendAttachmentsMutation = useMutation({
    mutationFn: (files: File[]) => chatService.sendAttachments(currentChatId, files),
    onSuccess: async () => {
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await queryClient.invalidateQueries({ queryKey: ['chatMessages', currentChatId] });
      await queryClient.refetchQueries({ queryKey: ['chatMessages', currentChatId] });
      
      // Scroll to bottom after uploading
      const scrollToBottom = () => {
        if (chatBoxRef.current) {
          chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      };
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Failed to upload files',
        text: error?.response?.data?.message || 'Please try again',
      });
    },
  });

  // Send voice message mutation
  const sendVoiceMutation = useMutation({
    mutationFn: ({ audioBlob, duration }: { audioBlob: Blob; duration: number }) =>
      chatService.sendVoiceMessage(currentChatId, audioBlob, duration),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chatMessages', currentChatId] });
      await queryClient.refetchQueries({ queryKey: ['chatMessages', currentChatId] });
      
      // Scroll to bottom after sending voice
      const scrollToBottom = () => {
        if (chatBoxRef.current) {
          chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      };
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Failed to send voice message',
        text: error?.response?.data?.message || 'Please try again',
      });
    },
  });

  // Send bot command mutation
  const sendBotMutation = useMutation({
    mutationFn: ({ command, params }: { command: string; params?: Record<string, any> }) =>
      chatService.sendBotCommand(currentChatId, command, params),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chatMessages', currentChatId] });
      await queryClient.refetchQueries({ queryKey: ['chatMessages', currentChatId] });
      
      // Scroll to bottom after bot response
      const scrollToBottom = () => {
        if (chatBoxRef.current) {
          chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      };
      requestAnimationFrame(scrollToBottom);
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
    },
  });

  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(0);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      // Only auto-scroll if this is a new message (count increased)
      const shouldScroll = messages.length > prevMessageCountRef.current;
      prevMessageCountRef.current = messages.length;
      
      if (shouldScroll && chatBoxRef.current) {
        // Scroll immediately without animation to prevent flash
        requestAnimationFrame(() => {
          if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
          }
        });
      }
    }
  }, [messages]);

  // Mark as read and scroll to bottom when switching chats
  useEffect(() => {
    // Save current draft before switching
    const previousChatId = currentChatId;
    
    return () => {
      // This cleanup runs when switching to a new chat
      // Save the current message as draft
      if (messageInput.trim() !== '') {
        setMessageDrafts(prev => ({
          ...prev,
          [previousChatId]: messageInput
        }));
      } else {
        // Remove draft if input is empty
        setMessageDrafts(prev => {
          const newDrafts = { ...prev };
          delete newDrafts[previousChatId];
          return newDrafts;
        });
      }
    };
  }, [currentChatId]);

  // Load draft, mark as read, and scroll when chat changes
  useEffect(() => {
    chatService.markAsRead(currentChatId).catch(err => {
      console.error('Error marking as read:', err);
      // Silently fail
    });
    
    // Load draft for the new chat (if exists)
    const draft = messageDrafts[currentChatId] || '';
    setMessageInput(draft);
    
    // Reset message count when switching chats
    prevMessageCountRef.current = 0;
    
    // Scroll to bottom when switching chats (after messages load)
    const scrollToBottom = () => {
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }
    };
    
    // Multiple attempts to ensure scroll happens after render
    setTimeout(scrollToBottom, 50);
    setTimeout(scrollToBottom, 150);
    setTimeout(scrollToBottom, 300);
    
    // Auto-focus message input when switching chats
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  }, [currentChatId]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      chatService.updateTypingStatus(currentChatId, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      chatService.updateTypingStatus(currentChatId, false);
    }, 3000);
  }, [currentChatId, isTyping]);

  // Handle message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    sendMessageMutation.mutate(messageInput.trim());
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      console.log('Files selected:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
      setSelectedFiles(files);
      sendAttachmentsMutation.mutate(files);
    }
  };

  // Handle voice recording start
  const startRecording = async () => {
    try {
      console.log('Starting voice recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine best MIME type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = ''; // Use default
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const startTime = Date.now(); // Capture start time in closure
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log('Recording duration:', duration, 'seconds');
        console.log('Start time:', startTime, 'End time:', endTime);
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        console.log('Audio blob size:', audioBlob.size, 'bytes, type:', audioBlob.type);
        
        if (audioBlob.size > 100) { // At least 100 bytes
          console.log('Sending voice message...');
          sendVoiceMutation.mutate({ audioBlob, duration: duration > 0 ? duration : 1 });
        } else {
          console.error('Recording too small or invalid:', audioBlob.size, 'bytes');
          Swal.fire({
            icon: 'error',
            title: 'Recording Failed',
            text: 'Recording was too short or failed. Please try again.',
          });
        }
        
        stream.getTracks().forEach(track => track.stop());
        setRecordingStartTime(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      Swal.fire({
        icon: 'error',
        title: 'Microphone Access Denied',
        text: 'Please allow microphone access to record voice messages.',
      });
    }
  };

  // Handle voice recording stop
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle voice button click (toggle)
  const handleVoiceButtonClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Handle bot command
  const handleBotCommand = (command: string) => {
    const commands: Record<string, Record<string, any>> = {
      '/weather': { location: 'Dubai' },
      '/time': {},
      '/joke': {},
      '/quote': {},
      '/help': {},
    };

    sendBotMutation.mutate({
      command,
      params: commands[command] || {},
    });
    setShowBotCommands(false);
  };

  // Get staff picture URL
  const getStaffPicUrl = (pic?: string): string => {
    if (!pic || pic === '') return `${config.baseUrl}/assets/default-avatar.png`;
    if (pic.startsWith('http')) return pic;
    if (pic.startsWith('/')) return `${config.baseUrl}${pic}`;
    if (pic.startsWith('assets/') || pic.startsWith('Uploads/')) {
      return `${config.baseUrl}/${pic}`;
    }
    return `${config.baseUrl}/${pic}`;
  };

  // Get attachment URL
  const getAttachmentUrl = (path?: string): string => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return `${config.baseUrl}${path}`;
    return `${config.baseUrl}/${path}`;
  };

  // Get current chat name
  const getCurrentChatName = (): string => {
    if (currentChatId === 'main') return 'Main Hall';
    const staff = staffMembers.find(s => s.staff_id.toString() === currentChatId);
    return staff?.staff_name || 'Unknown';
  };

  // Get current chat avatar
  const getCurrentChatAvatar = (): string => {
    if (currentChatId === 'main') return `${config.baseUrl}/assets/default-avatar.png`;
    const staff = staffMembers.find(s => s.staff_id.toString() === currentChatId);
    return getStaffPicUrl(staff?.staff_pic);
  };

  // Format message time
  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render message
  const renderMessage = (message: ChatMessage) => {
    const isSent = message.staff_id === currentUserId;
    const isBot = message.type === 'bot';
    
    // Determine message type if not set (handle empty strings properly)
    const messageType = message.type || 
      (message.voice_message && message.voice_message !== '' ? 'voice' : 
       message.attachment && message.attachment !== '' && message.attachment !== null ? 'attachment' : 
       message.bot_name && message.bot_name !== '' ? 'bot' : 'text');

    console.log('Rendering message:', { 
      id: message.id, 
      type: messageType, 
      message: message.message, 
      staff_id: message.staff_id,
      attachment: message.attachment,
      hasMessage: !!message.message
    });

    return (
      <div
        key={message.id}
        className={`message ${isSent ? 'sent' : 'received'} ${isBot ? 'bot-message' : ''}`}
      >
        {!isSent && !isBot && (
          <div className="message-header">
            <img
              src={getStaffPicUrl(message.staff_pic)}
              alt={message.staff_name}
              className="message-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `${config.baseUrl}/assets/default-avatar.png`;
              }}
            />
            <span className="message-sender">{message.staff_name}</span>
          </div>
        )}
        {isBot && (
          <div className="message-header">
            <i className="fa fa-robot"></i>
            <span className="message-sender">{message.bot_name || 'ChatBot'}</span>
          </div>
        )}
        
        <div className="message-bubble">
          {/* Display text if message exists (regardless of type) */}
          {message.message && message.message.trim() !== '' && (
            <div className="message-text">{message.message}</div>
          )}
          
          {/* Display attachment if valid attachment exists */}
          {message.attachment && message.attachment !== '' && message.attachment !== null && (
            <div className="message-attachment">
              {message.attachment.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                <img 
                  src={getAttachmentUrl(message.attachment)} 
                  alt={message.filename} 
                  className="attachment-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : message.attachment.match(/\.pdf$/i) ? (
                <div className="attachment-file">
                  <i className="fa fa-file-pdf"></i>
                  <span>{message.filename}</span>
                </div>
              ) : (
                <div className="attachment-file">
                  <i className="fa fa-file"></i>
                  <span>{message.filename}</span>
                </div>
              )}
              <a href={getAttachmentUrl(message.attachment)} download={message.filename} className="download-btn">
                <i className="fa fa-download"></i> Download
              </a>
            </div>
          )}
          
          {/* Display voice message if valid voice exists */}
          {message.voice_message && message.voice_message !== '' && message.voice_message !== null && (
            <div className="message-voice">
              <audio controls src={getAttachmentUrl(message.voice_message)} className="voice-player">
                Your browser does not support the audio element.
              </audio>
              {message.voice_duration && (
                <span className="voice-duration">{Math.round(message.voice_duration)}s</span>
              )}
            </div>
          )}
        </div>
        
        <div className="message-time">{formatMessageTime(message.timestamp)}</div>
      </div>
    );
  };

  return (
    <div className="chatroom-wrapper">
      <div className="chatroom-container">
      {/* Staff List Sidebar */}
      <div className="chatroom-sidebar">
        <div className="sidebar-header">
          <i className="fa fa-comments"></i>
          <span>Staff Chat</span>
        </div>
        
        <div className="sidebar-content">
          {/* Main Hall */}
          <div
            className={`chat-item ${currentChatId === 'main' ? 'active' : ''}`}
            onClick={() => setCurrentChatId('main')}
          >
            <div className="chat-avatar main-hall">
              <i className="fa fa-users"></i>
            </div>
            <div className="chat-info">
              <div className="chat-name">Main Hall</div>
              <div className="chat-preview">Group chat for all staff</div>
            </div>
            {unreadCounts['main'] > 0 && (
              <div className="unread-badge">{unreadCounts['main']}</div>
            )}
          </div>

          {/* Staff Members */}
          {staffMembers.map((staff) => {
            const chatId = staff.staff_id.toString();
            return (
              <div
                key={staff.staff_id}
                className={`chat-item ${currentChatId === chatId ? 'active' : ''}`}
                onClick={() => setCurrentChatId(chatId)}
              >
                <img
                  src={getStaffPicUrl(staff.staff_pic)}
                  alt={staff.staff_name}
                  className="chat-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${config.baseUrl}/assets/default-avatar.png`;
                  }}
                />
                <div className="chat-info">
                  <div className="chat-name">{staff.staff_name}</div>
                  <div className="chat-preview">Private chat</div>
                </div>
                {unreadCounts[chatId] > 0 && (
                  <div className="unread-badge">{unreadCounts[chatId]}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chatroom-main">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="header-info">
            <img 
              src={getCurrentChatAvatar()} 
              alt={getCurrentChatName()} 
              className="header-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `${config.baseUrl}/assets/default-avatar.png`;
              }}
            />
            <div>
              <div className="header-name">{getCurrentChatName()}</div>
              <div className="header-status">
                {currentChatId === 'main' ? 'Group Chat' : 'Private Chat'}
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className={`header-btn ${showBotCommands ? 'active' : ''}`}
              onClick={() => setShowBotCommands(!showBotCommands)}
              title="Bot Commands"
            >
              <i className="fa fa-robot"></i>
            </button>
            <button className="header-btn" title="Search">
              <i className="fa fa-search"></i>
            </button>
          </div>
        </div>

        {/* Bot Commands Panel */}
        {showBotCommands && (
          <div className="bot-commands-panel">
            <div className="bot-commands-header">
              <span>Bot Commands</span>
              <button onClick={() => setShowBotCommands(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>
            <div className="bot-commands-list">
              <button onClick={() => handleBotCommand('/weather')}>
                <i className="fa fa-cloud-sun"></i> Weather
              </button>
              <button onClick={() => handleBotCommand('/time')}>
                <i className="fa fa-clock"></i> Current Time
              </button>
              <button onClick={() => handleBotCommand('/joke')}>
                <i className="fa fa-laugh"></i> Random Joke
              </button>
              <button onClick={() => handleBotCommand('/quote')}>
                <i className="fa fa-quote-left"></i> Inspirational Quote
              </button>
              <button onClick={() => handleBotCommand('/help')}>
                <i className="fa fa-question-circle"></i> Help
              </button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="chat-messages" ref={chatBoxRef}>
          {messagesLoading ? (
            <div className="loading-messages">
              <i className="fa fa-spinner fa-spin"></i>
              <span>Loading messages...</span>
            </div>
          ) : (
            <>
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <i className="fa fa-comments"></i>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="messages-list">
                  {console.log('Rendering', messages.length, 'messages')}
                  {messages.map((msg, idx) => {
                    console.log(`Message ${idx}:`, msg);
                    return renderMessage(msg);
                  })}
                </div>
              )}
              <div ref={messageEndRef} />
            </>
          )}
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <div className="emoji-picker">
              <div className="emoji-picker-header">
                <span>Select Emoji</span>
                <button onClick={() => setShowEmojiPicker(false)}>
                  <i className="fa fa-times"></i>
                </button>
              </div>
              <div className="emoji-grid">
                {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'].map((emoji) => (
                  <button
                    key={emoji}
                    className="emoji-btn"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="chat-input-container">
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <div className="input-actions">
              <button
                type="button"
                className={`action-btn ${showEmojiPicker ? 'active' : ''}`}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emojis"
              >
                <i className="fa fa-smile"></i>
              </button>
              <button
                type="button"
                className="action-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach File"
              >
                <i className="fa fa-paperclip"></i>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className={`action-btn voice-btn ${isRecording ? 'recording' : ''}`}
                onClick={handleVoiceButtonClick}
                title={isRecording ? 'Stop Recording' : 'Record Voice'}
              >
                <i className={`fa ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
              </button>
            </div>
            
            <input
              ref={messageInputRef}
              type="text"
              className="message-input"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                handleTyping();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              autoFocus
            />
            
            <button 
              type="submit" 
              className="send-btn" 
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <i className="fa fa-spinner fa-spin"></i>
              ) : (
                <i className="fa fa-paper-plane"></i>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ChatRoom;
