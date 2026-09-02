import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
// Component Imports
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Sign from './pages/Sign';
import Layout from './components/Layout';
import ProtectedRoute from './routes/ProtectedRoute';
import Upload from './pages/Upload';
import Review from './pages/Review';

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
            <Route path="/review/:id" element={<Review />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;