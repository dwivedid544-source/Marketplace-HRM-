import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Building2, User, Mail, Lock, ArrowLeft, Loader2, Phone } from 'lucide-react';
import api from '../utils/axios';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [plans, setPlans] = useState([]);
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    email: '',
    phone: '',
    password: '',
    planId: null,
    planName: '',
    price: '',
    duration: ''
  });

  useEffect(() => {
    // Fetch available plans
    api.get('/plans')
      .then(res => {
        setPlans(res.data);
        
        // If they came from a specific plan button, pre-select it
        const queryParams = new URLSearchParams(location.search);
        const preselectedPlan = queryParams.get('plan');
        if (preselectedPlan) {
          const match = res.data.find(p => p.name === preselectedPlan);
          if (match) {
            setFormData(prev => ({
              ...prev,
              planId: match.id,
              planName: match.name,
              price: match.price,
              duration: match.duration
            }));
          }
        }
      })
      .catch(err => console.error('Error fetching plans:', err));
  }, [location]);

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.companyName || !formData.adminName || !formData.email || !formData.password || !formData.phone) {
      setError('Please fill in all fields to continue.');
      return;
    }
    setError('');
    handleSubmit();
  };

  const handlePlanSelect = (plan) => {
    setFormData(prev => ({
      ...prev,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      duration: plan.duration
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/register', formData);
      setStep(2); // Success step
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-dark flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <Link to="/" className="inline-block mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl p-2 mx-auto flex items-center justify-center shadow-2xl shadow-cyan-500/25 border border-white/40 hover:scale-105 transition-transform">
            <img src="/logo.png" alt="HR Pilot Pro" className="w-full h-full object-contain" />
          </div>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-white font-heading tracking-tight mb-2">
          {step === 1 && "Create your workspace"}
          {step === 2 && "Request Sent Successfully"}
        </h2>
        <p className="text-center text-slate-400 mb-8">
          {step === 1 && "Get started with your HR Pilot Pro account"}
          {step === 2 && "We'll be in touch soon!"}
        </p>

        {/* Stepper */}
        <div className="flex justify-center items-center mb-8 gap-4">
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-white/10'}`}></div>
          <div className={`h-2 w-16 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-white/10'}`}></div>
        </div>

        <div className="glass-card-dark p-8 md:p-10 border border-white/10 relative shadow-2xl">
          {error && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleNext} 
                className="space-y-5"
              >
                {formData.planName && (
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex justify-between items-center mb-2 shadow-[inset_0_0_20px_rgba(37,99,235,0.1)]">
                    <div>
                      <p className="text-[10px] text-primary-light font-black uppercase tracking-widest mb-0.5">Selected Plan</p>
                      <h4 className="text-white font-bold text-lg">{formData.planName}</h4>
                    </div>
                    <div className="text-right">
                      {formData.price && (
                        <span className="text-white font-bold text-lg">
                          {formData.price.startsWith('₹') || formData.price.startsWith('INR')
                            ? formData.price
                            : `₹${formData.price.replace(/[^0-9.]/g, '') || formData.price}`}
                        </span>
                      )}
                      {formData.duration && (
                        <span className="text-slate-400 text-xs ml-1">
                          {formData.duration === 'weekly' ? '/week' : formData.duration === 'monthly' ? '/month' : formData.duration === 'quarterly' ? '/3 months' : formData.duration === 'half-yearly' ? '/6 months' : formData.duration === 'annually' ? '/year' : (formData.duration?.startsWith('/') ? formData.duration : `/${formData.duration}`)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Company Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Building2 size={18} className="text-slate-500" />
                    </div>
                    <input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="block w-full pl-11 pr-4 py-3.5 bg-navy-light/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm" placeholder="Acme Corp" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User size={18} className="text-slate-500" />
                    </div>
                    <input type="text" required value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} className="block w-full pl-11 pr-4 py-3.5 bg-navy-light/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm" placeholder="John Doe" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Work Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail size={18} className="text-slate-500" />
                    </div>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="block w-full pl-11 pr-4 py-3.5 bg-navy-light/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm" placeholder="john@acmecorp.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone size={18} className="text-slate-500" />
                    </div>
                    <input type="text" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="block w-full pl-11 pr-4 py-3.5 bg-navy-light/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm" placeholder="+1234567890" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock size={18} className="text-slate-500" />
                    </div>
                    <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="block w-full pl-11 pr-4 py-3.5 bg-navy-light/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm" placeholder="••••••••" />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={loading} className="w-full btn-premium py-4 font-bold flex justify-center items-center gap-2">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Complete Registration'} 
                  </button>
                </div>
              </motion.form>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center flex flex-col items-center"
              >
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 size={40} className="text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Request Sent Successfully</h3>
                <p className="text-slate-400 text-sm mb-8">Your workspace request has been sent successfully. Our team will review and approve it shortly.</p>
                <button onClick={() => navigate('/')} className="btn-primary py-3 px-8 rounded-xl font-bold text-sm">
                  Back to Home
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Register;
