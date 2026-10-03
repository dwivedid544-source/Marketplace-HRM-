import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/axios';
import { useUI } from '../context/UIContext';
import { Lock, CheckCircle2, Key, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showAlert } = useUI();

  const queryEmail = searchParams.get('email') || '';
  const queryToken = searchParams.get('token') || '';

  const [email, setEmail] = useState(queryEmail);
  const [code, setCode] = useState(queryToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (queryEmail) setEmail(queryEmail);
    if (queryToken) setCode(queryToken);
  }, [queryEmail, queryToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !code || !newPassword) {
      return showAlert('Please fill in all required fields.', 'warning');
    }

    if (newPassword.length < 6) {
      return showAlert('Password must be at least 6 characters.', 'warning');
    }

    if (newPassword !== confirmPassword) {
      return showAlert('Passwords do not match.', 'error');
    }

    try {
      setLoading(true);
      const res = await api.post('/public/reset-password-verify', {
        email: email.trim(),
        otp: code.trim(),
        token: code.trim(),
        newPassword
      });

      setSuccess(true);
      showAlert(res.data.message || 'Password reset successfully!', 'success');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      console.error('Reset password error:', err);
      showAlert(err.response?.data?.message || 'Failed to reset password. Please check your code or request a new one.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1D] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 blur-[130px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 blur-[140px] rounded-full pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <div className="w-16 h-16 sm:w-18 sm:h-18 bg-white rounded-2xl p-2 mx-auto flex items-center justify-center shadow-2xl shadow-cyan-500/25 border border-white/40 hover:scale-105 transition-transform">
              <img src="/logo.png" alt="HR Pilot Pro" className="w-full h-full object-contain" />
            </div>
          </Link>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">Set New Password</h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Secure your HR Pilot Pro Account
          </p>
        </div>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-black text-white">Password Reset Complete!</h3>
            <p className="text-xs text-slate-400">
              Your password has been updated. Redirecting you to the login page...
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-dark transition-all mt-2"
            >
              Go to Login Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                6-Digit Code / Reset Token
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code received on Gmail"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-cyan-400 tracking-wider placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-cyan-500 hover:from-primary-dark hover:to-cyan-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-primary/30 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Update Password</span>
                </>
              )}
            </button>

            <div className="text-center pt-3">
              <Link
                to="/login"
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={13} />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
