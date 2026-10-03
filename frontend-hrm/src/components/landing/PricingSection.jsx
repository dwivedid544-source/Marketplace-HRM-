import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  X, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  AlertTriangle, 
  CreditCard,
  MessageSquare,
  Send,
  Zap,
  Sliders,
  Globe,
  Palette,
  Bot
} from 'lucide-react';
import api from '../../utils/axios';
import { initiateRazorpayCheckout } from '../../utils/razorpay';
import { useSiteInfo } from '../../context/SiteInfoContext';

const PricingSection = () => {
  const { siteInfo } = useSiteInfo();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Free Trial / Purchase Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Custom Plan Modal State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    message: ''
  });
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState(false);

  useEffect(() => {
    api.get('/plans')
      .then(res => {
        setPlans(res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching plans:', err);
        setLoading(false);
      });
  }, []);

  // Construct 5 Plans: 1. Free Trial, 2. Starter, 3. Standard, 4. Pro (Most Popular), 5. Custom Plan
  const getDisplayPlans = () => {
    const freeTrialCard = {
      id: 'free-trial',
      name: 'Free Trial',
      description: 'Experience Full SaaS Features',
      price: '₹0',
      duration: '7 days',
      isFree: true,
      badge: '7-Day Free Trial',
      badgeColor: 'from-emerald-500 to-teal-500',
      features: [
        'Up to 15 Employees',
        '7 Days Full Access',
        'Attendance Management',
        'Leave & Claims Management',
        'Kiosk Mode & GPS Geofencing',
        'No Credit Card Required'
      ],
      buttonText: 'Start Free Trial',
      buttonStyle: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25',
      isPopular: false
    };

    const customPlanCard = {
      id: 'custom-plan',
      name: 'Custom Plan',
      description: 'For Enterprises & Custom Needs',
      price: 'Custom',
      duration: 'quote',
      isCustom: true,
      badge: 'Enterprise',
      badgeColor: 'from-purple-500 to-indigo-500',
      features: [
        'Unlimited Employees',
        'Custom SaaS Modules & Rules',
        'Personal Domain & Branding',
        'Dedicated AI & Automations',
        'Priority 24/7 Support',
        'Dedicated Account Manager'
      ],
      buttonText: 'Request Custom Plan',
      buttonStyle: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25',
      isPopular: false
    };

    // Filter or build middle 3 paid plans
    let middlePaidPlans = [];
    if (plans && plans.length > 0) {
      // Exclude any existing free or trial from middle slots
      const filtered = plans.filter(p => {
        const n = (p.name || '').toLowerCase();
        return !n.includes('free') && !n.includes('trial') && !n.includes('custom') && parseFloat(p.price || 0) > 0;
      });

      if (filtered.length >= 3) {
        middlePaidPlans = filtered.slice(0, 3);
      } else {
        middlePaidPlans = filtered;
      }
    }

    // Default Fallbacks for Middle 3 if DB plans are empty or less than 3
    const defaultMiddle = [
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'Perfect For Small Teams',
        price: '₹700',
        duration: 'month',
        features: [
          'Up to 10 Employees',
          'Attendance Management',
          'Leave & Claims Management',
          'Payroll Management',
          'Kiosk Mode',
          'GPS Geofencing'
        ],
        buttonText: 'Get Started',
        buttonStyle: 'bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-glass',
        isPopular: false
      },
      {
        id: 'standard',
        name: 'Standard Plan',
        description: 'Designed For Growing Businesses',
        price: '₹900',
        duration: 'month',
        features: [
          'Up to 20 Employees',
          'Attendance Management',
          'Leave & Claims Management',
          'Payroll Management',
          'Kiosk Mode',
          'GPS Geofencing'
        ],
        buttonText: 'Get Started',
        buttonStyle: 'bg-white/10 hover:bg-white/20 text-white border border-white/15 shadow-glass',
        isPopular: false
      },
      {
        id: 'pro',
        name: 'Pro Plan',
        description: 'Built For Scaling Organizations',
        price: '₹1200',
        duration: 'month',
        features: [
          'Up to 50 Employees',
          'Attendance Management',
          'Leave & Claims Management',
          'Payroll Management',
          'Kiosk Mode',
          'GPS Geofencing'
        ],
        buttonText: 'Get Started',
        buttonStyle: 'bg-gradient-to-r from-cyan-500 via-primary to-accent hover:from-cyan-400 hover:to-accent-dark text-white shadow-lg shadow-cyan-500/30 font-extrabold',
        isPopular: true
      }
    ];

    const finalMiddle = middlePaidPlans.length === 3 ? middlePaidPlans : defaultMiddle;

    return [freeTrialCard, ...finalMiddle, customPlanCard];
  };

  const displayPlans = getDisplayPlans();

  const openTrialModal = (plan) => {
    if (plan.isCustom) {
      setCustomForm({ name: '', company: '', email: '', phone: '', message: '' });
      setCustomSuccess(false);
      setShowCustomModal(true);
      return;
    }
    setSelectedPlan(plan);
    setFormData({ companyName: '', adminName: '', email: '', phone: '', password: '' });
    setErrorMsg('');
    setSubmittedSuccess(false);
    setShowModal(true);
  };

  const handleOpenTrialModal = openTrialModal;

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

    const isFree = !selectedPlan || 
      selectedPlan.isFree ||
      (selectedPlan.name || '').toLowerCase().includes('free') || 
      (selectedPlan.name || '').toLowerCase().includes('trial') || 
      parseFloat(selectedPlan.price || 0) === 0;

    setSubmitting(true);

    if (isFree) {
      // 0-Cost 7-Day Free Trial Direct Registration
      try {
        const payload = {
          companyName: formData.companyName,
          adminName: formData.adminName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          planId: selectedPlan ? selectedPlan.name : 'Free Trial'
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
          }, 1800);
        } else {
          setErrorMsg(res.data?.message || 'Failed to activate trial.');
        }
      } catch (err) {
        setSubmitting(false);
        console.error('Trial Registration Error:', err);
        setErrorMsg(err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.');
      }
    } else {
      // Paid Plan Direct Purchase with Razorpay Checkout
      try {
        const orderRes = await api.post('/payment/create-order', {
          planName: selectedPlan.name,
          registrationData: formData
        });

        const { orderId, amount, currency, keyId, planName } = orderRes.data;

        await initiateRazorpayCheckout({
          orderId,
          amount,
          currency,
          keyId,
          planName,
          companyName: formData.companyName,
          customerName: formData.adminName,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          onSuccess: async (response) => {
            try {
              const verifyRes = await api.post('/payment/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                registrationData: formData
              });

              if (verifyRes.data?.token) {
                localStorage.setItem('token', verifyRes.data.token);
              }
              if (verifyRes.data?.user) {
                localStorage.setItem('user', JSON.stringify(verifyRes.data.user));
              }

              setSubmitting(false);
              setSubmittedSuccess(true);
              setTimeout(() => {
                window.location.href = '/admin';
              }, 1800);
            } catch (verErr) {
              setSubmitting(false);
              console.error('Payment verification failed:', verErr);
              setErrorMsg(verErr.response?.data?.error || 'Payment verification failed. Please contact support.');
            }
          },
          onFailure: (failErr) => {
            setSubmitting(false);
            console.warn('Payment failed or closed:', failErr);
            setErrorMsg(failErr.message || 'Payment window closed. Please try again.');
          }
        });
      } catch (err) {
        setSubmitting(false);
        console.error('Order creation error:', err);
        setErrorMsg(err.response?.data?.error || 'Failed to initialize payment. Please try again.');
      }
    }
  };

  const handleCustomFormSubmit = async (e) => {
    e.preventDefault();
    if (!customForm.name || !customForm.company || !customForm.email || !customForm.phone) {
      return;
    }
    setCustomSubmitting(true);

    const rawNumber = siteInfo?.whatsapp_number || siteInfo?.contact_number || '+919876543210';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const msg = `Hello Kiaan Technology Team,\n\nI am interested in a Custom Enterprise HRM Plan.\n\n👤 Name: ${customForm.name}\n🏢 Company: ${customForm.company}\n📧 Email: ${customForm.email}\n📱 Phone: ${customForm.phone}\n📝 Requirement: ${customForm.message || 'Custom enterprise HRM modules & pricing request'}\n\nPlease contact me regarding the custom plan.\nThank you!`;
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;

    try {
      await api.post('/public/enquiry', {
        name: customForm.name,
        email: customForm.email,
        phone: customForm.phone,
        subject: `Custom Plan Request from ${customForm.company}`,
        message: `Company: ${customForm.company}\nRequirements: ${customForm.message || 'Custom enterprise HRM package request.'}`
      });
    } catch (err) {
      console.error('Custom enquiry logging error:', err);
    } finally {
      // Auto open WhatsApp chat
      window.open(whatsappUrl, '_blank');
      setCustomSubmitting(false);
      setCustomSuccess(true);
    }
  };

  return (
    <section id="pricing" className="py-12 lg:py-16 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[550px] bg-primary/10 rounded-full blur-[160px] pointer-events-none z-0"></div>

      <div className="w-full max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary-light font-semibold tracking-wider uppercase text-xs mb-4 backdrop-blur-md">
              <Sparkles size={13} className="text-cyan-400" /> Transparent & Flexible Plans
            </div>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-heading font-extrabold text-white mb-4 tracking-tight">
              Plans that scale with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-primary-light to-secondary">your business</span>
            </h3>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Start with our 7-day risk-free trial, choose a growth plan, or request custom enterprise modules.
            </p>
          </motion.div>
        </div>

        {/* 5 Plans in a Row Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-3.5 xl:gap-4 items-stretch justify-center">
          {displayPlans.map((plan, index) => {
            const isPopular = !!plan.isPopular;
            const isFree = !!plan.isFree;
            const isCustom = !!plan.isCustom;

            return (
              <motion.div
                key={plan.id || index}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                className={`relative rounded-3xl p-4 sm:p-5 xl:p-5 backdrop-blur-xl border transition-all duration-300 flex flex-col justify-between group h-full ${
                  isPopular 
                    ? 'bg-gradient-to-b from-[#0F172A]/95 via-[#0A0F1D]/90 to-[#0F172A]/95 border-cyan-500/80 shadow-[0_0_30px_rgba(6,182,212,0.22)] lg:-translate-y-2 z-10' 
                    : 'bg-navy-dark/70 border-white/10 hover:border-white/25 hover:bg-navy-dark/85 shadow-glass hover:-translate-y-1'
                }`}
              >
                {/* Most Popular Floating Pill */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 via-primary to-accent text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_15px_rgba(6,182,212,0.6)] whitespace-nowrap">
                    <Sparkles size={11} className="text-white" /> MOST POPULAR
                  </div>
                )}

                {/* Free Trial Badge */}
                {isFree && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider mb-2.5 self-start">
                    <Zap size={11} /> 7-Day Free Trial
                  </div>
                )}

                {/* Custom Plan Badge */}
                {isCustom && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-extrabold uppercase tracking-wider mb-2.5 self-start">
                    <Sliders size={11} /> Enterprise Ready
                  </div>
                )}

                <div>
                  {/* Title & Description */}
                  <div className="mb-2">
                    <h4 className="text-lg xl:text-xl font-bold text-white font-heading mb-1 group-hover:text-primary-light transition-colors">
                      {plan.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price Section */}
                  <div className="mb-3.5 pb-3.5 border-b border-white/10 flex items-baseline gap-1">
                    <span className="text-3xl xl:text-[34px] font-extrabold text-white font-heading tracking-tight">
                      {plan.price && (plan.price.startsWith('₹') || plan.price === 'Custom' || plan.price.startsWith('INR')) 
                        ? plan.price 
                        : `₹${plan.price ? plan.price.replace(/[^0-9.]/g, '') : '0'}`}
                    </span>
                    <span className="text-slate-400 text-xs font-medium">
                      {plan.duration === 'weekly' ? '/week' : plan.duration === 'monthly' || plan.duration === 'month' ? '/month' : plan.duration === '7 days' ? '/7 days' : plan.duration === 'quote' ? '/quote' : (plan.duration?.startsWith('/') ? plan.duration : `/${plan.duration}`)}
                    </span>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2 mb-5">
                    {(() => {
                        let fList = [];
                        if (plan.features) {
                          try {
                            fList = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features);
                          } catch(e) {
                            fList = [];
                          }
                        }
                        return fList.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 size={15} className={`shrink-0 mt-0.5 ${isPopular ? 'text-cyan-400' : isFree ? 'text-emerald-400' : isCustom ? 'text-purple-400' : 'text-slate-400'}`} />
                            <span className="text-slate-300 text-[11px] font-medium leading-tight">{feature}</span>
                          </li>
                        ));
                    })()}
                  </ul>
                </div>

                {/* Action CTA Button */}
                <div className="pt-2 mt-auto">
                  <button 
                    type="button"
                    onClick={() => openTrialModal(plan)}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98] ${plan.buttonStyle || 'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}
                  >
                    <span>{plan.buttonText || 'Get Started'}</span>
                    {isPopular ? <ChevronRight size={15} /> : <ArrowRight size={14} />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Free Trial / Plan Purchase Modal */}
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
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cyan-400 to-accent"></div>

              {/* Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              {!submittedSuccess ? (
                <>
                  {(() => {
                    const rawPlanName = selectedPlan?.name || 'Free Trial';
                    const cleanPlanName = rawPlanName.replace(/\s+plan$/i, '').trim() + ' Plan';
                    const isFree = selectedPlan?.isFree || !selectedPlan?.price || selectedPlan?.price === '₹0' || selectedPlan?.price === 0 || selectedPlan?.price === '0' || rawPlanName.toLowerCase().includes('trial') || rawPlanName.toLowerCase().includes('free');
                    const planPriceDisplay = selectedPlan?.price && (selectedPlan.price.startsWith('₹') || selectedPlan.price.startsWith('INR')) ? selectedPlan.price : `₹${selectedPlan?.price ? selectedPlan.price.replace(/[^0-9.]/g, '') : '0'}`;
                    const planDurationDisplay = selectedPlan?.duration === 'weekly' ? '/week' : selectedPlan?.duration === 'monthly' ? '/month' : selectedPlan?.duration === '7 days' ? '/7 days' : (selectedPlan?.duration?.startsWith('/') ? selectedPlan.duration : `/${selectedPlan?.duration || 'month'}`);

                    return (
                      <>
                        <div className="mb-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${isFree ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary/20 text-primary-light border border-primary/30'} text-[10px] font-bold uppercase tracking-wider mb-2`}>
                            <Sparkles size={11} /> {cleanPlanName} {!isFree ? `• ${planPriceDisplay}${planDurationDisplay}` : '• 7-Day Free Trial'}
                          </div>
                          <h3 className="text-xl font-extrabold text-white font-heading">
                            {isFree ? 'Start Your 7-Day Free Trial' : `Get Started with ${cleanPlanName}`}
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isFree 
                              ? 'No credit card required. Instant full portal access for 7 days.' 
                              : `Create your company account to activate ${cleanPlanName} (${planPriceDisplay}${planDurationDisplay}).`}
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
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
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
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
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
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
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
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
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
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                              />
                            </div>
                          </div>

                          <div className="pt-2">
                            <button
                              type="submit"
                              disabled={submitting}
                              className={`w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-widest text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                                isFree 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/25' 
                                  : 'bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent-dark shadow-primary/25'
                              }`}
                            >
                              {submitting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : isFree ? (
                                <>
                                  <ShieldCheck size={16} /> Activate 7-Day Free Trial
                                </>
                              ) : (
                                <>
                                  <CreditCard size={16} /> Pay {planPriceDisplay} & Unlock
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30 animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-heading">
                    {selectedPlan?.isFree || selectedPlan?.name?.toLowerCase().includes('trial') || selectedPlan?.name?.toLowerCase().includes('free')
                      ? 'Free Trial Activated! 🎉'
                      : `${selectedPlan?.name || 'Plan'} Activated! 🎉`}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Welcome, <strong className="text-white">{formData.adminName}</strong>! Your account for <strong className="text-primary-light">{formData.companyName}</strong> is now live. Redirecting to your Admin Dashboard...
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => { window.location.href = '/admin'; }}
                      className="px-5 py-2.5 bg-gradient-to-r from-primary to-accent text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
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

      {/* Request Custom Plan Modal */}
      {showCustomModal && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-navy-dark border border-white/20 rounded-3xl p-5 sm:p-6 w-[480px] max-w-[95vw] shadow-2xl relative overflow-hidden my-auto"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400"></div>

              {/* Close Button */}
              <button
                onClick={() => setShowCustomModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              {!customSuccess ? (
                <>
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider mb-2">
                      <Sliders size={11} /> Enterprise Customization
                    </div>
                    <h3 className="text-xl font-extrabold text-white font-heading">
                      Request Custom Enterprise Plan
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tell us your requirements, and our engineering team will tailor a dedicated HRM platform for your organization.
                    </p>
                  </div>

                  <form onSubmit={handleCustomFormSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Your Name <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={customForm.name}
                            onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                            placeholder="John Doe"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Company Name <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={customForm.company}
                            onChange={(e) => setCustomForm({ ...customForm, company: e.target.value })}
                            placeholder="Acme Corp"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                          />
                        </div>
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
                            value={customForm.email}
                            onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })}
                            placeholder="john@company.com"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Phone / WhatsApp <span className="text-rose-400">*</span></label>
                        <div className="relative">
                          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={customForm.phone}
                            onChange={(e) => setCustomForm({ ...customForm, phone: e.target.value })}
                            placeholder="+91 9876543210"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Custom Requirements / Employee Count</label>
                      <div className="relative">
                        <MessageSquare size={15} className="absolute left-3.5 top-3 text-slate-400" />
                        <textarea
                          rows={3}
                          value={customForm.message}
                          onChange={(e) => setCustomForm({ ...customForm, message: e.target.value })}
                          placeholder="e.g. 500+ Employees, Custom Leave Rules, Personal Domain & Biometric Integration..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all resize-none"
                        ></textarea>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={customSubmitting}
                        className="w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {customSubmitting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Send size={15} /> Submit Custom Plan Request
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto border border-purple-500/30">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-xl font-extrabold text-white font-heading">
                    Request Received! 🚀
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Thank you, <strong className="text-white">{customForm.name}</strong>. Our enterprise team for <strong className="text-purple-300">{customForm.company}</strong> has received your custom plan requirements and will reach out shortly.
                  </p>
                  <div className="pt-3 flex items-center justify-center gap-2.5 flex-wrap">
                    <a
                      href={`https://wa.me/${(siteInfo?.whatsapp_number || siteInfo?.contact_number || '+919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Kiaan Technology Team,\n\nI requested a Custom Enterprise Plan for ${customForm.company}.\nName: ${customForm.name}\nPhone: ${customForm.phone}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={14} /> <span>Open WhatsApp</span>
                    </a>
                    <button
                      onClick={() => setShowCustomModal(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                    >
                      Close
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

export default PricingSection;

