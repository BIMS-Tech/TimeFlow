import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const isSuperAdmin   = user?.role === 'super_admin';
  const isAdminOrAbove = isSuperAdmin || user?.role === 'admin';
  const isHROrAbove    = isAdminOrAbove || user?.role === 'hr';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isSuperAdmin, isAdminOrAbove, isHROrAbove }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
