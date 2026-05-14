import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return adminOnly ? <Navigate to="/admin/login" replace /> : <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  // Allow admins to access the user dashboard to view things from a user's perspective
  // if (!adminOnly && user.role === 'admin') {
  //   return <Navigate to="/admin/dashboard" replace />;
  // }

  return children;
};

export default ProtectedRoute;
