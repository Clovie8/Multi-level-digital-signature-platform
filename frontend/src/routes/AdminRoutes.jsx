import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

export default function AdminRoute() {
  const { user } = useOutletContext();

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet context={{ user }} />;
}