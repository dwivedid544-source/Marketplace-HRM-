import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/axios';
import { 
  ArrowLeft, 
  Calendar, 
  Upload, 
  File, 
  X, 
  CheckCircle,
  HelpCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const ApplyLeave = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    leave_type: 'Annual Leave',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    half_day: false,
    reason: '',
  });
  const [attachment, setAttachment] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [balances, setBalances] = useState({ annual: 0, sick: 0, unpaid: 0, emergency: 0 });
  const [weekends, setWeekends] = useState([]);
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    // Load leave balances to show as helper text
    api.get('/leaves/balances').then(res => {
      setBalances(res.data);
    }).catch(err => console.error(err));

    // Load settings to get company week offs
    api.get('/settings').then(res => {
      if (res.data && res.data.weekends) {
        setWeekends(res.data.weekends.split(',').map(d => d.trim().toLowerCase()));
      }
    }).catch(err => console.error(err));

    // Load public holidays
    api.get('/attendance/holidays').then(res => {
      if (res.data && Array.isArray(res.data)) {
        // Store as YYYY-MM-DD strings
        setHolidays(res.data.map(h => new Date(h.holiday_date).toISOString().split('T')[0]));
      }
    }).catch(err => console.error(err));
  }, []);

  // Update calculated days when dates/half-day state changes
  useEffect(() => {
    if (formData.half_day) {
      const start = new Date(formData.start_date);
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][start.getDay()];
      const dateStr = start.toISOString().split('T')[0];
      
      if (weekends.includes(dayName) || holidays.includes(dateStr)) {
        setCalculatedDays(0);
        setValidationError('Selected date is a weekend or holiday.');
      } else {
        setCalculatedDays(0.5);
        setValidationError('');
      }
      // If half day, keep end date equal to start date
      setFormData(prev => ({ ...prev, end_date: prev.start_date }));
    } else {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setCalculatedDays(0);
        return;
      }
      if (end < start) {
        setCalculatedDays(0);
        return;
      }
      
      let daysCount = 0;
      let currentDate = new Date(start);
      // Reset hours to avoid daylight saving issues
      currentDate.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      while (currentDate <= endDate) {
        const dayName = dayNames[currentDate.getDay()];
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!weekends.includes(dayName) && !holidays.includes(dateStr)) {
          daysCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      setCalculatedDays(daysCount);
      if (daysCount === 0) {
        setValidationError('Selected dates fall entirely on weekends or holidays.');
      } else {
        setValidationError('');
      }
    }
  }, [formData.start_date, formData.end_date, formData.half_day, weekends, holidays]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newValue = type === 'checkbox' ? checked : value;
      const updates = { [name]: newValue };
      
      // If start_date changes, automatically sync end_date to it
      if (name === 'start_date') {
        updates.end_date = newValue;
      }
      
      return { ...prev, ...updates };
    });
    setValidationError('');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type
      });
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type
      });
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);

    if (!formData.half_day && end < start) {
      setValidationError('End date cannot be prior to start date.');
      return;
    }

    if (!formData.reason.trim()) {
      setValidationError('Please provide a reason for your leave request.');
      return;
    }

    // Removed balance checking

    try {
      setSubmitting(true);
      await api.post('/leaves', {
        ...formData,
        days: calculatedDays
      });
      setShowSuccess(true);
    } catch (err) {
      console.error('Error submitting leave:', err);
      setValidationError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 no-print">
        <Link 
          to="/employee/leaves"
          className="p-2 bg-white rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm border border-slate-100"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">{t('Request Time Off')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Submit a new leave request for authorization')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Application Form */}
        <div className="md:col-span-2 card bg-white shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {validationError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <p className="text-[11px] text-rose-600 font-bold uppercase tracking-wide">{validationError}</p>
              </div>
            )}

            {/* Date range grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Start Date')}</label>
                <div className="relative">
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t('End Date')} {formData.half_day && `(${t('Locked')})`}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="end_date"
                    disabled={formData.half_day}
                    value={formData.end_date}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                    onChange={handleInputChange}
                    className={`w-full border rounded-xl px-4 py-3 text-xs font-bold transition-colors ${
                      formData.half_day 
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 focus:outline-none focus:border-primary'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Half Day Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-amber-500 border border-slate-100 shadow-sm shrink-0">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{t('Half Day Leave')}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t('Applies for a single 0.5-day schedule')}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="half_day"
                  checked={formData.half_day}
                  onChange={handleInputChange}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Reason / Description')}</label>
              <textarea
                name="reason"
                rows="3"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder={t('Briefly state why you require leave (required for validation)...')}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Link 
                to="/employee/leaves"
                className="w-1/2 py-3 border border-slate-200 rounded-xl text-center text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
              >
                {t('Cancel')}
              </Link>
              <button
                type="submit"
                disabled={submitting || calculatedDays <= 0}
                className="w-1/2 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('Submitting...') : t('Submit Request')}
              </button>
            </div>
          </form>
        </div>

        {/* Calculation Sidebar Panel */}
        <div className="space-y-6">
          {/* Summary Details Panel */}
          <div className="card bg-slate-900 text-white border-none shadow-xl flex flex-col justify-between py-6">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-4 text-white/50">{t('Request Calculation')}</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('From Date')}</p>
                    <p className="text-[11px] font-bold text-white mt-0.5">{new Date(formData.start_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('To Date')}</p>
                    <p className="text-[11px] font-bold text-white mt-0.5">
                      {formData.half_day 
                        ? t('Same Day') 
                        : new Date(formData.end_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 mt-2">
                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Accumulated Duration')}</p>
                  <h2 className="text-4xl font-black text-emerald-400 tracking-tighter mt-1">
                    {calculatedDays} 
                    <span className="text-xs font-bold text-white uppercase ml-1.5">{t('Working Days')}</span>
                  </h2>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex items-start gap-2.5 bg-white/5 p-3 rounded-xl">
              <HelpCircle size={16} className="text-indigo-300 shrink-0 mt-0.5" />
              <p className="text-[8px] font-bold text-slate-400 uppercase leading-normal">
                {t('Leave requests are submitted directly to the HR administration office. You will be notified when your status changes from pending.')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-80 max-w-[90vw] shadow-2xl border border-slate-100 space-y-4 text-center mx-auto flex flex-col"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-1 shadow-md shadow-emerald-500/10">
                  <CheckCircle size={20} />
                </div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">Request Submitted!</h3>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed px-1 uppercase tracking-wider">
                  Your application for {formData.leave_type} has been logged successfully.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">Duration:</span>
                  <span className="text-[10px] font-black uppercase text-slate-800">{calculatedDays} Days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">Start Date:</span>
                  <span className="text-[10px] font-bold text-slate-800">
                    {new Date(formData.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">End Date:</span>
                  <span className="text-[10px] font-bold text-slate-800">
                    {new Date(formData.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {attachment && (
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400">Attachment:</span>
                    <span className="text-[10px] font-bold text-slate-800 truncate max-w-[120px]">{attachment.name}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/employee/leaves')}
                  className="w-full py-3 bg-primary text-white rounded-xl text-center text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all"
                >
                  Back To Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApplyLeave;
