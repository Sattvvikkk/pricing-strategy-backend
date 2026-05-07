import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/client';

const AuthContext = createContext(null);

/** Decode the payload from a JWT without verifying signature (client-side only). */
function decodeToken(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);   // { email, user_id, organization_id }
  const [loading, setLoading] = useState(true);

  /** Restore session from localStorage on first render. */
  useEffect(() => {
    const stored = localStorage.getItem('pe_token');
    if (stored) {
      const payload = decodeToken(stored);
      if (payload && payload.exp * 1000 > Date.now()) {
        setToken(stored);
        setUser({ email: payload.sub, user_id: payload.user_id });
      } else {
        localStorage.removeItem('pe_token');
      }
    }
    setLoading(false);
  }, []);

  /** Save token and decode user info. */
  const login = (rawToken) => {
    localStorage.setItem('pe_token', rawToken);
    setToken(rawToken);
    const payload = decodeToken(rawToken);
    if (payload) setUser({ email: payload.sub, user_id: payload.user_id });
  };

  /** Clear session. */
  const logout = () => {
    localStorage.removeItem('pe_token');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
