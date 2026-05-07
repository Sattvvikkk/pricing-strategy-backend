import { createContext, useContext } from 'react';

const AuthContext = createContext(null);

// Hardcoded demo user — auth is bypassed, app is always accessible.
const DEMO_USER = { email: 'demo@vougestudio.com', plan: 'Pro' };

export function AuthProvider({ children }) {
  const value = {
    token: 'demo-token',
    user: DEMO_USER,
    isAuthenticated: true,
    login: () => {},
    logout: () => {},
    setUser: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
