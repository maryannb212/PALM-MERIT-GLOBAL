import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AdminLockContext = createContext(null);

// Default lock timeout: 10 minutes
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export const AdminLockProvider = ({ children }) => {
  const [unlockedPages, setUnlockedPages] = useState({});

  // Initialize from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('admin_page_locks');
      if (stored) {
        setUnlockedPages(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse admin locks', e);
    }
  }, []);

  // Save to sessionStorage when state changes
  useEffect(() => {
    sessionStorage.setItem('admin_page_locks', JSON.stringify(unlockedPages));
  }, [unlockedPages]);

  // Periodic cleanup of expired tokens
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;
      const newLocks = { ...unlockedPages };

      Object.keys(newLocks).forEach((pageName) => {
        if (newLocks[pageName].expiresAt < now) {
          delete newLocks[pageName];
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setUnlockedPages(newLocks);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [unlockedPages]);

  const unlockPage = useCallback((pageName, token) => {
    setUnlockedPages(prev => ({
      ...prev,
      [pageName]: {
        token,
        expiresAt: Date.now() + LOCK_TIMEOUT_MS
      }
    }));
  }, []);

  const lockPage = useCallback((pageName) => {
    setUnlockedPages(prev => {
      const newLocks = { ...prev };
      delete newLocks[pageName];
      return newLocks;
    });
  }, []);

  const isPageUnlocked = useCallback((pageName) => {
    const lockInfo = unlockedPages[pageName];
    if (!lockInfo) return false;
    
    // Check if expired
    if (lockInfo.expiresAt < Date.now()) {
      lockPage(pageName);
      return false;
    }
    
    return true;
  }, [unlockedPages, lockPage]);

  // Extend the lock when there's activity on the page (optional, but good UX if they stay on it long)
  // For now, the user requested it to lock immediately on leaving, which we will handle in the route component.
  const refreshPageLock = useCallback((pageName) => {
    if (unlockedPages[pageName]) {
      setUnlockedPages(prev => ({
        ...prev,
        [pageName]: {
          ...prev[pageName],
          expiresAt: Date.now() + LOCK_TIMEOUT_MS
        }
      }));
    }
  }, [unlockedPages]);

  return (
    <AdminLockContext.Provider value={{ unlockedPages, unlockPage, lockPage, isPageUnlocked, refreshPageLock }}>
      {children}
    </AdminLockContext.Provider>
  );
};

export const useAdminLock = () => {
  const context = useContext(AdminLockContext);
  if (!context) {
    throw new Error('useAdminLock must be used within an AdminLockProvider');
  }
  return context;
};
