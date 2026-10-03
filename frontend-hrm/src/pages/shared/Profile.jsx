import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  User,
  Mail,
  Briefcase,
  Camera,
  MapPin,
  Lock,
  CheckCircle2,
  UploadCloud,
  Eye,
  EyeOff
} from 'lucide-react';
import api from '../../utils/axios';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';

const Profile = ({ type = 'admin' }) => {
  const { updateUser } = useAuth();
  const { showAlert } = useUI();
  const { t } = useSettings();
  const [userData, setUserData] = useState({
    name: 'Loading...',
    role: 'Staff',
    email: '',
    location: 'Main Office',
    photo: ''
  });
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile');
      const user = response.data;
      setUserData({
        name: user.name || 'User',
        role: user.role || (type === 'admin' ? 'Administrator' : 'Employee'),
        email: user.email || '',
        location: user.location || 'Main Office',
        photo: user.photo || ''
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await api.put('/profile', {
        name: userData.name,
        role: userData.role,
        email: userData.email,
        location: userData.location,
        photo: userData.photo
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Update global user state
      updateUser({
        name: userData.name,
        role: userData.role,
        email: userData.email,
        photo: userData.photo
      });
      showAlert('Profile updated successfully', 'success');

    } catch (err) {
      console.error('Error updating profile:', err);
      showAlert('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!password || !oldPassword) return showAlert('Please enter both old and new passwords', 'warning');
    try {
      setIsSaving(true);
      await api.post('/settings/change-password', { old_password: oldPassword, new_password: password });
      showAlert('Password updated successfully', 'success');
      setPassword('');
      setOldPassword('');
    } catch (err) {
      console.error('Error updating password:', err);
      showAlert(err.response?.data?.error || 'Failed to update password', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserData(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left: Quick Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="card text-center p-8 bg-white border border-slate-100 shadow-xl rounded-[2rem]">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 rounded-full border-4 border-primary/10 p-1">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 border-2 border-white shadow-inner flex items-center justify-center">
                  <User size={64} className="text-slate-300" />
                </div>
              </div>
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">{userData.name}</h2>
            <div className="mt-2 inline-block px-4 py-1 bg-primary/5 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/10">
              {t(userData.role)}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                <Mail size={14} className="text-slate-300" /> {userData.email}
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
                <MapPin size={14} className="text-slate-300" /> {userData.location}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Edit Details */}
        <div className="md:col-span-2">
            <div className="card p-8 bg-white border border-slate-100 shadow-xl rounded-[2rem]">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{t('Personal Profile')}</h3>
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2 text-success text-xs font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100"
                    >
                      <CheckCircle2 size={16} /> {t('Update Successful')}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Full Name')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      type="text"
                      name="name"
                      value={userData.name}
                      onChange={handleChange}
                      readOnly={type === 'employee'}
                      className={`w-full rounded-2xl pl-12 pr-4 py-3 text-sm font-bold transition-all outline-none ${type === 'employee'
                          ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 border border-slate-100 text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white'
                        }`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Current Role')}</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      type="text"
                      name="role"
                      value={t(userData.role)}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-500 cursor-not-allowed outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Communication Email')}</label>
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-xs flex items-center gap-1">
                      🔒 {t('Locked (Super Admin Managed)')}
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      name="email"
                      value={userData.email}
                      disabled
                      readOnly
                      className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-500 cursor-not-allowed outline-none select-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Office Location')}</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      type="text"
                      name="location"
                      value={type === 'employee' ? t(userData.location) : userData.location}
                      onChange={handleChange}
                      readOnly={type === 'employee'}
                      className={`w-full rounded-2xl pl-12 pr-4 py-3 text-sm font-bold transition-all outline-none ${type === 'employee'
                          ? 'bg-slate-100 border border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 border border-slate-100 text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white'
                        }`}
                    />
                  </div>
                </div>

                {type !== 'employee' && (
                  <div className="md:col-span-2 pt-4">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {isSaving ? t('Processing Update...') : t('Confirm Profile Changes')}
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className="card p-8 bg-white border border-slate-100 shadow-xl rounded-[2rem] mt-6">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{t('Security Settings')}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('Current Password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder={t('Enter current password')}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-12 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('New Password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('Enter new password')}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-12 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handlePasswordUpdate}
                  disabled={isSaving || !password || !oldPassword}
                  className="btn-primary py-3 px-8 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 mt-2"
                >
                  {isSaving ? t('Updating...') : t('Change Password')}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      );
};

      export default Profile;
