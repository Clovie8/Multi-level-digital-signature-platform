import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Loader2 } from 'lucide-react';

export default function Settings() {
  const { user } = useOutletContext();
  const [name, setName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const hasPassword = user?.authProvider === 'local' || !user?.authProvider;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name cannot be empty.');

    setIsSavingProfile(true);
    try {
      await api.patch('/api/auth/me', { name: name.trim() });
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return toast.error('Both password fields are required.');

    const hasLength = newPassword.length >= 8;
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    if (!hasLength || !hasNumber || !hasSpecial) {
      return toast.error('New password must be at least 8 characters, with a number and a special character.');
    }

    setIsSavingPassword(true);
    try {
      await api.patch('/api/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-full bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Account</p>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your profile and password.</p>
        </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">

          {/* Profile Section */}
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 h-fit">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-50 text-slate-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Email address cannot be changed.</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Password Section */}
          {hasPassword ? (
            <form onSubmit={handlePasswordSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Change Password</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-slate-900 focus:border-slate-900"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">At least 8 characters, with a number and a special character.</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingPassword}
                className="mt-5 flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isSavingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSavingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
              You sign in with {user?.authProvider === 'microsoft' ? 'Microsoft' : 'Google'}, so there's no password to manage here.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}