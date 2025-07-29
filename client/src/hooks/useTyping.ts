import { useState, useEffect, useRef } from 'react';

interface UseTypingOptions {
  delay?: number;
  threshold?: number;
}

export const useTyping = ({ delay = 1000, threshold = 3 }: UseTypingOptions = {}) => {
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = () => {
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, delay);
  };

  const handleTextChange = (text: string) => {
    setTypedText(text);
    
    if (text.length >= threshold) {
      startTyping();
    }
  };

  const stopTyping = () => {
    setIsTyping(false);
    setTypedText('');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTyping,
    typedText,
    handleTextChange,
    startTyping,
    stopTyping
  };
};