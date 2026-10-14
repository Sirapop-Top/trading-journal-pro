import { useState, useEffect } from 'react';

/**
 * Hook to track window dimensions and responsive mobile threshold (< 768px).
 */
export const useResponsive = () => {
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  return { windowWidth, isMobile };
};
