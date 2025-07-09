/**
 * Virtual scrolling component for terminal output
 * Optimizes performance when rendering large amounts of terminal data
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualScrollerProps {
  items: string[];
  itemHeight: number;
  height: number;
  width?: string | number;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const VirtualScroller: React.FC<VirtualScrollerProps> = ({
  items,
  itemHeight,
  height,
  width = '100%',
  overscan = 3,
  className,
  style
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + height) / itemHeight);
  
  // Add overscan
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);
  
  // Calculate total height
  const totalHeight = items.length * itemHeight;
  
  // Handle scroll
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);
  
  // Set up scroll listener
  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;
    
    element.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);
  
  // Auto-scroll to bottom when new items are added
  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;
    
    // Check if user is at bottom (within 50px)
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
    
    if (isAtBottom) {
      element.scrollTop = element.scrollHeight;
    }
  }, [items.length]);
  
  // Render visible items
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      visibleItems.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
            overflow: 'hidden',
            whiteSpace: 'pre',
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }}
          dangerouslySetInnerHTML={{ __html: items[i] }}
        />
      );
    }
  }
  
  return (
    <div
      ref={scrollElementRef}
      className={`virtual-scroller ${className || ''}`}
      style={{
        position: 'relative',
        height,
        width,
        overflow: 'auto',
        ...style
      }}
    >
      <div
        style={{
          position: 'relative',
          height: totalHeight,
          width: '100%'
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
};

export default VirtualScroller;