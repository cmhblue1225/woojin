import { useEffect, useRef, useCallback } from 'react';

interface UseAutoScrollOptions {
  dependency: any;
  delay?: number;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}

export const useAutoScroll = ({
  dependency,
  delay = 150,
  behavior = 'smooth',
  block = 'end'
}: UseAutoScrollOptions) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimetoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current && !isUserScrollingRef.current) {
      scrollRef.current.scrollIntoView({
        behavior,
        block,
        inline: 'nearest'
      });
    }
  }, [behavior, block]);

  const handleScroll = useCallback(() => {
    if (scrollTimetoutRef.current) {
      clearTimeout(scrollTimetoutRef.current);
    }

    isUserScrollingRef.current = true;
    
    scrollTimetoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 1000);
  }, []);

  const forceScrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      isUserScrollingRef.current = false;
      scrollRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, delay);
    return () => clearTimeout(timer);
  }, [dependency, scrollToBottom, delay]);

  useEffect(() => {
    return () => {
      if (scrollTimetoutRef.current) {
        clearTimeout(scrollTimetoutRef.current);
      }
    };
  }, []);

  return {
    scrollRef,
    handleScroll,
    forceScrollToBottom,
    scrollToBottom
  };
};