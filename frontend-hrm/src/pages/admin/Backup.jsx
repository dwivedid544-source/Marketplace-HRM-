import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  Mail, 
  Send,
  User, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  FileCode,
  ArrowRight,
  Sparkles,
  Calendar,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/axios';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const Backup = () => {
  const { showAlert, showConfirm } = useUI();
  const { user } = useAuth();
  const { t } = useSettings();

  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [sendToEmail, setSendToEmail] = useState(true);

  // Automated Backup Schedule State
  const [schedule, setSchedule] = useState({
    is_enabled: true,
    frequency_days: 7,
    target_email: '',
    last_run_at: null,
    next_run_at: null
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Custom Date Range State
  const [backupScope, setBackupScope] = useState('all'); // 'all' | 'custom'
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10)
  });

  // Action Loading States
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Restore File State
  const [restoreFile, setRestoreFile] = useState(null);

  useEffect(() => {
    fetchBackupInfo();
  }, []);

  const fetchBackupInfo = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backup/stats');
      if (res.data && res.data.success) {
        const fetchedEmail = res.data.admin?.email || user?.email || '';
        setAdminEmail(fetchedEmail);
        setAdminName(res.data.admin?.name || user?.name || 'Administrator');
        setLastBackup(res.data.lastBackup);
      }

      // Fetch automated schedule
      try {
        const schedRes = await api.get('/backup/schedule');
        if (schedRes.data && schedRes.data.success && schedRes.data.schedule) {
          const s = schedRes.data.schedule;
          setSchedule({
            is_enabled: !!s.is_enabled,
            frequency_days: s.frequency_days || 7,
            target_email: s.target_email || res.data?.admin?.email || user?.email || '',
            last_run_at: s.last_run_at,
            next_run_at: s.next_run_at
          });
        }
      } catch (sErr) {}
    } catch (err) {
      console.error('Error fetching backup info:', err);
      setAdminEmail(user?.email || '');
      setAdminName(user?.name || 'Administrator');
    } finally {
      setLoading(false);
    }
  };

  // ─── 0. SAVE AUTOMATED BACKUP SCHEDULE ───
  const handleSaveSchedule = async (e) => {
    e?.preventDefault();
    setIsSavingSchedule(true);
    try {
      const res = await api.post('/backup/schedule', {
        is_enabled: schedule.is_enabled,
        frequency_days: schedule.frequency_days,
        target_email: schedule.target_email || adminEmail
      });

      if (res.data && res.data.success) {
        showAlert(res.data.message || 'Automatic backup schedule saved successfully!', 'success');
        fetchBackupInfo();
      } else {
        showAlert(res.data?.message || 'Failed to save schedule', 'error');
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
      showAlert(err.response?.data?.message || 'Failed to save automatic backup schedule', 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // ─── 0. HANDLE DIRECT EMAIL BACKUP ACTION ───
  const handleSendEmailBackup = async (e) => {
    e?.preventDefault();
    if (!adminEmail || !adminEmail.includes('@')) {
      return showAlert('Please enter a valid recipient Email address.', 'warning');
    }

    if (backupScope === 'custom' && (!dateRange.startDate || !dateRange.endDate)) {
      return showAlert('Please select both From and To dates for custom backup.', 'warning');
    }

    setIsSendingEmail(true);
    try {
      const payload = {
        email: adminEmail.trim()
      };
      if (backupScope === 'custom') {
        payload.startDate = dateRange.startDate;
        payload.endDate = dateRange.endDate;
      }

      const res = await api.post('/backup/email', payload);

      if (res.data && res.data.success) {
        showAlert(res.data.message || `Database backup sent to ${adminEmail} successfully!`, 'success');
        fetchBackupInfo();
      } else {
        showAlert(res.data?.message || 'Failed to send backup email.', 'error');
      }
    } catch (err) {
      console.error('Email backup error:', err);
      showAlert(err.response?.data?.message || 'Failed to send database backup to email. Please verify SMTP settings.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ─── 1. HANDLE BACKUP ACTION ───
  const handleBackup = async (e) => {
    e?.preventDefault();
    setIsBackingUp(true);
    try {
      const payload = {
        email: adminEmail,
        sendToEmail: false
      };

      // Trigger file download stream
      const response = await api.post('/backup/download', payload, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      const downloadName = `hrm_software_backup_${timestamp}.sql`;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      showAlert('Database backup downloaded successfully!', 'success');
      fetchBackupInfo();
    } catch (err) {
      console.error('Backup error:', err);
      showAlert('Failed to generate database backup. Please try again.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // ─── 2. HANDLE RESTORE ACTION ───
  const handleRestore = async (e) => {
    e?.preventDefault();
    if (!restoreFile) {
      return showAlert('Please select a .sql or .json backup file to restore.', 'warning');
    }

    const confirmed = await showConfirm({
      title: 'Confirm Database Restore',
      message: `Are you sure you want to restore from "${restoreFile.name}"? This will update system tables with data from the backup file.`,
      confirmText: 'Restore Database',
      type: 'danger'
    });

    if (!confirmed) return;

    setIsRestoring(true);
    const formData = new FormData();
    formData.append('backupFile', restoreFile);

    try {
      const res = await api.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        showAlert(res.data.message || 'Database restored successfully!', 'success');
        setRestoreFile(null);
        fetchBackupInfo();
      } else {
        showAlert(res.data?.message || 'Restore failed.', 'error');
      }
    } catch (err) {
      console.error('Restore error:', err);
      showAlert(err.response?.data?.message || 'Failed to restore database from backup.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2.5">
            <Database className="text-primary w-6 h-6" /> {t('System Backup & Restore')}
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {t('Download complete database backup or restore data from a previous file')}
          </p>
        </div>
        <button
          onClick={fetchBackupInfo}
          disabled={loading}
          className="btn-secondary px-4 py-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{t('Refresh')}</span>
        </button>
      </div>

      {/* Admin Identity Card */}
      <div className="card p-6 bg-white border border-slate-100 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shadow-sm">
              <User size={22} />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t('Logged in Administrator')}</span>
              <h3 className="text-base font-black text-slate-800 leading-tight mt-0.5">{adminName}</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-0.5">
                <ShieldCheck size={13} /> {t('Full Administrator Access')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 px-4 rounded-2xl bg-slate-50 border border-slate-100 text-left">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1">
                <Clock size={11} /> {t('Last Backup Date')}
              </span>
              <span className="text-xs font-black text-slate-700 mt-0.5 block">
                {lastBackup ? new Date(lastBackup).toLocaleString() : t('No backup taken yet')}
              </span>
            </div>
          </div>
        </div>

        {/* Email Field Input with Direct Send Button */}
        <div className="mt-5">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 block mb-2">
            {t('Admin Notification & Backup Delivery Email')}
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                required
              />
            </div>
            <button
              onClick={handleSendEmailBackup}
              disabled={isSendingEmail || !adminEmail}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-primary-dark text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isSendingEmail ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t('Sending to Email...')}</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>{t('Send Backup to Email')}</span>
                </>
              )}
            </button>
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="px-6 py-3 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary-dark hover:to-purple-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              {isBackingUp ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t('Generating Backup...')}</span>
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span>{t('Take Backup Now')}</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1">
            💡 {t('Click "Take Backup Now" to download full database (.sql) directly, or click "Send Backup to Email" to receive it in your inbox.')}
          </p>
        </div>
      </div>

      {/* ─── RESTORE DATABASE ─── */}
      <div className="card p-7 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Upload size={24} />
            </div>
            <div>
              <h3 className="text-lg font-heading font-black text-slate-800 tracking-tight">
                {t('Restore Database')}
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {t('Upload a previously downloaded .sql or .json backup file to restore your system data.')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mt-6">
          <div className="sm:col-span-8">
            <label className="border-2 border-dashed border-slate-200 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/20 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors group">
              <input
                type="file"
                accept=".sql,.json"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    setRestoreFile(e.target.files[0]);
                  }
                }}
              />
              {restoreFile ? (
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <FileCode size={20} className="text-emerald-600 shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="text-xs font-black truncate max-w-[320px]">{restoreFile.name}</p>
                    <p className="text-[10px] font-bold text-slate-400">{(restoreFile.size / 1024).toFixed(1)} KB • Ready to restore</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Upload size={20} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-700 block">{t('Click to Select Backup File')}</span>
                    <span className="text-[10px] font-bold text-slate-400">{t('Supports .SQL & .JSON files')}</span>
                  </div>
                </div>
              )}
            </label>
          </div>

          <div className="sm:col-span-4">
            <button
              onClick={handleRestore}
              disabled={isRestoring || !restoreFile}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {isRestoring ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t('Restoring Database...')}</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>{t('Restore Database')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── OPTION 3: AUTOMATED BACKUP SCHEDULER ─── */}
      <div className="card p-7 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-black shadow-sm">
              <Clock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-heading font-black text-slate-800 tracking-tight">
                  {t('Automated Recurring Backup')}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  schedule.is_enabled 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {schedule.is_enabled ? 'Active • Auto-Running' : 'Disabled'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Automatically generate full database snapshots and email them on a recurring schedule.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSchedule(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
              className={`w-14 h-7 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                schedule.is_enabled ? 'bg-purple-600' : 'bg-slate-300'
              }`}
            >
              <motion.div
                animate={{ x: schedule.is_enabled ? 28 : 0 }}
                className="h-5 w-5 bg-white rounded-full shadow-sm"
              />
            </button>
            <span className="text-xs font-black text-slate-700">
              {schedule.is_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Frequency Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 block flex items-center gap-1.5">
              <Calendar size={14} className="text-purple-600" /> Backup Frequency (Schedule Interval)
            </label>
            <select
              value={schedule.frequency_days}
              onChange={e => setSchedule(prev => ({ ...prev, frequency_days: parseInt(e.target.value) }))}
              disabled={!schedule.is_enabled}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10 transition-all outline-none disabled:opacity-50 cursor-pointer"
            >
              <option value="7">Every 7 Days (Weekly - Fixed Schedule)</option>
            </select>
            <p className="text-[10px] font-bold text-slate-400 ml-1">
              Automatic backups are generated and emailed weekly every 7 days.
            </p>
          </div>

          {/* Target Email for Schedule */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 block flex items-center gap-1.5">
              <Mail size={14} className="text-purple-600" /> Delivery Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={schedule.target_email || adminEmail}
                onChange={e => setSchedule(prev => ({ ...prev, target_email: e.target.value }))}
                placeholder="admin@example.com"
                disabled={!schedule.is_enabled}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/10 transition-all outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-400 ml-1">
              Automated backups will be dispatched directly to this email via your company SMTP.
            </p>
          </div>
        </div>

        {/* Schedule Footer Status & Save */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-2">
            <Clock size={14} className="text-slate-400" />
            <span>
              {schedule.next_run_at 
                ? `Next automatic backup scheduled for: ${new Date(schedule.next_run_at).toLocaleDateString()}` 
                : `Active interval: Every ${schedule.frequency_days} Days`}
            </span>
          </div>

          <button
            onClick={handleSaveSchedule}
            disabled={isSavingSchedule}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md shadow-purple-600/20 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0 self-end sm:self-auto"
          >
            {isSavingSchedule ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving Schedule...</span>
              </>
            ) : (
              <>
                <Check size={15} />
                <span>Save Auto-Backup Schedule</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safety Note */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
        <p className="text-xs font-bold text-amber-900 leading-relaxed">
          <strong>Important:</strong> Restoring a backup will overwrite or sync current records with the uploaded backup file. Always take a fresh backup before restoring.
        </p>
      </div>
    </div>
  );
};

export default Backup;
