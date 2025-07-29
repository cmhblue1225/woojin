// 채팅 관련 타입 정의

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  status?: MessageStatus;
  context?: ContextInfo[];
  isTyping?: boolean;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface ContextInfo {
  source: string;
  similarity: number;
  type?: string;
}

export interface QuickSuggestion {
  id: string;
  text: string;
  category: CategoryType;
  icon: React.ReactNode;
  color: string;
  priority: number;
}

export type CategoryType = 
  | '학사정보' 
  | '교수정보' 
  | '학과정보' 
  | '시설정보' 
  | '입학정보' 
  | '기타';

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  showSuggestions: boolean;
}

export interface ChatActions {
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  retryMessage: (messageId: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export interface ThemeMode {
  mode: 'light' | 'dark';
  toggleMode: () => void;
}

export interface ChatConfig {
  apiEndpoint: string;
  maxMessageLength: number;
  typingIndicatorDelay: number;
  autoScrollDelay: number;
  suggestionCategories: CategoryType[];
}