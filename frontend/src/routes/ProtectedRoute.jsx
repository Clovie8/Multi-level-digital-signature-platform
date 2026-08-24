import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import api from '../lib/api';

export default function ProtectedRoute() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authed' | 'unauthed'
  const [user, setUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    api.get('/api/auth/me')
      .then((res) => {
        if (!isMounted) return;
        setUser(res.data);
        setStatus('authed');
      })
      .catch(() => {
        if (isMounted) setStatus('unauthed');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet context={{ user }} />;
}
