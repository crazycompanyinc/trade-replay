import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
