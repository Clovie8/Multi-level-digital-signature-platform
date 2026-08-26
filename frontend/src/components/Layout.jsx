import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, useOutletContext, Link } from 'react-router-dom';
import { PenTool, Menu, X, Home, FileSignature, Settings, LogOut, User, ChevronDown, ChevronLeft, ChevronRight,UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const generateInitials = (name) => {
  if (!name) return 'U';
  const nameParts = name.trim().split(' ');
  if (nameParts.length >= 2) {
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // New state for desktop toggle

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute already verified the session and fetched the user
  const { user } = useOutletContext();

  const currentUser = {
    name: user?.name || 'User',
    email: user?.email || '',
    initials: generateInitials(user?.name),
    role: 'User' // Placeholder until roles are added to schema
  };

  const handleSignOut = async () => {
    try {
      // Tell backend to destroy the HttpOnly cookie
      await api.post('/api/auth/logout', {});

      // Clear frontend auth flag
      localStorage.removeItem('isAuthenticated');

      toast.success('Securely signed out.');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      // Even if network fails, we should kick them to login
      localStorage.removeItem('isAuthenticated');
      navigate('/login', { replace: true });
    }
  };

  // Close the profile dropdown if the user clicks anywhere else on the screen
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Documents', href: '/documents', icon: FileSignature },
    { name: 'Upload', href: '/upload', icon: UploadCloud },
    { name: 'Settings', href: '/settings', icon: Settings },
  
  ];

  // Dynamically set the Header Title based on the current URL route
  const getPageTitle = () => {
    const currentRoute = navigation.find(item => item.href === location.pathname);
    return currentRoute ? currentRoute.name : 'Document Viewer';
  };

  const NavLinks = ({ isExpanded = true }) => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            title={!isExpanded ? item.name : ''} // Tooltip when collapsed
            className={`flex items-center py-2.5 mt-2 rounded-lg text-sm font-medium transition-colors ${
              isActive 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            } ${isExpanded ? 'px-3 justify-start' : 'px-0 justify-center'}`}
          >
            <item.icon className={`h-5 w-5 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} />
            {isExpanded && <span className="truncate">{item.name}</span>}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex h-screen bg-[#FAFAFA] font-sans overflow-hidden">
      
      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 z-20 relative transition-all duration-300 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}>
        
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="absolute -right-3 top-5 bg-slate-800 border border-slate-600 rounded-full p-1 text-slate-400 hover:text-white shadow-md z-50 focus:outline-none transition-colors"
        >
          {isSidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className={`flex items-center h-16 border-b border-slate-800 transition-all duration-300 ${isSidebarExpanded ? 'px-6 justify-start' : 'justify-center'}`}>
          <div className="h-8 w-8 bg-white rounded flex items-center justify-center shadow-sm flex-shrink-0">
            <PenTool className="text-slate-900 h-5 w-5" />
          </div>
          {isSidebarExpanded && (
            <span className="text-xl font-bold tracking-tight text-white ml-3 truncate">DSign</span>
          )}
        </div>
        
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden ${isSidebarExpanded ? 'px-4' : 'px-2'}`}>
          <NavLinks isExpanded={isSidebarExpanded} />
        </nav>
      </aside>

      {/* MOBILE OVERLAY & DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          <div className="relative flex flex-col w-64 max-w-xs bg-slate-900 h-full shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between px-6 h-16 border-b border-slate-800">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-white rounded flex items-center justify-center mr-3 flex-shrink-0">
                  <PenTool className="text-slate-900 h-5 w-5" />
                </div>
                <span className="text-xl font-bold tracking-tight text-white">DSign</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              <NavLinks isExpanded={true} />
            </nav>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP HEADER (Visible on both Desktop & Mobile) */}
        <header className="flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-b border-slate-200 shadow-sm z-10">
          
          {/* Left Side: Mobile Hamburger & Dynamic Page Title */}
          <div className="flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden mr-4 text-slate-500 hover:text-slate-900 focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {getPageTitle()}
            </h1>
          </div>

          {/* Right Side: User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center space-x-3 focus:outline-none group"
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{currentUser.name}</span>
                <span className="text-xs text-slate-500">{currentUser.role}</span>
              </div>
              <div className="h-9 w-9 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-medium ring-2 ring-slate-100 shadow-sm group-hover:bg-slate-800 transition-colors">
                {currentUser.initials}
              </div>
              <ChevronDown className={`hidden sm:block h-4 w-4 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-slate-900' : ''}`} />
            </button>

            {/* Dropdown Menu Box */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                
                {/* User Info Header (Mobile-friendly backup if they hide names on small screens) */}
                <div className="px-4 py-3 border-b border-slate-50 mb-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                </div>
                
                {/* Menu Actions */}
                <Link 
                  to="/settings" 
                  onClick={() => setIsProfileOpen(false)} 
                  className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <User className="mr-3 h-4 w-4 text-slate-400" />
                  Profile Settings
                </Link>
                
                <div className="h-px bg-slate-50 my-1"></div>
                
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="mr-3 h-4 w-4 text-red-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

        </header>

        {/* Dynamic Page Content (This is where Dashboard.jsx renders) */}
        <main className="flex-1 overflow-y-auto bg-[#FAFAFA]">
          <Outlet />
        </main>

      </div>
    </div>
  );
}