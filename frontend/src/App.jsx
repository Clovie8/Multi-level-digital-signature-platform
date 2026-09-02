import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
// Component Imports
import Auth from './pages/users/Auth';
import Dashboard from './pages/users/Dashboard';
import Documents from './pages/users/Documents';
import Settings from './pages/users/Settings';
import Sign from './pages/users/Sign';
import Upload from './pages/users/Upload';
import AdminDashboard from './pages/admin/AdminDashboard';
import AuditLog from './pages/admin/AuditLog';
import Layout from './components/Layout';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoutes from './routes/AdminRoutes';

function App() {
  return (
    <Router>
      <Toaster 
        position="top-center" 
        reverseOrder={false} 
        toastOptions={{
          style: { background: '#0f172a', color: '#fff', fontSize: '14px', borderRadius: '8px' },
        }}
      />

      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/sign/:token" element={<Sign />} />

        {/* ProtectedRoute verifies the session, then Layout renders the shell
          around whichever nested route matches (Dashboard, Documents, Settings).
        */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/upload" element={<Upload />} />

            {/* Admin-only routes*/}
            <Route element={<AdminRoutes />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/audit-logs" element={<AuditLog />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;