import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Wraps any route that requires authentication.
 * If the user is not logged in → redirect to /login.
 * Shows nothing while auth state is being restored from localStorage.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // prevent flash of redirect while restoring session

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
