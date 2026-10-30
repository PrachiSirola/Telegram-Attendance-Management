import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function SuperAdminRoute({ children }) {
  const token = useSelector((s) => s.auth.accessToken);
  const admin = useSelector((s) => s.auth.admin);
  const loc = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  if (admin?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
