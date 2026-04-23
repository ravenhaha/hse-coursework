import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) return null; // или свой лоадер
    if (!user) return <Navigate to="/auth" replace />;

    return children;
}