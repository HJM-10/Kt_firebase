import React, { useEffect, useState } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { User, Lock, Save } from 'lucide-react';

const SettingsPage = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { user, updateUser } = useAuthStore();
  
  // Profile State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password State
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const res = await api.put('/auth/me', profileForm);
      updateUser(res.data.data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }

    setPasswordLoading(true);
    try {
      await api.put('/auth/password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Password changed successfully');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile and application preferences</p>
      </div>

      <div className="grid-2">
        {/* Profile Settings */}
        <div className="card">
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }} className="flex items-center gap-8">
            <User size={20} className="text-primary" /> Profile Information
          </h2>
          <form onSubmit={handleProfileUpdate} className="flex-col gap-16">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" required className="form-input" 
                value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input type="email" className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.7 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="tel" className="form-input" 
                value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} 
              />
            </div>
            <button type="submit" className="btn btn-primary mt-8" disabled={profileLoading}>
              <Save size={16} /> {profileLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password & Security */}
        <div className="card">
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }} className="flex items-center gap-8">
            <Lock size={20} className="text-primary" /> Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="flex-col gap-16">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input 
                type="password" required minLength={1} className="form-input" 
                value={passwordForm.oldPassword} onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input 
                type="password" required minLength={6} className="form-input" 
                value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input 
                type="password" required minLength={6} className="form-input" 
                value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} 
              />
            </div>
            <button type="submit" className="btn btn-primary mt-8" disabled={passwordLoading}>
              <Save size={16} /> {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-24">
        <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Appearance</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Theme Preference</div>
            <div className="text-muted" style={{ fontSize: '13px' }}>Switch between Light and Dark mode</div>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary">
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
