import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Component Imports
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Sign from './pages/Sign';
import Layout from './components/Layout'; 

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

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

        {/* Wrap all protected pages inside the Layout.
          The <Outlet /> inside Layout.jsx will render the specific nested route (like Dashboard).
        */}
        <Route 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Index route for the dashboard */}
          <Route path="/" element={<Dashboard />} />
          {/* Future routes will go here: <Route path="/documents" element={<Documents />} /> */}
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;