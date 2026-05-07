/**
 * Auth is bypassed — app is always accessible without login.
 * This component is kept as a passthrough for routing compatibility.
 */
export default function ProtectedRoute({ children }) {
  return children;
}
