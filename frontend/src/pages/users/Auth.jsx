import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Mail, Lock, User, ArrowRight, Key, PenTool, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// InputField with Show/Hide Password Toggle
const InputField = ({ icon: Icon, type, name, placeholder, value, onChange, isPassword, inputRef, disabled }) => {
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
        disabled={disabled}
        value={value || ''}
        onChange={onChange}
        className="block w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-md text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors shadow-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
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
  const [otpArray, setOtpArray] = useState(Array(length).fill(''));

  // Sync with parent if cleared
  useEffect(() => {
    if (!value) setOtpArray(Array(length).fill(''));
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputs.current[0]) {
      inputs.current[0].focus();
    }
  }, [autoFocus]);

  const updateOtp = (newArray) => {
    setOtpArray(newArray);
    onChange({ target: { name: 'otp', value: newArray.join('') } });
  };

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (!val) {
      const newOtpArray = [...otpArray];
      newOtpArray[index] = '';
      updateOtp(newOtpArray);
      return;
    }

    const char = val.replace(/[^0-9]/g, '').slice(-1);
    if (!char) return;

    const newOtpArray = [...otpArray];
    newOtpArray[index] = char;
    updateOtp(newOtpArray);

    if (index < length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      e.preventDefault();
      const newOtpArray = [...otpArray];
      newOtpArray[index - 1] = '';
      inputs.current[index - 1].focus();
      updateOtp(newOtpArray);
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
  const [view, setView] = useState(() => {
    return sessionStorage.getItem('authView') || 'login';
  });

  useEffect(() => {
    sessionStorage.setItem('authView', view);
  }, [view]);

  const [isLoading, setIsLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    otp: '',
    resetToken: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const loginEmailRef = useRef(null);
  const registerNameRef = useRef(null);
  const forgotEmailRef = useRef(null);
  const resetTokenRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const isRegisterLink = params.get('register') === 'true';

    if (isRegisterLink && emailParam) {
      api.get(`/api/auth/check-invite?email=${encodeURIComponent(emailParam)}`)
        .then(async (res) => {
          if (res.data.isInvited) {
            setFormData((prev) => ({ ...prev, email: emailParam, name: res.data.name }));
            setIsInviteFlow(true);

            if (!res.data.isVerified) {
              try {
                await api.post('/api/auth/resend-verification', { email: emailParam });
                toast.success('A verification code was sent to your email.');
              } catch (err) {
                // ignore — they can use "resend code" on the verify screen if this fails
              }
              setView('verify');
            } else {
              setView('invite-password');
            }
          } else {
            setFormData((prev) => ({ ...prev, email: emailParam }));
            setView('register');
          }
        })
        .catch(() => {
          setFormData((prev) => ({ ...prev, email: emailParam }));
          setView('register');
        });
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (view === 'login' && loginEmailRef.current) loginEmailRef.current.focus();
      if (view === 'register' && registerNameRef.current) registerNameRef.current.focus();
      if (view === 'forgot' && forgotEmailRef.current) forgotEmailRef.current.focus();
      if (view === 'reset' && resetTokenRef.current) resetTokenRef.current.focus();
    }, 50);
    return () => clearTimeout(timeout);
  }, [view]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });
      localStorage.setItem('isAuthenticated', 'true');
      toast.success('Welcome back to DSign.');

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
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

      if (isInviteFlow) {
        toast.success('Email verified. Now set your password.');
        setView('invite-password');
      } else {
        toast.success('Email verified successfully. Please log in.');
        setView('login');
      }
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

  const handleCompleteInvite = async (e) => {
    e.preventDefault();
    const hasLength = formData.password.length >= 8;
    const hasNumber = /\d/.test(formData.password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
    if (!hasLength || !hasNumber || !hasSpecial) {
      return toast.error('Please ensure your password meets all requirements.');
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/complete-invite', {
        email: formData.email,
        password: formData.password,
      });
      localStorage.setItem('isAuthenticated', 'true');
      toast.success('Welcome to DSign.');

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate account.');
    } finally {
      setIsLoading(false);
    }
  };

  const headings = {
    login: { title: 'Sign in', subtitle: 'Enter your email and password' },
    register: { title: 'Create your account', subtitle: 'Set up your DSign account' },
    'invite-password': { title: 'Almost there', subtitle: 'Set a password to activate your account' },
    verify: { title: 'Verify your email', subtitle: `We sent a 6-digit code to ${formData.email || 'your email'}.` },
    forgot: { title: 'Reset your password', subtitle: 'Enter your email to receive a secure reset code.' },
    reset: { title: 'Set new password', subtitle: 'Enter the reset code sent to your email.' },
  };

  return (
    <div className="min-h-screen flex font-sans">

      {/* LEFT PANEL — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <PenTool className="text-slate-900 h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">DSign</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Legally binding<br />digital signatures
            </h1>
            <p className="text-slate-400 text-base max-w-sm">
              Route documents through multi-level approval hierarchies with cryptographically sealed, fully auditable workflows.
            </p>
          </div>

          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} DSign. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT PANEL — Form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-[#FAFAFA] px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* Mobile-only logo (hidden on desktop since the left panel shows it) */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center space-x-2">
              <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
                <PenTool className="text-white h-5 w-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">DSign</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {headings[view].title}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {view === 'login' && (
                <>{headings[view].subtitle} · <button onClick={() => setView('register')} className="text-blue-600 hover:text-blue-500 font-medium transition-colors">Sign up</button></>
              )}
              {view === 'register' && (
                <>{headings[view].subtitle} · <button onClick={() => setView('login')} className="text-blue-600 hover:text-blue-500 font-medium transition-colors">Sign in</button></>
              )}
              {(view === 'verify' || view === 'forgot' || view === 'reset' || view === 'invite-password') && headings[view].subtitle}
            </p>
          </div>

          <div key={view} className="bg-white py-8 px-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.08)] rounded-xl border border-slate-100 animate-fade-in-up">

            {/* LOGIN VIEW */}
            {view === 'login' && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/microsoft`}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                    Continue with Microsoft
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`}
                    className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400 font-medium">or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                    <InputField inputRef={loginEmailRef} icon={Mail} type="email" name="email" placeholder="name@example.com" value={formData.email} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                    <InputField icon={Lock} type="password" name="password" placeholder="Enter your password" value={formData.password} onChange={handleChange} isPassword />
                    <div className="flex items-center justify-end mt-2">
                      <button type="button" onClick={() => setView('forgot')} className="text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                  </div>
                  <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all disabled:opacity-50">
                    {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                    {isLoading ? 'Authenticating...' : 'Sign in'}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </button>
                </form>
              </div>
            )}

            {/* REGISTER VIEW */}
            {view === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <InputField inputRef={registerNameRef} icon={User} type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} />
                <InputField icon={Mail} type="email" name="email" placeholder="name@example.com" value={formData.email} onChange={handleChange} />
                <div>
                  <InputField icon={Lock} type="password" name="password" placeholder="Create a strong password" value={formData.password} onChange={handleChange} isPassword />
                  <PasswordStrength password={formData.password} />
                </div>
                <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none transition-all disabled:opacity-50 mt-4">
                  {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isLoading ? 'Creating account...' : 'Create account'}
                </button>
                <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                  Back to sign in
                </button>
              </form>
            )}

            {/* INVITE PASSWORD VIEW (shown after OTP is verified for invited users) */}
            {view === 'invite-password' && (
              <form onSubmit={handleCompleteInvite} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                  <InputField icon={User} type="text" name="name" value={formData.name} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <InputField icon={Mail} type="email" name="email" value={formData.email} disabled />
                </div>
                <div>
                  <InputField icon={Lock} type="password" name="password" placeholder="Create a strong password" value={formData.password} onChange={handleChange} isPassword />
                  <PasswordStrength password={formData.password} />
                </div>
                <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isLoading ? 'Setting up...' : 'Set Password & Sign In'}
                </button>
              </form>
            )}

            {/* VERIFY OTP VIEW */}
            {view === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="flex justify-center">
                  <OTPInput value={formData.otp} onChange={handleChange} autoFocus={true} />
                </div>

                <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50 mt-4">
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

                {!isInviteFlow && (
                  <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                    Back to sign in
                  </button>
                )}
              </form>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-5">
                <InputField inputRef={forgotEmailRef} icon={Mail} type="email" name="email" placeholder="Enter your registered email" value={formData.email} onChange={handleChange} />
                <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                  {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                </button>

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
                <button disabled={isLoading} type="submit" className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-all disabled:opacity-50 mt-4">
                  {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>

                <button type="button" onClick={() => setView('login')} className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 mt-2 transition-colors">
                  Back to sign in
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}