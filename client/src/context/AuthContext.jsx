import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser as loginAPI, registerUser as registerAPI, verifyOTP as verifyOTPAPI, adminLogin as adminLoginAPI, getProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check localStorage for existing sessions
  useEffect(() => {
    const storedUser = localStorage.getItem('palmmerit_user');
    const storedAdmin = localStorage.getItem('palmmerit_admin');
    
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Migration: if old palmmerit_user has admin role, move it to palmmerit_admin
        if (parsed.role === 'admin') {
          localStorage.removeItem('palmmerit_user');
          if (!storedAdmin) {
            localStorage.setItem('palmmerit_admin', JSON.stringify(parsed));
            setAdmin(parsed);
          }
        } else {
          setUser(parsed);
        }
      } catch {
        localStorage.removeItem('palmmerit_user');
      }
    }
    
    if (storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        localStorage.removeItem('palmmerit_admin');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await loginAPI({ email, password });
    if (!data.requiresOTP) {
      localStorage.setItem('palmmerit_user', JSON.stringify(data));
      setUser(data);
    }
    return data;
  };

  const ceoLogin = async (username, password) => {
    const { data } = await adminLoginAPI({ username, password });
    localStorage.setItem('palmmerit_admin', JSON.stringify(data));
    setAdmin(data);
    return data;
  };

  const verifyOTP = async (email, code) => {
    const { data } = await verifyOTPAPI({ email, code });
    localStorage.setItem('palmmerit_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const register = async (formData) => {
    const { data } = await registerAPI(formData);
    localStorage.setItem('palmmerit_user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('palmmerit_user');
    setUser(null);
  };

  const adminLogout = () => {
    localStorage.removeItem('palmmerit_admin');
    setAdmin(null);
  };

  const updateUser = (data) => {
    setUser((prevUser) => {
      const updatedUser = { ...prevUser, ...data };
      localStorage.setItem('palmmerit_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const refreshProfile = async () => {
    try {
      const { data } = await getProfile();
      updateUser(data);
      return data;
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, admin, loading, login, ceoLogin, register, logout, adminLogout, updateUser, verifyOTP, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
