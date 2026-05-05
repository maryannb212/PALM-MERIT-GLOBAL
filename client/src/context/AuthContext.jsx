import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginUser as loginAPI, registerUser as registerAPI, verifyOTP as verifyOTPAPI, adminLogin as adminLoginAPI, getProfile } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check localStorage for an existing session
  useEffect(() => {
    const stored = localStorage.getItem('palmmerit_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('palmmerit_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await loginAPI({ email, password });
    if (!data.requiresOTP) {
      // Fallback for older flow or bypass
      localStorage.setItem('palmmerit_user', JSON.stringify(data));
      setUser(data);
    }
    return data;
  };

  const ceoLogin = async (username, password) => {
    const { data } = await adminLoginAPI({ username, password });
    localStorage.setItem('palmmerit_user', JSON.stringify(data));
    setUser(data);
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

  const updateUser = (data) => {
    const updatedUser = { ...user, ...data };
    localStorage.setItem('palmmerit_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
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
    <AuthContext.Provider value={{ user, loading, login, ceoLogin, register, logout, updateUser, verifyOTP, refreshProfile }}>
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
