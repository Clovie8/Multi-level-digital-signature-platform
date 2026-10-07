import { useState, useRef } from 'react';

export function useAsyncLock(asyncFunction) {
  const [isLoading, setIsLoading] = useState(false);
  const isLocked = useRef(false);

  const execute = async (...args) => {
    // 1. Synchronous Lock: Instantly blocks double clicks in 0ms
    if (isLocked.current) return;
    
    // 2. Lock the function
    isLocked.current = true;
    
    // 3. Trigger visual loading state
    setIsLoading(true);
    
    try {
      await asyncFunction(...args);
    } catch (error) {
      // We re-throw the error so the individual component can still catch and handle it (e.g. for toasts)
      throw error;
    } finally {
      // 4. Release locks after the API response finishes
      isLocked.current = false;
      setIsLoading(false);
    }
  };

  return [execute, isLoading];
}
