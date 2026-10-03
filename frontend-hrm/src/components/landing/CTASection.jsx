import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  X, 
  AlertTriangle,
  Zap,
  CreditCard
} from 'lucide-react';
import { useSiteInfo } from '../../context/SiteInfoContext';
import api from '../../utils/axios';

const CTASection = () => {
  const { siteInfo } = useSiteInfo();
  const displayName = siteInfo.company_name || siteInfo.platform_name || 'HRM Software Pro';

  // Free Trial Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const openTrialModal = () => {
    setFormData({ companyName: '', adminName: '', email: '', phone: '', password: '' });
    setErrorMsg('');
    setSubmittedSuccess(false);
    setShowModal(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.companyName || !formData.adminName || !formData.email || !formData.phone || !formData.password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    const cleanDigits = formData.phone.replace(/[^0-9]/g, '');
    if (cleanDigits.length < 10) {
      setErrorMsg('Please enter a valid 10-digit contact number.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyName: formData.companyName,
        adminName: formData.adminName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        planId: 'Free Trial'
      };

      const res = await api.post('/register', payload);
      setSubmitting(false);
      if (res.data && res.data.success) {
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
        setSubmittedSuccess(true);
        setTimeout(() => {
          window.location.href = '/admin';
        }, 2200);
      } else {
        setErrorMsg(res.data?.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setSubmitting(false);
      console.error('Free trial registration error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to start free trial. Please try again.');
    }
  };

  return (
    <section className="py-24 relative overflow-hidden z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card-dark border-primary/30 p-8 sm:p-12 md:p-16 relative overflow-hidden rounded-3xl shadow-[0_0_50px_rgba(37,99,235,0.15)]"
        >
          {/* Internal Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/20 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/3"></div>

          <div className="relative z-10">
            {/* Top Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest shadow-sm">
                <Sparkles size={14} className="animate-spin text-emerald-400" style={{ animationDuration: '4s' }} />
                <span>7-Day Unlimited Free Trial • No Credit Card Required</span>
              </div>
            </div>
            
            {/* Main Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white mb-6 leading-tight tracking-tight">
              Start Your 7-Day Free Trial <br className="hidden sm:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-primary-light">
                Zero Risk. Instant Setup.
              </span>
            </h2>

            {/* Subtitle */}
            <p className="text-sm sm:text-base md:text-lg text-slate-300 mb-9 max-w-2xl mx-auto font-sans leading-relaxed">
              Experience the full power of <strong className="text-white font-bold">{displayName}</strong> — AI biometric attendance, 3D face verification, live GPS geofencing, and automated payroll. Complete portal access for 7 days.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <button 
                type="button"
                onClick={openTrialModal}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-heading font-black py-4 px-9 rounded-2xl transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] active:scale-95 flex items-center justify-center gap-2.5 text-base uppercase tracking-wider cursor-pointer"
              >
                <Sparkles size={18} />
                <span>Start 7-Day Free Trial Now</span>
                <ArrowRight size={18} />
              </button>

              <a 
                href="#pricing"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/15 font-heading font-bold py-4 px-7 rounded-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
              >
                <span>View All Plans</span>
              </a>
            </div>

            {/* Trust & Feature Badges */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-slate-300 text-xs sm:text-sm font-semibold pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>Instant Full Portal Access</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>60-Second Setup</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
                <span>256-Bit SSL Protected</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── 7-DAY FREE TRIAL MODAL (PORTALED TO DOCUMENT.BODY) ─── */}
      {showModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-navy-dark border border-white/20 rounded-3xl p-5 sm:p-6 w-[460px] max-w-[95vw] shadow-2xl relative overflow-hidden my-auto"
            >
              {/* Top Gradient Accent */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"></div>

              {/* Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              {!submittedSuccess ? (
                <>
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                      <Sparkles size={11} /> 7-Day Unlimited Free Trial
                    </div>
                    <h3 className="text-xl font-extrabold text-white font-heading">
                      Start Your 7-Day Free Trial
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No credit card required. Instant full portal access for 7 days.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold leading-relaxed space-y-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle size={17} className="text-rose-400 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleModalSubmit} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Company Name <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="e.g. Acme Technologies"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Owner / Admin Name <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.adminName}
                          onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Work Email <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="admin@company.com"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Contact Phone <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="9876543210"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Create Password <span className="text-rose-400">*</span></label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25"
                      >
                        {submitting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <ShieldCheck size={16} /> Activate 7-Day Free Trial
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-heading">
                    Free Trial Activated! 🎉
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Welcome, <strong className="text-white">{formData.adminName}</strong>! Your account for <strong className="text-emerald-400">{formData.companyName}</strong> is now live with 7 days full access. Redirecting to your Admin Dashboard...
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => { window.location.href = '/admin'; }}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                    >
                      Go To Dashboard
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
};

export default CTASection;
