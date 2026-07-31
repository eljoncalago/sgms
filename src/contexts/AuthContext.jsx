import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/api/sgmsAPI';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = authAPI.getToken();
    const savedAdmin = authAPI.getAdmin();
    
    if (token && savedAdmin) {
      setIsAuthenticated(true);
      setAdmin(savedAdmin);
    }
    
    setLoading(false);
  }, []);

  const login = async (adminName, passcode) => {
    try {
      const result = await authAPI.login(adminName, passcode);
      
      if (result.success) {
        setIsAuthenticated(true);
        setAdmin(result.data.admin);
        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = () => {
    authAPI.logout();
    setIsAuthenticated(false);
    setAdmin(null);
  };

  const value = {
    isAuthenticated,
    admin,
    loading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
