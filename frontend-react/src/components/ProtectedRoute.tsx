import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
export function ProtectedRoute({children}:{children:React.ReactNode}){const{user,loading}=useAuth();const location=useLocation();if(loading)return <div className="container py-24">Проверяем сессию...</div>;return user?children:<Navigate to="/login" state={{from:location.pathname}} replace/>}
