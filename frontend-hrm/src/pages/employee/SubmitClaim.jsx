import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../utils/axios';
import { 
  ArrowLeft, 
  Calendar, 
  Upload, 
  File, 
  X, 
  CheckCircle,
  AlertCircle,
  Fuel,
  UtensilsCrossed,
  Plane,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const SubmitClaim = () => {
  const { currencySymbol, t } = useSettings();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    claim_type: 'Fuel',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  const claimTypes = [
    { value: 'Fuel', label: t('Fuel'), icon: <Fuel size={18} />, color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { value: 'Food', label: t('Food'), icon: <UtensilsCrossed size={18} />, color: 'bg-orange-50 text-orange-600 border-orange-200' },
    { value: 'Travel', label: t('Travel'), icon: <Plane size={18} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
    { value: 'Other', label: t('Other'), icon: <MoreHorizontal size={18} />, color: 'bg-slate-100 text-slate-600 border-slate-200' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationError('');
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setReceipt(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setValidationError('Please enter a valid expense amount.');
      return;
    }
    if (!formData.description.trim()) {
      setValidationError('Please provide a description.');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('claim_type', formData.claim_type);
      data.append('amount', formData.amount);
      data.append('expense_date', formData.expense_date);
      data.append('description', formData.description);
      if (receipt) data.append('receipt', receipt);

      await api.post('/claims', data);
      setShowSuccess(true);
    } catch (err) {
      console.error('Error submitting claim:', err);
      setValidationError('Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 no-print">
        <Link 
          to="/employee/claims"
          className="p-2 bg-white rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm border border-slate-100"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">{t('Submit Claim')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('File a new expense reimbursement request')}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="card bg-white shadow-sm border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error */}
          {validationError && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <p className="text-[11px] text-rose-600 font-bold uppercase tracking-wide">{validationError}</p>
            </div>
          )}

          {/* Claim Type Selector - Visual Buttons */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Claim Category')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {claimTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, claim_type: type.value }))}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    formData.claim_type === type.value
                      ? `${type.color} shadow-sm scale-[1.02]`
                      : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200'
                  }`}
                >
                  {type.icon}
                  <span className="text-[10px] font-black uppercase tracking-wider">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Amount')}</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="e.g. 1250"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                />
                <div className="absolute left-3.5 top-3.5 text-xs font-black text-slate-400 pointer-events-none">{currencySymbol}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Expense Date')}</label>
              <div className="relative">
                <input
                  type="date"
                  name="expense_date"
                  value={formData.expense_date}
                  onChange={handleInputChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                />
                <Calendar size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Description')}</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe the expense..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Receipt (Optional)')}</label>
            {!receipt ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all">
                <input type="file" id="receipt-upload" className="hidden" onChange={handleFileSelect} accept=".pdf,.png,.jpg,.jpeg" />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload className="text-slate-400" size={22} />
                  <p className="text-[10px] font-black text-slate-600 uppercase">{t('Click to upload receipt')}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('PDF, PNG, JPG (Max 5MB)')}</p>
                </label>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <File size={16} className="text-indigo-500" />
                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{receipt.name}</span>
                </div>
                <button type="button" onClick={() => setReceipt(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Link 
              to="/employee/claims"
              className="w-1/2 py-3 border border-slate-200 rounded-xl text-center text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              {t('Cancel')}
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="w-1/2 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all"
            >
              {submitting ? t('Processing...') : t('Submit Claim')}
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal - Compact */}
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
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">{t('Claim Submitted!')}</h3>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed px-1 uppercase tracking-wider">
                  {t('Your expense claim has been sent for admin approval.')}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">{t('Category')}:</span>
                  <span className="text-[10px] font-black uppercase text-slate-800">{t(formData.claim_type)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">{t('Amount')}:</span>
                  <span className="text-[10px] font-black uppercase text-slate-800">{currencySymbol}{parseFloat(formData.amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">{t('Expense Date')}:</span>
                  <span className="text-[10px] font-bold text-slate-800">
                    {new Date(formData.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/employee/claims')}
                  className="w-full py-3 bg-primary text-white rounded-xl text-center text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all"
                >
                  {t('Back To Claims')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubmitClaim;
