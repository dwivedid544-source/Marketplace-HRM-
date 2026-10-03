import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/axios';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES, getCountryByCode } from '../../config/countryConfig';
import {
  Settings as SettingsIcon,
  Cpu,
  Calendar,
  ShieldCheck,
  Save,
  Wifi,
  Fingerprint,
  Globe,
  Clock,
  Lock,
  Zap,
  AlertCircle,
  CreditCard,
  Eye,
  EyeOff,
  Mail,
  Send,
  Database,
  HelpCircle,
  Download,
  Printer,
  CheckCircle2,
  Receipt,
  Percent,
  Trash2,
  Power,
  Check,
  MessageSquare,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initiateRazorpayCheckout } from '../../utils/razorpay';
import WhatsAppConnectivity from '../../components/WhatsAppConnectivity';
import BroadcastMessaging from '../../components/BroadcastMessaging';

const Settings = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'payroll';
  const { showAlert, showConfirm } = useUI();
  const { user, updateUser } = useAuth();
  const { currencySymbol, refreshSettings, setLocalization, exchangeRates, ratesLoading, t } = useSettings();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    machine_ip: '',
    machine_port: 4370,
    machine_alias: '',
    sync_interval: 30,
    late_deduction: true,
    late_deduction_amount: 50,
    salary_cycle: '15 Days Cycle',
    salary_cycle_start_date: 1,
    ot_multiplier: 1.5,
    standard_start_time: '08:00',
    admin_password: '',
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    grace_period_mins: 15,
    standard_end_time: '17:00',
    contribution_enabled: false,
    default_employee_contribution_percentage: 0,
    default_employer_contribution_percentage: 0,
    weekends: 'Saturday,Sunday',
    country: 'India',
    currency: 'INR',
    language: 'English',
    timezone: 'Asia/Kolkata',
    date_format: 'DD/MM/YYYY'
  });
  const [currentPlan, setCurrentPlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeStatus, setPurgeStatus] = useState({ status: 'idle', message: '' });
  const [forceTimer, setForceTimer] = useState(null);
  const [tick, setTick] = useState(0);

  const DEFAULT_PROVIDERS = {
    gmail: {
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: '',
      sender_email: '',
      sender_name: '',
      is_active: true
    },
    brevo: {
      smtp_host: 'smtp-relay.brevo.com',
      smtp_port: 587,
      smtp_user: '',
      smtp_pass: '',
      sender_email: '',
      sender_name: '',
      is_active: true
    },
    resend: {
      smtp_host: 'smtp.resend.com',
      smtp_port: 587,
      smtp_user: 'resend',
      smtp_pass: '',
      sender_email: '',
      sender_name: '',
      is_active: true
    }
  };

  const [providerConfigs, setProviderConfigs] = useState(DEFAULT_PROVIDERS);
  const [activeConnectedProvider, setActiveConnectedProvider] = useState(null);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState('gmail'); // 'gmail' | 'brevo' | 'resend'
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const tabs = [
    { id: 'payroll', label: t('Payroll & Rules'), icon: <Calendar size={20} /> },
    { id: 'business', label: t('Business Profile'), icon: <Globe size={20} /> },
    { id: 'email', label: t('Email SMTP Settings'), icon: <Mail size={20} /> },
    { id: 'whatsapp', label: t('WhatsApp Connectivity'), icon: <MessageSquare size={20} /> },
    { id: 'messaging', label: t('Announcements & Messaging'), icon: <Megaphone size={20} /> },
    { id: 'notifications', label: t('Notifications & Alerts'), icon: <AlertCircle size={20} /> },
    { id: 'subscription', label: t('Subscription & Billing'), icon: <CreditCard size={20} /> }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'email') {
      api.get('/settings/email').then(res => {
        if (res.data && Object.keys(res.data).length > 0 && res.data.smtp_host) {
          const host = (res.data.smtp_host || '').toLowerCase();
          let detected = 'gmail';
          if (host.includes('brevo') || host.includes('sendinblue')) {
            detected = 'brevo';
          } else if (host.includes('resend')) {
            detected = 'resend';
          } else if (host.includes('gmail')) {
            detected = 'gmail';
          } else {
            detected = 'resend';
          }

          setActiveConnectedProvider(detected);
          setSmtpProvider(detected);
          setProviderConfigs(prev => ({
            ...prev,
            [detected]: {
              ...prev[detected],
              ...res.data
            }
          }));
        } else {
          setActiveConnectedProvider(null);
        }
      }).catch(err => {
        console.error('Error fetching email settings on tab switch:', err);
      });
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(prev => {
        const cleanedData = {};
        if (response.data) {
          Object.keys(response.data).forEach(key => {
            if (response.data[key] !== null && response.data[key] !== undefined) {
              cleanedData[key] = response.data[key];
            } else {
              cleanedData[key] = prev[key] !== undefined ? prev[key] : '';
            }
          });
        }
        return {
          ...prev,
          ...cleanedData,
          late_deduction: response.data?.late_deduction !== undefined ? !!response.data.late_deduction : prev.late_deduction,
          admin_password: '' // Don't show password
        };
      });
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
    try {
      const planRes = await api.get('/settings/current-plan');
      setCurrentPlan(planRes.data);
    } catch (err) {
      console.error('Error fetching plan:', err);
    }
    try {
      const plansList = await api.get('/plans');
      const paidPlans = (plansList.data || []).filter(p => {
        const name = (p.name || '').toLowerCase();
        const priceNum = parseFloat((p.price || '').toString().replace(/[^0-9.]/g, ''));
        return !name.includes('free') && !name.includes('trial') && (isNaN(priceNum) || priceNum > 0);
      });
      setAvailablePlans(paidPlans);
      if (paidPlans.length > 0) {
        setSelectedPlan(paidPlans[0].name);
      }
    } catch (err) {
      console.error('Error fetching available plans:', err);
    }
    try {
      const emailRes = await api.get('/settings/email');
      if (emailRes.data && Object.keys(emailRes.data).length > 0) {
        setEmailSettings(emailRes.data);
      }
    } catch (err) {
      console.error('Error fetching email settings:', err);
    }
    fetchInvoices();
  };

  const [invoices, setInvoices] = useState([]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/payment/invoices');
      setInvoices(res.data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  const handlePlanRequest = async (planName = selectedPlan) => {
    try {
      setIsRequesting(true);
      const orderRes = await api.post('/payment/create-order', { planName });
      const { orderId, amount, currency, keyId } = orderRes.data;

      await initiateRazorpayCheckout({
        orderId,
        amount,
        currency,
        keyId,
        planName,
        companyName: currentPlan?.company_name || user?.company_name || 'Company',
        customerName: user?.name || '',
        customerEmail: user?.email || '',
        customerPhone: user?.phone || '',
        onSuccess: async (response) => {
          try {
            await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            showAlert('Payment Successful! 🎉 Plan updated and active.', 'success');
            fetchSettings();
            fetchInvoices();
            window.dispatchEvent(new Event('subscription_updated'));
          } catch (verErr) {
            console.error('Payment verification failed:', verErr);
            showAlert(verErr.response?.data?.error || 'Verification failed. Please contact support.', 'error');
          } finally {
            setIsRequesting(false);
          }
        },
        onFailure: (failErr) => {
          console.warn('Payment cancelled/failed:', failErr);
          showAlert(failErr.message || 'Payment cancelled or failed.', 'warning');
          setIsRequesting(false);
        }
      });
    } catch (err) {
      console.error('Error initiating plan payment:', err);
      showAlert(err.response?.data?.error || 'Failed to initiate payment', 'error');
      setIsRequesting(false);
    }
  };

  const handleTestSubscription = async (status) => {
    try {
      await api.post('/settings/test-subscription', { status });
      fetchSettings();
      window.dispatchEvent(new Event('subscription_updated'));
    } catch (err) {
      console.error('Failed to set test subscription', err);
    }
  };



  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put('/settings', settings);

      // Update local storage and context user info to propagate localization changes immediately
      if (setLocalization) {
        setLocalization(prev => ({
          ...prev,
          country: settings.country || prev.country || 'India',
          currency: settings.currency || prev.currency || 'INR',
          language: settings.language || prev.language || 'English',
          timezone: settings.timezone || prev.timezone || 'Asia/Kolkata',
          dateFormat: settings.date_format || prev.dateFormat || 'DD/MM/YYYY'
        }));
      }

      if (updateUser) {
        updateUser({
          localization: {
            ...user?.localization,
            country: settings.country || 'India',
            currency: settings.currency || 'INR',
            language: settings.language || 'English',
            timezone: settings.timezone || 'Asia/Kolkata',
            date_format: settings.date_format || 'DD/MM/YYYY'
          }
        });
      }
      if (refreshSettings) {
        refreshSettings();
      }

      setIsSaving(false);
      showAlert('Settings updated successfully!', 'success');
    } catch (err) {
      console.error('Error saving settings:', err);
      setIsSaving(false);
      showAlert('Failed to update settings', 'error');
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      setIsSaving(true);
      const payload = providerConfigs[smtpProvider];
      await api.post('/settings/email', payload);
      setActiveConnectedProvider(smtpProvider);
      setIsSaving(false);
      showAlert(`${smtpProvider.toUpperCase()} SMTP settings saved & connected successfully!`, 'success');
    } catch (err) {
      console.error('Error saving email settings:', err);
      setIsSaving(false);
      showAlert(err.response?.data?.error || 'Failed to update email settings', 'error');
    }
  };

  const handleToggleEmailStatus = async () => {
    try {
      const currentConfig = providerConfigs[smtpProvider];
      const newStatus = !currentConfig.is_active;
      await api.patch('/settings/email/toggle', { is_active: newStatus });
      setProviderConfigs(prev => ({
        ...prev,
        [smtpProvider]: { ...prev[smtpProvider], is_active: newStatus }
      }));
      showAlert(`SMTP delivery status is now ${newStatus ? 'Active' : 'Inactive'}.`, 'success');
    } catch (err) {
      console.error('Error toggling SMTP status:', err);
      showAlert(err.response?.data?.error || 'Failed to update SMTP status', 'error');
    }
  };

  const handleRemoveEmailSettings = async () => {
    const confirmed = await showConfirm({
      title: 'Remove SMTP Configuration',
      message: 'Are you sure you want to remove your custom SMTP credentials? The system will revert to default email delivery.',
      confirmText: 'Yes, Remove SMTP',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setIsSaving(true);
      await api.delete('/settings/email');
      setActiveConnectedProvider(null);
      setProviderConfigs(DEFAULT_PROVIDERS);
      setIsSaving(false);
      showAlert('SMTP credentials removed successfully.', 'success');
    } catch (err) {
      console.error('Error removing email settings:', err);
      setIsSaving(false);
      showAlert(err.response?.data?.error || 'Failed to remove SMTP settings', 'error');
    }
  };

  const handleTestEmail = async () => {
    try {
      setIsTestingEmail(true);
      const res = await api.post('/settings/email/test');
      setIsTestingEmail(false);
      showAlert(res.data?.message || 'Test email sent successfully! Check your inbox.', 'success');
    } catch (err) {
      setIsTestingEmail(false);
      showAlert(err.response?.data?.error || 'Failed to send test email', 'error');
    }
  };

  const handlePurgeClick = () => {
    setPurgeStatus({ status: 'idle', message: '' });
    setShowPurgeModal(true);
  };

  const confirmPurge = async () => {
    setPurgeStatus({ status: 'loading', message: 'Purging machine data. Please wait...' });

    try {
      const response = await api.post('/machine/purge');
      if (response.data.success) {
        setPurgeStatus({ status: 'success', message: 'Machine Data Purged Successfully!' });
      } else {
        setPurgeStatus({ status: 'error', message: 'Purge failed: ' + response.data.message });
      }
    } catch (err) {
      console.error('Error purging machine:', err);
      setPurgeStatus({ status: 'error', message: 'Error: ' + (err.response?.data?.error || err.message) });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t('System Settings')}</h1>
          <p className="text-sm text-slate-500 font-medium">{t('Manage your biometric integration and payroll business rules.')}</p>
        </div>
        <button
          onClick={activeTab === 'email' ? handleSaveEmailSettings : handleSave}
          disabled={isSaving}
          className="btn-primary flex items-center justify-center gap-2 px-8 py-3 shadow-lg shadow-primary/20 relative overflow-hidden cursor-pointer"
        >
          {isSaving ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Zap size={18} />
            </motion.div>
          ) : <Save size={18} />}
          <span>{isSaving ? 'Saving...' : t('Save Changes')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] text-sm font-black transition-all group ${activeTab === tab.id
                    ? 'bg-primary text-white shadow-xl shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                <div className={`transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>
                  {tab.icon}
                </div>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">            {activeTab === 'payroll' && (
              <motion.div
                key="payroll"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="card">
                  <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-50">
                    <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-600 shadow-sm">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{t('Attendance & Payout Logic')}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Business rules for salary calculation')}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="group flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-800">{t('Automatic Late Deduction')}</h4>
                        <p className="text-xs font-bold text-slate-500">{t('Enable 15-minute buffer before deducting half-day or late fine.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, late_deduction: !prev.late_deduction }))}
                        className={`w-14 h-7 rounded-full relative transition-all p-1.5 shadow-lg ${settings.late_deduction ? 'bg-primary shadow-primary/20' : 'bg-slate-300'}`}
                      >
                        <motion.div
                          animate={{ x: settings.late_deduction ? 28 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    {settings.late_deduction && (
                      <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-rose-900">{t('Late Penalty Amount')}</h4>
                            <p className="text-[10px] font-bold text-rose-600/80">{t('Amount to deduct per late arrival.')}</p>
                          </div>
                          <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400 font-bold text-xs">{currencySymbol}</span>
                            <input
                              type="number"
                              name="late_deduction_amount"
                              value={settings.late_deduction_amount}
                              onChange={handleChange}
                              className="w-full bg-white border border-rose-200 rounded-xl pl-8 pr-4 py-2 text-sm font-bold text-rose-900 focus:ring-2 focus:ring-rose-500/20"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-rose-100 pt-4 mt-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-black text-rose-900">{t('Grace Period (Minutes)')}</h4>
                            <p className="text-[10px] font-bold text-rose-600/80">{t('Allowed buffer time before late deduction applies.')}</p>
                          </div>
                          <div className="relative w-32">
                            <input
                              type="number"
                              name="grace_period_mins"
                              value={settings.grace_period_mins !== undefined ? settings.grace_period_mins : 15}
                              onChange={handleChange}
                              className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-sm font-bold text-rose-900 focus:ring-2 focus:ring-rose-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Salary Payout Cycle')}</label>
                        <select
                          name="salary_cycle"
                          value={settings.salary_cycle}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                        >
                          <option value="15 Days Cycle">{t('15 Days Cycle')}</option>
                          <option value="Monthly (1st to 30th)">{t('Monthly (1st to 30th)')}</option>
                          <option value="Weekly Payout">{t('Weekly Payout')}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Salary Cycle Start Date')}</label>
                        <input
                          type="number"
                          name="salary_cycle_start_date"
                          min="1"
                          max="28"
                          value={settings.salary_cycle_start_date || 1}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('OT (Overtime) Multiplier')}</label>
                        <input
                          type="number"
                          step="0.1"
                          name="ot_multiplier"
                          value={settings.ot_multiplier}
                          onChange={handleChange}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Standard Start Time')}</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="time"
                            name="standard_start_time"
                            value={settings.standard_start_time}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Standard End Time')}</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="time"
                            name="standard_end_time"
                            value={settings.standard_end_time}
                            onChange={handleChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Weekend Off-Days')}</label>
                      <p className="text-[10px] font-bold text-slate-500 ml-1 mb-2">{t('Select the days that are considered weekends/off-days for overtime calculation.')}</p>
                      <div className="flex flex-wrap gap-3">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                          const isSelected = settings.weekends?.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const currentWeekends = settings.weekends ? settings.weekends.split(',').filter(d => d.trim() !== '') : [];
                                let newWeekends;
                                if (isSelected) {
                                  newWeekends = currentWeekends.filter(d => d !== day);
                                } else {
                                  newWeekends = [...currentWeekends, day];
                                }
                                setSettings({ ...settings, weekends: newWeekends.join(',') });
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected
                                  ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 scale-105'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40 hover:bg-slate-50'
                                }`}
                            >
                              {t(day)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contribution & Retirement Deduction Settings */}
                <div className="card">
                  <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-50">
                    <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-600 shadow-sm">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{t('Contribution & Deduction Rules')}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Global rules for PF, Retirement, 401k & Social Security')}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="group flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-800">{t('Enable Company Contribution System')}</h4>
                        <p className="text-xs font-bold text-slate-500">{t('Enable automatic employee deduction and employer contribution calculations during payroll.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, contribution_enabled: !prev.contribution_enabled }))}
                        className={`w-14 h-7 rounded-full relative transition-all p-1.5 shadow-lg ${settings.contribution_enabled ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-slate-300'}`}
                      >
                        <motion.div
                          animate={{ x: settings.contribution_enabled ? 28 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    {settings.contribution_enabled && (
                      <div className="p-6 bg-emerald-50/60 rounded-[2rem] border border-emerald-100 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Employee Contribution */}
                          <div className="p-5 bg-white rounded-2xl border border-emerald-100/80 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Percent size={14} className="text-emerald-600" /> {t('Employee Contribution')}
                              </span>
                              <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase">
                                {t('Salary Deduction')}
                              </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                              {t('Default percentage deducted from employee\'s gross monthly/hourly wages.')}
                            </p>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                name="default_employee_contribution_percentage"
                                value={settings.default_employee_contribution_percentage ?? 0}
                                onChange={handleChange}
                                placeholder="e.g. 12.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-black text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                              />
                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                            </div>
                          </div>

                          {/* Employer Contribution */}
                          <div className="p-5 bg-white rounded-2xl border border-emerald-100/80 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Percent size={14} className="text-blue-600" /> {t('Employer Contribution')}
                              </span>
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                                {t('Company Paid')}
                              </span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                              {t('Default percentage added by the employer on top of employee gross pay.')}
                            </p>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                name="default_employer_contribution_percentage"
                                value={settings.default_employer_contribution_percentage ?? 0}
                                onChange={handleChange}
                                placeholder="e.g. 12.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-black text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                              />
                              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-white/80 rounded-xl border border-emerald-100 flex items-start gap-2.5">
                          <span className="text-emerald-600 text-sm">💡</span>
                          <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                            <strong>{t('Employee-Level Overrides:')}</strong> {t('Individual employees can have custom percentage overrides or be opted-in/out separately from their Employee Profile → Compensation & Sign tab.')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'business' && (
              <motion.div
                key="business"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="card">
                  <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-50">
                    <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-600 shadow-sm">
                      <Globe size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{t('Business Identity')}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Company details for reports & payslips')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                        {t('Business Name')}
                        <Lock size={10} className="text-slate-300" />
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="business_name"
                          value={settings.business_name || ''}
                          readOnly
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-slate-500 cursor-not-allowed"
                        />
                        <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 ml-1">{t('Managed by Super Admin. Contact your provider to change.')}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                        {t('Contact Phone')}
                        <Lock size={10} className="text-slate-300" />
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="business_phone"
                          value={settings.business_phone || ''}
                          readOnly
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-slate-500 cursor-not-allowed"
                        />
                        <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                        {t('Email Address')}
                        <Lock size={10} className="text-slate-300" />
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          name="business_email"
                          value={settings.business_email || ''}
                          readOnly
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-slate-500 cursor-not-allowed"
                        />
                        <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                      </div>
                    </div>
                    {/* Country Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Operating Country')}</label>
                      <select
                        name="country"
                        value={settings.country || 'India'}
                        onChange={e => {
                          const selectedCountry = e.target.value;
                          const countryObj = getCountryByCode(selectedCountry);
                          setSettings(prev => ({
                            ...prev,
                            country: selectedCountry,
                            currency: countryObj ? countryObj.currency : prev.currency,
                            language: countryObj ? countryObj.defaultLanguage : prev.language,
                            timezone: countryObj ? countryObj.defaultTimezone : prev.timezone
                          }));
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        {SUPPORTED_COUNTRIES.map(c => (
                          <option key={c.code} value={c.name}>
                            {c.flag} {c.name} ({c.code}) - {c.currency} ({c.currencySymbol})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* System Currency */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('System Currency')}</label>
                        {exchangeRates && (
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Zap size={10} /> {t('Live API: 1 USD =')} ₹{(exchangeRates['INR'] || 96.06).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <select
                        name="currency"
                        value={settings.currency || 'INR'}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        {SUPPORTED_CURRENCIES.map(curr => (
                          <option key={curr.code} value={curr.code}>
                            {curr.name}
                          </option>
                        ))}
                      </select>
                      {settings.currency && settings.currency !== 'INR' && exchangeRates && (
                        <p className="text-[10px] font-semibold text-emerald-600 ml-1 flex items-center gap-1">
                          <Check size={12} /> {t('Auto live conversion active')} (1 {settings.currency} ≈ ₹{((exchangeRates['INR'] || 96.06) / (exchangeRates[settings.currency] || 1)).toFixed(2)} INR)
                        </p>
                      )}
                    </div>

                    {/* System Language */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('System Language')}</label>
                      <select
                        name="language"
                        value={settings.language || 'English'}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.name}>
                            {lang.name} ({lang.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Timezone */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Timezone')}</label>
                      <select
                        name="timezone"
                        value={settings.timezone || 'Asia/Kolkata'}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30) - 🇮🇳 India</option>
                        <option value="America/New_York">America/New_York (EST) - 🇺🇸 USA</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST) - 🇺🇸 USA</option>
                        <option value="Europe/London">Europe/London (GMT) - 🇬🇧 UK</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00) - 🇦🇪 UAE</option>
                        <option value="Europe/Berlin">Europe/Berlin (CET +1:00) - 🇩🇪 Germany</option>
                        <option value="Europe/Madrid">Europe/Madrid (CET +1:00) - 🇪🇸 Spain</option>
                      </select>
                    </div>

                    {/* Date Format */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Date Format')}</label>
                      <select
                        name="date_format"
                        value={settings.date_format || 'DD/MM/YYYY'}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (UK, India, UAE, Spain, Germany)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (USA)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO International)</option>
                      </select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Address')}</label>
                      <textarea
                        name="business_address"
                        value={settings.business_address || ''}
                        onChange={handleChange}
                        rows="3"
                        placeholder={t('Street, City, Province, Code')}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="card p-8">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="bg-sky-500/10 p-3 rounded-2xl text-sky-600 shadow-sm">
                        <Mail size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800">{t('SMTP Settings')}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Configure your company email delivery')}</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleTestEmail}
                      disabled={isTestingEmail}
                      className="btn-secondary flex items-center gap-2 text-sm cursor-pointer"
                    >
                      {isTestingEmail ? <Zap size={16} className="animate-spin" /> : <Send size={16} />}
                      {t('Test Connection')}
                    </button>
                  </div>

                  {/* Provider Selection Tabs */}
                  <div className="mb-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block mb-2.5">
                      {t('Select Email Service Provider')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60">
                      {/* Tab 1: Gmail */}
                      <button
                        type="button"
                        onClick={() => setSmtpProvider('gmail')}
                        className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          smtpProvider === 'gmail'
                            ? 'bg-white text-rose-600 shadow-sm border border-slate-200/50 scale-[1.01]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="truncate">{t('Gmail / Workspace')}</span>
                        {activeConnectedProvider === 'gmail' && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black tracking-normal bg-emerald-100 text-emerald-700 border border-emerald-300">
                            {t('Active')}
                          </span>
                        )}
                      </button>

                      {/* Tab 2: Brevo */}
                      <button
                        type="button"
                        onClick={() => setSmtpProvider('brevo')}
                        className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          smtpProvider === 'brevo'
                            ? 'bg-white text-sky-600 shadow-sm border border-slate-200/50 scale-[1.01]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
                        <span className="truncate">{t('Brevo (Sendinblue)')}</span>
                        {activeConnectedProvider === 'brevo' && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black tracking-normal bg-emerald-100 text-emerald-700 border border-emerald-300">
                            {t('Active')}
                          </span>
                        )}
                      </button>

                      {/* Tab 3: Resend */}
                      <button
                        type="button"
                        onClick={() => setSmtpProvider('resend')}
                        className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          smtpProvider === 'resend'
                            ? 'bg-white text-violet-600 shadow-sm border border-slate-200/50 scale-[1.01]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0"></span>
                        <span className="truncate">{t('Resend (API & SMTP)')}</span>
                        {activeConnectedProvider === 'resend' && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black tracking-normal bg-emerald-100 text-emerald-700 border border-emerald-300">
                            {t('Active')}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Connected Status / Warning Alert */}
                  {activeConnectedProvider && activeConnectedProvider !== smtpProvider && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <p className="text-xs font-black text-amber-900">
                            {activeConnectedProvider.toUpperCase()} {t('is already connected & active!')}
                          </p>
                          <p className="text-[11px] font-medium text-amber-700 mt-0.5">
                            {t('Your company is currently sending emails via')} <strong>{activeConnectedProvider === 'gmail' ? 'Gmail / Workspace' : activeConnectedProvider === 'brevo' ? 'Brevo' : 'Resend'}</strong>. {t('Saving this')} <strong>{smtpProvider.toUpperCase()}</strong> {t('tab will switch your active email provider.')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSmtpProvider(activeConnectedProvider)}
                        className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer whitespace-nowrap"
                      >
                        {t('View Active')} ({activeConnectedProvider.toUpperCase()})
                      </button>
                    </div>
                  )}

                  {activeConnectedProvider && activeConnectedProvider === smtpProvider && (
                    <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <p className="text-xs font-black text-emerald-900">
                        {t('Currently Connected & Active:')} <span className="uppercase text-emerald-700 font-extrabold">{smtpProvider === 'gmail' ? 'Gmail / Workspace' : smtpProvider === 'brevo' ? 'Brevo' : 'Resend'}</span> {t('is live and delivering emails for your company.')}
                      </p>
                    </div>
                  )}

                  {/* Provider Info Banner */}
                  {smtpProvider === 'gmail' && (
                    <div className="mb-6 p-4 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-start gap-3">
                      <span className="text-rose-600 text-base">🔴</span>
                      <div className="text-[11px] font-bold text-slate-700 leading-relaxed">
                        <strong className="text-rose-900">{t('Gmail Setup:')}</strong> {t('Use your standard Gmail address and generate a 16-character')} <strong>{t('Google App Password')}</strong> {t('(myaccount.google.com → Security → 2-Step Verification → App Passwords). Standard password will not work.')}
                      </div>
                    </div>
                  )}

                  {smtpProvider === 'brevo' && (
                    <div className="mb-6 p-4 rounded-2xl bg-sky-50/70 border border-sky-100 flex items-start gap-3">
                      <span className="text-sky-600 text-base">🔵</span>
                      <div className="text-[11px] font-bold text-slate-700 leading-relaxed">
                        <strong className="text-sky-900">{t('Brevo (Sendinblue) Setup:')}</strong> {t('Host')} (<code className="bg-white px-1.5 py-0.5 rounded text-sky-700 font-mono">smtp-relay.brevo.com</code>) {t('is pre-filled. Enter your Brevo Login Email in Username and your Brevo SMTP Master Key in Password/Key. (Brevo Dashboard → SMTP & API → Generate a new SMTP key).')}
                      </div>
                    </div>
                  )}

                  {smtpProvider === 'resend' && (
                    <div className="mb-6 p-4 rounded-2xl bg-violet-50/70 border border-violet-100 flex items-start gap-3">
                      <span className="text-violet-600 text-base">🟣</span>
                      <div className="text-[11px] font-bold text-slate-700 leading-relaxed">
                        <strong className="text-violet-900">{t('Resend Setup:')}</strong> {t('Host')} (<code className="bg-white px-1.5 py-0.5 rounded text-violet-700 font-mono">smtp.resend.com:587</code>) {t('and Username')} (<code className="bg-white px-1.5 py-0.5 rounded text-violet-700 font-mono">resend</code>) {t('are pre-configured. Enter your Resend API Key starting with')} <code className="bg-white px-1.5 py-0.5 rounded text-violet-700 font-mono">re_...</code> {t('in the Password/Key field and your verified domain email as Sender Email.')}
                      </div>
                    </div>
                  )}

                  {/* Form Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('SMTP Host')}</label>
                      <input
                        type="text"
                        value={providerConfigs[smtpProvider]?.smtp_host || ''}
                        onChange={(e) => setProviderConfigs(prev => ({
                          ...prev,
                          [smtpProvider]: { ...prev[smtpProvider], smtp_host: e.target.value }
                        }))}
                        placeholder={smtpProvider === 'brevo' ? 'smtp-relay.brevo.com' : smtpProvider === 'resend' ? 'smtp.resend.com' : 'smtp.gmail.com'}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('SMTP Port')}</label>
                      <input
                        type="number"
                        value={providerConfigs[smtpProvider]?.smtp_port || 587}
                        onChange={(e) => setProviderConfigs(prev => ({
                          ...prev,
                          [smtpProvider]: { ...prev[smtpProvider], smtp_port: e.target.value }
                        }))}
                        placeholder="587"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        {smtpProvider === 'brevo' ? t('Brevo Login Email / Username') : smtpProvider === 'resend' ? t('Resend Username (Default: resend)') : t('SMTP Username')}
                      </label>
                      <input
                        type="text"
                        value={providerConfigs[smtpProvider]?.smtp_user || ''}
                        onChange={(e) => setProviderConfigs(prev => ({
                          ...prev,
                          [smtpProvider]: { ...prev[smtpProvider], smtp_user: e.target.value }
                        }))}
                        placeholder={smtpProvider === 'brevo' ? 'your-brevo-account@email.com' : smtpProvider === 'resend' ? 'resend' : 'your-email@gmail.com'}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                        {smtpProvider === 'brevo' ? t('Brevo SMTP Master Key') : smtpProvider === 'resend' ? t('Resend API Key') : t('SMTP Password / App Password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showSmtpPass ? 'text' : 'password'}
                          value={providerConfigs[smtpProvider]?.smtp_pass || ''}
                          onChange={(e) => setProviderConfigs(prev => ({
                            ...prev,
                            [smtpProvider]: { ...prev[smtpProvider], smtp_pass: e.target.value }
                          }))}
                          placeholder={smtpProvider === 'brevo' ? 'xsmtpib-...' : smtpProvider === 'resend' ? 're_123456789...' : '16-character App Password'}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-4 pr-11 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 ml-1">
                        {smtpProvider === 'brevo' 
                          ? t('Generate from Brevo → SMTP & API Keys') 
                          : smtpProvider === 'resend'
                          ? t('Generate from resend.com → API Keys')
                          : t('Use App Passwords for Gmail')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Sender Email')}</label>
                      <input
                        type="email"
                        value={providerConfigs[smtpProvider]?.sender_email || ''}
                        onChange={(e) => setProviderConfigs(prev => ({
                          ...prev,
                          [smtpProvider]: { ...prev[smtpProvider], sender_email: e.target.value }
                        }))}
                        placeholder={smtpProvider === 'resend' ? 'onboarding@resend.dev or hr@yourdomain.com' : 'noreply@company.com'}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('Sender Name')}</label>
                      <input
                        type="text"
                        value={providerConfigs[smtpProvider]?.sender_name || ''}
                        onChange={(e) => setProviderConfigs(prev => ({
                          ...prev,
                          [smtpProvider]: { ...prev[smtpProvider], sender_name: e.target.value }
                        }))}
                        placeholder="HR Department"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* SMTP Status & Management Action Bar */}
                  <div className="mt-8 p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={handleToggleEmailStatus}
                        className={`w-12 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                          providerConfigs[smtpProvider]?.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      >
                        <motion.div
                          animate={{ x: providerConfigs[smtpProvider]?.is_active ? 24 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-800">{t('SMTP Delivery Status:')}</span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            providerConfigs[smtpProvider]?.is_active 
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-200 text-slate-600 border border-slate-300'
                          }`}>
                            {providerConfigs[smtpProvider]?.is_active ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {t('Active')}
                              </>
                            ) : (
                              t('Inactive')
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                          {providerConfigs[smtpProvider]?.is_active 
                            ? t('Your company SMTP is currently active and delivering emails.') 
                            : t('SMTP is currently disabled. System defaults will be used.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {(providerConfigs[smtpProvider]?.smtp_host || providerConfigs[smtpProvider]?.smtp_user) && (
                        <button
                          type="button"
                          onClick={handleRemoveEmailSettings}
                          disabled={isSaving}
                          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>{t('Remove SMTP')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveEmailSettings}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                      >
                        {isSaving ? <Zap size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{t('Save Settings')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic SMTP Setup Guide based on selected provider */}
                  <div className="mt-8 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6">
                    <div className="flex gap-4">
                      <div className="mt-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          smtpProvider === 'gmail' 
                            ? 'bg-rose-100 text-rose-600' 
                            : smtpProvider === 'brevo' 
                            ? 'bg-sky-100 text-sky-600' 
                            : 'bg-violet-100 text-violet-600'
                        }`}>
                          <HelpCircle size={18} />
                        </div>
                      </div>
                      <div className="space-y-4 flex-1">
                        {smtpProvider === 'gmail' && (
                          <>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">{t('How to Setup Gmail SMTP & App Password')}</h4>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {t('To send automated emails (payslips, notifications), you must configure your Gmail account.')} <strong>{t('Standard Google login password will not work; you must use a 16-character App Password.')}</strong>
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('1. Standard Gmail Settings')}</h5>
                                <ul className="text-xs text-slate-600 space-y-2 font-medium">
                                  <li><strong className="text-slate-800">{t('SMTP Host')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-rose-600 font-mono">smtp.gmail.com</code></li>
                                  <li><strong className="text-slate-800">{t('SMTP Port')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-rose-600 font-mono">587</code> {t('(TLS recommended)')}</li>
                                  <li><strong className="text-slate-800">{t('SMTP Username')}:</strong> {t('Your actual Gmail address')} (<code className="bg-white px-1 py-0.5 rounded border border-slate-200">hr@gmail.com</code>)</li>
                                  <li><strong className="text-slate-800">{t('Sender Email')}:</strong> {t('Same as your Gmail address')}</li>
                                </ul>
                              </div>
                              
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('2. Google App Password Steps')}</h5>
                                <ol className="text-xs text-slate-600 space-y-2 font-medium list-decimal list-inside">
                                  <li>{t('Enable 2-Step Verification on your Google Account.')}</li>
                                  <li>{t('Visit')} <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-rose-600 font-bold hover:underline">{t('Google App Passwords')}</a>.</li>
                                  <li>{t('Enter App Name (e.g. "HRM System") & click Create/Generate.')}</li>
                                  <li>{t('Copy the generated 16-character code.')}</li>
                                  <li>{t('Paste it into the SMTP Password field above & click Save.')}</li>
                                </ol>
                              </div>
                            </div>
                          </>
                        )}

                        {smtpProvider === 'brevo' && (
                          <>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">{t('How to Setup Brevo (Sendinblue) SMTP & Master Key')}</h4>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {t('Brevo is ideal for high-deliverability transactional emails with free 300 emails/day quota.')}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('1. Brevo Relay Parameters')}</h5>
                                <ul className="text-xs text-slate-600 space-y-2 font-medium">
                                  <li><strong className="text-slate-800">{t('SMTP Host')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-600 font-mono">smtp-relay.brevo.com</code></li>
                                  <li><strong className="text-slate-800">{t('SMTP Port')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-sky-600 font-mono">587</code> {t('(STARTTLS)')}</li>
                                  <li><strong className="text-slate-800">{t('Username')}:</strong> {t('Your Brevo account email')}</li>
                                  <li><strong className="text-slate-800">{t('Sender Email')}:</strong> {t('Must be verified under Brevo Senders list')}</li>
                                </ul>
                              </div>
                              
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('2. Brevo SMTP Key Steps')}</h5>
                                <ol className="text-xs text-slate-600 space-y-2 font-medium list-decimal list-inside">
                                  <li>{t('Log in to your Brevo account (app.brevo.com).')}</li>
                                  <li>{t('Click your profile name (top-right) → select')} <strong className="text-slate-800">SMTP & API</strong>.</li>
                                  <li>{t('Under')} <strong className="text-slate-800">SMTP</strong> {t('tab, click')} <strong className="text-sky-600">{t('Generate a new SMTP key')}</strong>.</li>
                                  <li>{t('Copy the master key starting with')} <code className="bg-white px-1 py-0.5 rounded text-sky-700 font-mono">xsmtpib-...</code>.</li>
                                  <li>{t('Paste it into the Brevo SMTP Master Key field above & Save.')}</li>
                                </ol>
                              </div>
                            </div>
                          </>
                        )}

                        {smtpProvider === 'resend' && (
                          <>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">{t('How to Setup Resend SMTP & API Key')}</h4>
                              <p className="text-xs font-medium text-slate-500 mt-1">
                                {t('Resend provides modern transactional email infrastructure with fast deliverability.')}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('1. Standard Resend Parameters')}</h5>
                                <ul className="text-xs text-slate-600 space-y-2 font-medium">
                                  <li><strong className="text-slate-800">{t('SMTP Host')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-violet-600 font-mono">smtp.resend.com</code></li>
                                  <li><strong className="text-slate-800">{t('SMTP Port')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-violet-600 font-mono">587</code> {t('(TLS/STARTTLS)')}</li>
                                  <li><strong className="text-slate-800">{t('SMTP Username')}:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-violet-600 font-mono">resend</code> {t('(Always "resend")')}</li>
                                  <li><strong className="text-slate-800">{t('Sender Email')}:</strong> {t('Your verified domain email (e.g. hr@company.com)')}</li>
                                </ul>
                              </div>
                              
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">{t('2. Resend API Key Steps')}</h5>
                                <ol className="text-xs text-slate-600 space-y-2 font-medium list-decimal list-inside">
                                  <li>{t('Log in to your account at')} <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-violet-600 font-bold hover:underline">resend.com</a>.</li>
                                  <li>{t('Navigate to')} <strong className="text-slate-800">API Keys</strong> {t('in the sidebar.')}</li>
                                  <li>{t('Click')} <strong className="text-violet-600">{t('Create API Key')}</strong> {t('(Permission: Full access or Sending access).')}</li>
                                  <li>{t('Copy the key starting with')} <code className="bg-white px-1 py-0.5 rounded text-violet-700 font-mono">re_...</code>.</li>
                                  <li>{t('Paste it into the Resend API Key field above & click Save Settings.')}</li>
                                </ol>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'whatsapp' && (
              <motion.div
                key="whatsapp"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <WhatsAppConnectivity />
              </motion.div>
            )}

            {activeTab === 'messaging' && (
              <motion.div
                key="messaging"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <BroadcastMessaging />
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="card">
                  <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-50">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary shadow-sm">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{t('Notifications & Alerts')}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Manage your system notification preferences')}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="group flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-800">{t('Leave Requests')}</h4>
                        <p className="text-xs font-bold text-slate-500">{t('Get notified when an employee applies for a leave.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, notify_leaves: !prev.notify_leaves }))}
                        className={`w-14 h-7 rounded-full relative transition-all p-1.5 shadow-lg ${settings.notify_leaves ? 'bg-primary shadow-primary/20' : 'bg-slate-300'}`}
                      >
                        <motion.div
                          animate={{ x: settings.notify_leaves ? 28 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    <div className="group flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-800">{t('Expense Claims')}</h4>
                        <p className="text-xs font-bold text-slate-500">{t('Get notified when an employee submits a new claim.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, notify_claims: !prev.notify_claims }))}
                        className={`w-14 h-7 rounded-full relative transition-all p-1.5 shadow-lg ${settings.notify_claims ? 'bg-primary shadow-primary/20' : 'bg-slate-300'}`}
                      >
                        <motion.div
                          animate={{ x: settings.notify_claims ? 28 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>

                    <div className="group flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-black text-slate-800">{t('Password Reset Requests')}</h4>
                        <p className="text-xs font-bold text-slate-500">{t('Get notified when an employee requests a password reset.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, notify_password_resets: !prev.notify_password_resets }))}
                        className={`w-14 h-7 rounded-full relative transition-all p-1.5 shadow-lg ${settings.notify_password_resets ? 'bg-primary shadow-primary/20' : 'bg-slate-300'}`}
                      >
                        <motion.div
                          animate={{ x: settings.notify_password_resets ? 28 : 0 }}
                          className="h-4 w-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscription' && (
              <motion.div
                key="subscription"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-600 shadow-sm">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800">{t('Subscription & Billing')}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Manage your plan and licenses')}</p>
                      </div>
                    </div>

                  </div>

                  {currentPlan ? (
                    <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl relative overflow-hidden group mb-8">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>
                      <div className="relative z-10 space-y-2">
                        <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{t('Current Active Plan')}</h4>
                        <p className="text-3xl font-black">{currentPlan.plan_name}</p>
                        {(() => {
                          let endDateEnd;
                          if (currentPlan.created_at) {
                            endDateEnd = new Date(currentPlan.created_at);
                            let addDays = 30;
                            if (currentPlan.billing_cycle === 'quarterly') addDays = 90;
                            else if (currentPlan.billing_cycle === 'half-yearly') addDays = 180;
                            else if (currentPlan.billing_cycle === 'annually') addDays = 365;
                            endDateEnd.setDate(endDateEnd.getDate() + addDays);
                          } else {
                            endDateEnd = new Date(currentPlan.end_date);
                            endDateEnd.setHours(23, 59, 59, 999);
                          }

                          if (forceTimer !== null) {
                            return (
                              <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                <span>{t('Next billing date:')} <span className="text-white">{endDateEnd ? endDateEnd.toLocaleDateString() : 'N/A'}</span></span>
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-500/20 shadow-sm animate-pulse">
                                  {forceTimer}s {t('left')}
                                </span>
                              </p>
                            );
                          }

                          const timeDiff = endDateEnd - new Date();
                          const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                          const hoursLeft = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
                          const minutesLeft = Math.floor((timeDiff / (1000 * 60)) % 60);
                          const secondsLeft = Math.floor((timeDiff / 1000) % 60);

                          let timeLeftStr = `${daysLeft}d ${hoursLeft}h ${t('left')}`;
                          if (daysLeft === 0 && hoursLeft === 0) {
                            timeLeftStr = `${minutesLeft}m ${secondsLeft}s ${t('left')}`;
                          } else if (daysLeft === 0) {
                            timeLeftStr = `${hoursLeft}h ${minutesLeft}m ${t('left')}`;
                          }

                          const isWarning = daysLeft <= 3;

                          return (
                            <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                              <span>{t('Next billing date:')} <span className="text-white">{endDateEnd ? endDateEnd.toLocaleDateString() : 'N/A'}</span></span>
                              {timeDiff > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${isWarning ? 'bg-rose-500/20 text-rose-300 border-rose-500/20 animate-pulse' : 'bg-white/10 text-white border-white/5'}`}>
                                  {timeLeftStr}
                                </span>
                              )}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="relative z-10 text-right">
                        <span className="inline-block px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-500/20">
                          {currentPlan.payment_status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-center mb-8">
                      <p className="text-sm font-bold text-slate-500">{t('Loading current plan...')}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <h4 className="text-base font-black text-slate-800">{t('Available Upgrades')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {availablePlans.map(plan => (
                        <div key={plan.id} className={`relative p-6 rounded-[2rem] border-2 transition-all cursor-pointer ${selectedPlan === plan.name ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10' : 'border-slate-100 bg-white hover:border-slate-200'}`} onClick={() => setSelectedPlan(plan.name)}>
                          {plan.isPopular === 1 && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">{t('Most Popular')}</div>
                          )}
                          <h5 className="text-lg font-black text-slate-800 mb-1">{plan.name}</h5>
                          <p className="text-2xl font-black text-primary mb-4">{plan.price} <span className="text-xs text-slate-400">{plan.duration}</span></p>
                          <ul className="space-y-2 mb-6">
                            {JSON.parse(plan.features || '[]').map((f, i) => (
                              <li key={i} className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div>
                                {f}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlan(plan.name);
                              handlePlanRequest(plan.name);
                            }}
                            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedPlan === plan.name ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {isRequesting && selectedPlan === plan.name ? t('Renewing...') : t('RENEW')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment & Invoice History Table */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <Receipt size={18} className="text-primary" /> {t('Payment History & Invoices')}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">{t('Official billing records and payment receipts for your company.')}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={fetchInvoices} 
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        {t('Refresh Invoices')}
                      </button>
                    </div>

                    {invoices.length === 0 ? (
                      <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-500">{t('No payment invoices yet.')}</p>
                        <p className="text-[11px] text-slate-400">{t('Invoices will appear here automatically after your first subscription payment.')}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="p-3.5">{t('Invoice #')}</th>
                              <th className="p-3.5">{t('Plan')}</th>
                              <th className="p-3.5">{t('Amount')}</th>
                              <th className="p-3.5">{t('Date')}</th>
                              <th className="p-3.5">{t('Status')}</th>
                              <th className="p-3.5">{t('Razorpay ID')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {invoices.map(inv => (
                              <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 font-black text-slate-800">{inv.invoice_number}</td>
                                <td className="p-3.5 font-bold text-slate-700">{inv.plan_name} ({inv.billing_cycle})</td>
                                <td className="p-3.5 font-black text-slate-900">₹{parseFloat(inv.amount || 0).toLocaleString('en-IN')}</td>
                                <td className="p-3.5 text-slate-500">{new Date(inv.invoice_date || inv.created_at).toLocaleDateString()}</td>
                                <td className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    inv.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {inv.payment_status}
                                  </span>
                                </td>
                                <td className="p-3.5 text-[11px] font-mono text-slate-500">{inv.razorpay_payment_id || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}


          </AnimatePresence>
        </div>
      </div>

      {/* Purge Modal */}
      <AnimatePresence>
        {showPurgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6 shadow-inner">
                  <AlertCircle size={32} />
                </div>

                <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">{t('Are you absolutely sure?')}</h3>
                <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
                  {t('This action will permanently delete all users, faces, fingerprints, and attendance logs from the physical biometric machine. This action cannot be undone.')}
                </p>

                {purgeStatus.status !== 'idle' && (
                  <div className={`p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-3 ${purgeStatus.status === 'loading' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      purgeStatus.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                    {purgeStatus.status === 'loading' && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Zap size={18} /></motion.div>}
                    {purgeStatus.message}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowPurgeModal(false)}
                    disabled={purgeStatus.status === 'loading'}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    {purgeStatus.status === 'success' ? t('Close') : t('Cancel')}
                  </button>
                  {purgeStatus.status !== 'success' && (
                    <button
                      onClick={confirmPurge}
                      disabled={purgeStatus.status === 'loading'}
                      className="flex-1 bg-rose-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {purgeStatus.status === 'loading' ? t('Purging...') : t('Yes, Purge All')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
