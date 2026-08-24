import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Mail, Lock, User, ArrowRight, Key, PenTool, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// InputField with Show/Hide Password Toggle
const InputField = ({ icon: Icon, type, name, placeholder, value, onChange, isPassword, inputRef }) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <input
        ref={inputRef}
        type={inputType}
        name={name}
        required
        value={value || ''}
        onChange={onChange}
        className="block w-full pl-9 pr-10 py-2 border border-slate-200 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors shadow-sm bg-white"
        placeholder={placeholder}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};

// Real-time Password Validation Component
const PasswordStrength = ({ password }) => {
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const Requirement = ({ met, text }) => {
    // Gray if empty, Red if typing but unmet, Green if met
    let colorClass = 'text-slate-500';
    if (password.length > 0) {
      colorClass = met ? 'text-green-600' : 'text-red-500';
    }

    return (
      <div className={`flex items-center text-xs ${colorClass} transition-colors duration-300`}>
        {met ? <CheckCircle2 className="h-3 w-3 mr-1.5" /> : <XCircle className="h-3 w-3 mr-1.5" />}
        <span>{text}</span>
      </div>
    );
  };

  return (
    <div className="mt-2 space-y-1.5 pl-1">
      <Requirement met={hasLength} text="At least 8 characters" />
      <Requirement met={hasNumber} text="Contains a number" />
      <Requirement met={hasSpecial} text="Contains a special character" />
    </div>
  );
};

// 6-Box OTP Input Component
const OTPInput = ({ value, onChange, autoFocus }) => {
  const inputs = useRef([]);
  const length = 6;
  const otpArray = value.padEnd(length, '').split('').slice(0, length);

  useEffect(() => {
    if (autoFocus && inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/[^0-9]/g, ''); // Ensure only numbers
    if (!val) return;
    
    const char = val[val.length - 1]; // Take just the last entered char
    const newOtpArray = [...otpArray];
    newOtpArray[index] = char;
    
    onChange({ target: { name: 'otp', value: newOtpArray.join('') } });

    // Move to next
    if (index < length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtpArray = [...otpArray];
      
      // If current box is empty, move back and delete that one
      if (!newOtpArray[index] && index > 0) {
        newOtpArray[index - 1] = '';
        inputs.current[index - 1].focus();
      } else {
        newOtpArray[index] = '';
      }
      
      onChange({ target: { name: 'otp', value: newOtpArray.join('') } });
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
    if (pastedData) {
      onChange({ target: { name: 'otp', value: pastedData } });
      const nextIndex = Math.min(pastedData.length, length - 1);
      inputs.current[nextIndex].focus();
    }
  };

  return (
    <div className="flex justify-between gap-2 mt-1">
      {Array(length).fill(0).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={2} 
          value={otpArray[i]}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className="w-10 h-12 text-center text-lg font-semibold border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-colors shadow-sm bg-white"
        />
      ))}
    </div>
  );
};


export default function Auth() {
  const navigate = useNavigate();
  // View states: 'login' | 'register' | 'verify' | 'forgot' | 'reset'
  const [view, setView] = useState('login');
  const [isLoading, setIsLoading] = useState(false);

  // Unified Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    otp: '',          // For email verification
    resetToken: '',   // For password reset
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Auto-Focusing Refs
  const loginEmailRef = useRef(null);
  const registerNameRef = useRef(null);
  const forgotEmailRef = useRef(null);
  const resetTokenRef = useRef(null);

  useEffect(() => {
    // Small delay to ensure the DOM is painted before focusing
    const timeout = setTimeout(() => {
      if (view === 'login' && loginEmailRef.current) loginEmailRef.current.focus();
      if (view === 'register' && registerNameRef.current) registerNameRef.current.focus();
      if (view === 'forgot' && forgotEmailRef.current) forgotEmailRef.current.focus();
      if (view === 'reset' && resetTokenRef.current) resetTokenRef.current.focus();
    }, 50);
    return () => clearTimeout(timeout);
  }, [view]);



  // API Handlers 

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });
      // JWT is now securely stored in an HttpOnly cookie automatically by the browser
      localStorage.setItem('isAuthenticated', 'true');
      toast.success('Welcome back to DSign.');
      navigate('/');
    } catch (err) {
      if (err.response?.data?.error === 'Account not verified. Please check your email.') {
        toast.error('Account not verified. A new code was sent to your email.');
        setView('verify'); 
      } else {
        toast.error(err.response?.data?.error || 'Invalid credentials');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    // Validate password strength before submitting
    const hasLength = formData.password.length >= 8;
    const hasNumber = /\d/.test(formData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
    if (!hasLength || !hasNumber || !hasSpecial) {
      return toast.error('Please ensure your password meets all requirements.');
    }

    setIsLoading(true);
    try {
      await api.post('/api/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      toast.success('Account created! Check your email for the code.');
      setView('verify');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (formData.otp.length !== 6) return toast.error('Please enter the full 6-digit code.');
    
    setIsLoading(true);
    try {
      await api.post('/api/auth/verify', {
        email: formData.email,
        otp: formData.otp
      });
      
      toast.success('Email verified successfully. Please log in.');
      setView('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!formData.email) {
      return toast.error('Email address is missing. Please try logging in again.');
    }
    
    setIsLoading(true);
    try {
      await api.post('/api/auth/resend-verification', {
        email: formData.email
      });
      toast.success('A new 6-digit code has been sent to your email.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/api/auth/forgot-password', {
        email: formData.email
      });
      
      toast.success('If that email exists, a reset link was sent.');
      setView('reset');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        email: formData.email,
        resetToken: formData.resetToken,
        newPassword: formData.password
      });
      
      toast.success('Password updated successfully.');
      setView('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid token or failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* DSign Branding Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
              <PenTool className="text-white h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">DSign</span>
          </div>
        </div>

        <h2 className="text-center text-xl font-semibold tracking-tight text-slate-900">
          {view === 'login' && 'Sign in to your account'}
          {view === 'register' && 'Create your account'}
          {view === 'verify' && 'Verify your email'}
          {view === 'forgot' && 'Reset your password'}
          {view === 'reset' && 'Set new password'}
        </h2>
        
        <p className="mt-2 text-center text-sm text-slate-500">
          {view === 'login' && (
            <>Don't have an account? <button onClick={() => setView('register')} className="text-blue-600 hover:text-blue-500 font-medium transition-colors">Sign up</button></>
          )}
          {view === 'register' && (
            <>Already have an account? <button onClick={() => setView('login')} className="text-blue-600 hover:text-blue-500 font-medium transition-colors">Sign in</button></>
          )}
          {view === 'verify' && `We sent a 6-digit code to ${formData.email || 'your email'}.`}
          {view === 'forgot' && 'Enter your email to receive a secure reset code.'}
          {view === 'reset' && 'Enter the reset code sent to your email.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px]">
        {/* Micro-Animations via CSS key keying */}
        <div key={view} className="bg-white py-8 px-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] sm:rounded-xl sm:px-10 border border-slate-100 animate-fade-in-up">
          
          {/* LOGIN VIEW */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <InputField inputRef={loginEmailRef} icon={Mail} type="email" name="email" placeholder="name@company.com" value={formData.email} onChange={handleChange} />
              <div>
                <InputField icon={Lock} type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} isPassword />
                <div className="flex items-center justify-end mt-2">
                  <button type="button" onClick={() => setView('forgot')} className="text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Forgot password?
                  </button>
                </div>
              </div>
              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-50">
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                {isLoading ? 'Authenticating...' : 'Sign in'}
              </button>
            </form>
          )}

          {/* REGISTER VIEW */}
          {view === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <InputField inputRef={registerNameRef} icon={User} type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} />
              <InputField icon={Mail} type="email" name="email" placeholder="name@company.com" value={formData.email} onChange={handleChange} />
              <div>
                <InputField icon={Lock} type="password" name="password" placeholder="Create a strong password" value={formData.password} onChange={handleChange} isPassword />
                <PasswordStrength password={formData.password} />
              </div>
              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none transition-all disabled:opacity-50 mt-4">
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
              {/* Escape Route */}
              <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                Back to sign in
              </button>
            </form>
          )}

          {/* VERIFY OTP VIEW */}
          {view === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="flex justify-center">
                 <OTPInput value={formData.otp} onChange={handleChange} autoFocus={true} />
              </div>
              
              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50 mt-4">
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                {isLoading ? 'Verifying...' : 'Verify Account'}
              </button>
              
              <div className="text-center mt-4">
                <button 
                  type="button" 
                  onClick={handleResend} 
                  disabled={isLoading}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
                >
                  Didn't receive it? <span className="text-blue-600 font-semibold">Resend code</span>
                </button>
              </div>

              {/* Escape Route */}
              <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                Back to sign in
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-5">
              <InputField inputRef={forgotEmailRef} icon={Mail} type="email" name="email" placeholder="Enter your registered email" value={formData.email} onChange={handleChange} />
              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50">
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                {isLoading ? 'Sending...' : 'Send Reset Link'} 
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
              
              {/* Escape Route */}
              <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                Back to sign in
              </button>
            </form>
          )}

          {/* RESET PASSWORD VIEW */}
          {view === 'reset' && (
            <form onSubmit={handleReset} className="space-y-5">
              <InputField inputRef={resetTokenRef} icon={Key} type="text" name="resetToken" placeholder="Enter 6-character reset code" value={formData.resetToken} onChange={handleChange} />
              <div>
                 <InputField icon={Lock} type="password" name="password" placeholder="Enter new password" value={formData.password} onChange={handleChange} isPassword />
                 <PasswordStrength password={formData.password} />
              </div>
              <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50 mt-4">
                {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />} 
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>

              {/* Escape Route */}
              <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                Back to sign in
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}