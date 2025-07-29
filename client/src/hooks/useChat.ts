import { useState, useCallback, useRef } from 'react';
import { Message, ChatState, ChatActions, MessageStatus } from '../types/chat';

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  text: '안녕하세요! 🎓 대진대학교 AI 챗봇 우진이입니다.\n\n✨ **새로워진 기능**\n• 향상된 시간표 검색 (교수별/과목별)\n• 대진대 홈페이지 정보 통합\n• 더욱 정확한 학사정보 제공\n\n궁금한 것이 있으시면 언제든 물어보세요! 😊',
  isUser: false,
  timestamp: new Date(),
  status: 'delivered',
};

export const useChat = (): ChatState & ChatActions => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages(prev => [...prev, userMessage]);
    setError(null);
    setIsLoading(true);
    setShowSuggestions(false);

    // 메시지 상태를 'sent'로 업데이트
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'sent' as MessageStatus }
            : msg
        )
      );
    }, 300);

    try {
      // 이전 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text.trim() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`서버 오류 (${response.status})`);
      }

      const data = await response.json();
      
      // 봇 응답 메시지 추가
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        text: data.response || '응답을 받지 못했습니다.',
        isUser: false,
        timestamp: new Date(),
        status: 'delivered',
        context: data.context,
      };

      setMessages(prev => [
        ...prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'delivered' as MessageStatus }
            : msg
        ),
        botMessage
      ]);

    } catch (error: any) {
      console.error('메시지 전송 오류:', error);
      
      if (error.name === 'AbortError') {
        return; // 요청이 취소된 경우 에러 처리 안함
      }

      // 사용자 메시지 상태를 'failed'로 업데이트
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'failed' as MessageStatus }
            : msg
        )
      );

      const errorMsg = error.message || '네트워크 오류가 발생했습니다.';
      setError(errorMsg);
      
      // 에러 메시지 추가
      const errorBotMessage: Message = {
        id: `error-${Date.now()}`,
        text: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 🔧',
        isUser: false,
        timestamp: new Date(),
        status: 'delivered',
      };

      setMessages(prev => [...prev, errorBotMessage]);
      setIsConnected(false);
      
      // 연결 상태 복구 시뮬레이션
      setTimeout(() => setIsConnected(true), 3000);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading]);

  const retryMessage = useCallback(async (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message || !message.isUser) return;

    await sendMessage(message.text);
  }, [messages, sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setError(null);
    setShowSuggestions(true);
    setIsLoading(false);
    
    // 진행 중인 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    // State
    messages,
    isLoading,
    error,
    isConnected,
    showSuggestions,
    
    // Actions
    sendMessage,
    clearChat,
    retryMessage,
    setError,
  };
};