import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Key, 
  ShieldCheck, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/axios';

const ActivateLicense = () => {
  const navigate = useNavigate();

  // Step state: 1 = License Activation, 2 = First Superadmin Setup
  const [currentStep, setCurrentStep] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Step 1: Activation States
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
  const [envelopeText, setEnvelopeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [keyWarning, setKeyWarning] = useState('');
  const [activationSuccess, setActivationSuccess] = useState(false);

  // Step 2: First Superadmin States
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState(false);

  // Initial check on mount: determine current installation status
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await api.get('/setup/status');
        if (!isMounted) return;

        const { isLicensed, superadminExists } = res.data || {};
        if (isLicensed) {
          if (superadminExists) {
            // Already fully setup, go to login
            navigate('/login');
            return;
          }
          // Licensed but superadmin missing: proceed to Step 2
          setCurrentStep(2);
        } else {
          // Unlicensed: stay on Step 1
          setCurrentStep(1);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Setup status check failed:', err);
        setPageError(
          err.response?.data?.message || 
          'Unable to verify system license status. Please ensure the server is running.'
        );
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    fetchStatus();
    return () => { isMounted = false; };
  }, [navigate]);

  // Handle Commercial License Key warning detection
  const checkForKeyPattern = (text) => {
    const trimmed = text.trim();
    // Anti-pattern: User pasted a purchase key instead of signed envelope
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}/i.test(trimmed)) {
      setKeyWarning(
        'Purchase activation key detected. Direct online key activation is not yet available in offline mode. Please upload or paste your signed .lic entitlement envelope file.'
      );
    } else {
      setKeyWarning('');
    }
  };

  // Handle .lic / JSON file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setActivationError('');
    setKeyWarning('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setEnvelopeText(content.trim());
        checkForKeyPattern(content);
      }
    };
    reader.onerror = () => {
      setActivationError('Failed to read the selected file. Please verify file permissions.');
    };
    reader.readAsText(file);
  };

  // Submit signed license envelope
  const handleActivateSubmit = async (e) => {
    e.preventDefault();
    setActivationError('');
    setKeyWarning('');

    const trimmed = envelopeText.trim();
    if (!trimmed) {
      setActivationError('Please select a .lic file or paste the signed license envelope.');
      return;
    }

    // Check if input looks like a purchase key
    if (/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}/i.test(trimmed)) {
      setActivationError(
        'Online activation keys cannot be verified directly in offline mode. Please supply the vendor-issued signed .lic envelope.'
      );
      return;
    }

    let payload;
    try {
      // Check if it's already a JSON envelope
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        payload = JSON.parse(trimmed);
      } else {
        payload = trimmed;
      }
    } catch {
      payload = trimmed;
    }

    setIsActivating(true);
    try {
      const res = await api.post('/license/activate', {
        envelope: payload
      });

      if (res.data?.success) {
        setActivationSuccess(true);
        // Re-check setup status to determine next step
        const statusRes = await api.get('/setup/status');
        const { superadminExists } = statusRes.data || {};

        setTimeout(() => {
          if (superadminExists) {
            navigate('/login');
          } else {
            setCurrentStep(2);
            setActivationSuccess(false);
          }
        }, 1200);
      } else {
        setActivationError(res.data?.message || 'Activation failed. Please check the license envelope.');
      }
    } catch (err) {
      console.error('License activation error:', err);
      const serverCode = err.response?.data?.code;
      const serverMsg = err.response?.data?.message;

      if (serverCode === 'ONLINE_ACTIVATION_KEY_DETECTED') {
        setActivationError(
          'Commercial purchase key detected. Direct online activation is not yet available in offline mode. Please upload or paste your signed .lic envelope.'
        );
      } else if (serverCode === 'INVALID_SIGNATURE') {
        setActivationError('Cryptographic verification failed: Invalid or tampered signature envelope.');
      } else if (serverCode === 'DOMAIN_MISMATCH') {
        setActivationError('Domain mismatch: This license is not issued for the current host domain.');
      } else if (serverCode === 'PRODUCT_MISMATCH') {
        setActivationError('Product mismatch: This license was issued for a different product.');
      } else {
        setActivationError(serverMsg || 'License activation failed. Please check the envelope and try again.');
      }
    } finally {
      setIsActivating(false);
    }
  };

  // Submit first Superadmin creation
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');

    const { name, email, password, confirmPassword } = adminForm;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setAdminError('Please enter your full name.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAdminError('Please enter a valid email address.');
      return;
    }

    if (password.length < 10) {
      setAdminError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setAdminError('Passwords do not match. Please verify.');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const res = await api.post('/setup/first-admin', {
        name: trimmedName,
        email: trimmedEmail,
        password: password
      });

      if (res.data?.success) {
        setAdminSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setAdminError(res.data?.message || 'Failed to create Super Administrator.');
      }
    } catch (err) {
      console.error('Create first admin error:', err);
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message;

      if (code === 'SUPERADMIN_ALREADY_EXISTS') {
        setAdminError('Super Administrator account already exists. Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else if (code === 'EMAIL_COLLISION') {
        setAdminError(`An account with email "${trimmedEmail}" already exists. Please use a different email.`);
      } else if (code === 'LICENSE_REQUIRED') {
        setAdminError('A valid active license is required. Returning to activation...');
        setTimeout(() => setCurrentStep(1), 1500);
      } else {
        setAdminError(msg || 'Failed to create Super Administrator. Please try again.');
      }
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-400">Verifying installation state...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col justify-between relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none translate-y-1/2"></div>

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-lg shadow-black/20">
            <img src="/logo.png" alt="HR Pilot Pro" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-heading font-black text-lg text-white tracking-tight">
              HR PILOT <span className="text-primary font-black">PRO</span>
            </span>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Enterprise License Setup
            </span>
          </div>
        </div>

        <Link 
          to="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold text-xs transition-all"
        >
          <ArrowLeft size={14} />
          <span>Return to Login</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-2xl mx-auto px-6 py-8 flex-1 flex flex-col justify-center relative z-10">
        {/* Stepper Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            {/* Step 1 Pill */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentStep === 1 
                ? 'bg-primary/20 border border-primary/40 text-primary shadow-lg shadow-primary/10' 
                : 'bg-white/5 border border-white/10 text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep > 1 ? 'bg-emerald-500 text-white' : (currentStep === 1 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300')
              }`}>
                {currentStep > 1 ? '✓' : '1'}
              </span>
              <span>License Activation</span>
            </div>

            <div className="w-8 h-px bg-white/10"></div>

            {/* Step 2 Pill */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              currentStep === 2 
                ? 'bg-primary/20 border border-primary/40 text-primary shadow-lg shadow-primary/10' 
                : 'bg-white/5 border border-white/10 text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                currentStep === 2 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300'
              }`}>
                2
              </span>
              <span>Super Administrator</span>
            </div>
          </div>
        </div>

        {/* Global Page Error Banner */}
        {pageError && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 text-rose-400" />
            <p className="text-xs font-semibold">{pageError}</p>
          </div>
        )}

        {/* STEP 1: License Activation */}
        {currentStep === 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-wider mb-2">
                <Sparkles size={12} />
                <span>Step 1 • Cryptographic Entitlement</span>
              </div>
              <h2 className="text-2xl font-heading font-black text-white">
                Activate Your License
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">
                Install your official Kiaan-signed offline <code className="text-primary font-mono text-xs bg-primary/10 px-1.5 py-0.5 rounded">.lic</code> entitlement file or paste the armored envelope.
              </p>
            </div>

            {/* Input Mode Selector */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-5 border border-white/10">
              <button
                type="button"
                onClick={() => { setInputMode('file'); setActivationError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  inputMode === 'file' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UploadCloud size={16} />
                <span>Upload .lic File</span>
              </button>
              <button
                type="button"
                onClick={() => { setInputMode('paste'); setActivationError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  inputMode === 'paste' 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={16} />
                <span>Paste Armored Envelope</span>
              </button>
            </div>

            {/* Notifications */}
            {keyWarning && (
              <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{keyWarning}</p>
              </div>
            )}

            {activationError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="font-semibold leading-relaxed">{activationError}</p>
              </div>
            )}

            {activationSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <p className="font-semibold leading-relaxed">License successfully verified and activated! Proceeding to setup...</p>
              </div>
            )}

            <form onSubmit={handleActivateSubmit} className="space-y-5">
              {inputMode === 'file' ? (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    License File (.lic or JSON)
                  </label>
                  <label className="border-2 border-dashed border-white/20 hover:border-primary/60 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
                    <UploadCloud size={32} className="text-slate-400 group-hover:text-primary transition-colors mb-2" />
                    <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                      {fileName ? fileName : 'Click to browse or drag .lic file here'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Accepts signed .lic, .json or text envelopes
                    </span>
                    <input 
                      type="file" 
                      accept=".lic,.json,.txt" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  {fileName && (
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
                      <span className="font-mono text-slate-300 truncate max-w-xs">{fileName}</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Ready
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                    Armored Envelope Content
                  </label>
                  <textarea
                    rows={6}
                    value={envelopeText}
                    onChange={(e) => {
                      setEnvelopeText(e.target.value);
                      checkForKeyPattern(e.target.value);
                    }}
                    placeholder={`{"signature": "...", "payload": {...}}\nOR\n-----BEGIN KIAAN LICENSE ENVELOPE-----`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isActivating || activationSuccess || (!envelopeText && !fileName)}
                  className="w-full bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary-dark hover:to-purple-700 text-white rounded-xl py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActivating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying Cryptographic Envelope...</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Verify & Activate License</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* STEP 2: First Super Administrator Setup */}
        {currentStep === 2 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-9 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-2">
                <ShieldCheck size={12} />
                <span>Step 2 • Super Administrator Provisioning</span>
              </div>
              <h2 className="text-2xl font-heading font-black text-white">
                Create First Super Administrator
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">
                Your license is active. Create the root Super Administrator account to manage companies, plans, and system configurations.
              </p>
            </div>

            {adminError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="font-semibold leading-relaxed">{adminError}</p>
              </div>
            )}

            {adminSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <p className="font-semibold leading-relaxed">Super Administrator created successfully! Redirecting to login...</p>
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Full Name
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Administrator"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs sm:text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                  Superadmin Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="superadmin@yourdomain.com"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs sm:text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                    Password (min 10 chars)
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-xs sm:text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 ml-1">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••"
                      value={adminForm.confirmPassword}
                      onChange={(e) => setAdminForm({ ...adminForm, confirmPassword: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-11 text-xs sm:text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isCreatingAdmin || adminSuccess}
                  className="w-full bg-gradient-to-r from-emerald-500 via-teal-600 to-primary hover:from-emerald-600 hover:to-primary-dark text-white rounded-xl py-3.5 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCreatingAdmin ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Super Administrator...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup & Proceed to Login</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs font-medium text-slate-500 relative z-10">
        <p>© {new Date().getFullYear()} Kiaan HRM Pro • Cryptographic Offline License Protection Engine</p>
      </footer>
    </div>
  );
};

export default ActivateLicense;
