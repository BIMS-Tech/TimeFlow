import React, { createContext, useContext, useState, useCallback } from 'react';
import { effectivePermissions } from '../permissions';

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

  const isSuperAdmin      = user?.role === 'super_admin';
  const isHROrAbove       = isSuperAdmin || user?.role === 'hr';
  const isPayrollOrAbove  = isHROrAbove  || user?.role === 'payroll_officer';

  // Which pages this user may open, and whether money is hidden from them.
  // A super admin can narrow either of these per user from the Users screen.
  const { pages, hideAmounts } = effectivePermissions(user);
  const can = (pageKey) => pages.includes(pageKey);

  return (
    <AuthContext.Provider value={{
      user, login, logout, isAuthenticated: !!user,
      isSuperAdmin, isHROrAbove, isPayrollOrAbove,
      pages, hideAmounts, can,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
