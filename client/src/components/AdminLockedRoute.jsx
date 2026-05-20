import React, { useEffect, useRef } from 'react';
import { useAdminLock } from '../context/AdminLockContext';
import AdminLockScreen from './AdminLockScreen';

/**
 * A wrapper for admin routes that require a secondary page-specific password.
 * It automatically locks the page again when the user navigates away (unmounts).
 */
const AdminLockedRoute = ({ children, pageName, title }) => {
  const { isPageUnlocked, lockPage, refreshPageLock } = useAdminLock();
  const unlocked = isPageUnlocked(pageName);
  const isUnlockedRef = useRef(unlocked);

  // Keep ref in sync
  useEffect(() => {
    isUnlockedRef.current = unlocked;
  }, [unlocked]);

  // Lock on unmount (leaving the page)
  useEffect(() => {
    return () => {
      // If the component unmounts and it was unlocked, lock it!
      // This satisfies the requirement "immediately upon leaving the page"
      if (isUnlockedRef.current) {
        lockPage(pageName);
      }
    };
  }, [pageName, lockPage]);

  // Activity tracker (extends lock if they are actively using the page)
  useEffect(() => {
    if (!unlocked) return;

    const handleActivity = () => {
      refreshPageLock(pageName);
    };

    // Listen to standard interaction events
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [unlocked, pageName, refreshPageLock]);

  if (!unlocked) {
    return <AdminLockScreen pageName={pageName} title={title} />;
  }

  return children;
};

export default AdminLockedRoute;
