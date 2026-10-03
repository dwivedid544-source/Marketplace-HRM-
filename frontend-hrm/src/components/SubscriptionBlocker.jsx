import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Zap, ShieldCheck, CreditCard, LogOut, MessageCircle, Sparkles, Crown, ArrowRight } from 'lucide-react';
import api from '../utils/axios';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useSiteInfo } from '../context/SiteInfoContext';
import { initiateRazorpayCheckout } from '../utils/razorpay';

const SubscriptionBlocker = ({ children }) => {
  const { user, logout } = useAuth();
  const { showAlert } = useUI();
  const { siteInfo } = useSiteInfo();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [daysLeftState, setDaysLeftState] = useState(0);
  const [hasDismissedWarning, setHasDismissedWarning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const isSuperadmin = user?.role === 'Master Admin' || user?.role === 'superadmin';

  const checkSubscription = async () => {
    if (isSuperadmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/settings/current-plan');
      const setRes = await api.get('/settings/global');
      setCurrentPlan(res.data);
      let isExp = false;
      if (res.data) {
          const cycle = (res.data.billing_cycle || '').toLowerCase();
          const plan = (res.data.plan_name || '').toLowerCase();
          let durationDays = 30;
          if (plan.includes('free') || plan.includes('trial') || cycle === 'weekly' || cycle.includes('7')) {
              durationDays = 7;
          } else if (cycle === 'annually' || cycle === 'yearly') {
              durationDays = 365;
          } else if (cycle === 'half-yearly') {
              durationDays = 180;
          } else if (cycle === 'quarterly') {
              durationDays = 90;
          }

          let endDateEnd = null;
          if (res.data.created_at) {
              const created = new Date(res.data.created_at);
              endDateEnd = new Date(created.getTime() + durationDays * 24 * 60 * 60 * 1000);
          } else if (res.data.end_date) {
              endDateEnd = new Date(res.data.end_date);
              endDateEnd.setHours(23, 59, 59, 999);
          }
          isExp = !endDateEnd || endDateEnd < new Date();

          if (!isExp && endDateEnd) {
              const timeDiff = endDateEnd - new Date();
              const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
              setDaysLeftState(daysLeft);
              
              const sysNotif = setRes.data?.notifications || {};
              const isTrial = plan.includes('free') || plan.includes('trial') || cycle === 'weekly';
              let shouldWarn = false;

              if (isTrial) {
                  shouldWarn = (daysLeft <= 1);
              } else {
                  if (daysLeft <= 1 && sysNotif.systemExpiry1Day !== false) {
                      shouldWarn = true;
                  } else if (daysLeft <= 3 && sysNotif.systemExpiry3Day !== false) {
                      shouldWarn = true;
                  } else if (daysLeft <= 7 && (sysNotif.systemCompanyExpiry !== false || sysNotif.systemExpiry7Day !== false)) {
                      shouldWarn = true;
                  }
              }

              const hasSeen = sessionStorage.getItem(`hasSeenExpiryWarning_${isTrial ? 'trial_' : ''}${daysLeft}`);
              if (shouldWarn && !hasSeen && !hasDismissedWarning) {
                  setShowWarning(true);
              } else {
                  setShowWarning(false);
              }
          }
      }
      setLoading(false);
    } catch (err) {
      console.error('Subscription check error:', err);
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await api.get('/plans');
      const plans = res.data || [];
      const paid = plans.filter(p => {
        const pName = (p.name || '').toLowerCase();
        const pCycle = (p.duration || '').toLowerCase();
        const pPrice = parseFloat(p.price || 0);
        return !pName.includes('free') && !pName.includes('trial') && pCycle !== 'weekly' && pPrice > 0;
      });
      setAvailablePlans(paid);
      if (paid.length > 0) {
        setSelectedPlan(prev => prev || paid[0].name);
      }
    } catch (err) {
      console.error('Error fetching plans', err);
    }
  };

  useEffect(() => {
    fetchPlans();
    checkSubscription();
    const interval = setInterval(checkSubscription, 5000);
    const handleUpdate = () => checkSubscription();
    window.addEventListener('subscription_updated', handleUpdate);
    return () => {
        clearInterval(interval);
        window.removeEventListener('subscription_updated', handleUpdate);
    };
  }, [user]);

  const handlePlanRequest = async () => {
    if (!selectedPlan) return;

    if (selectedPlan === 'custom_enterprise') {
      const rawNumber = siteInfo?.whatsapp_number || '+91 97521 00980';
      const cleanNumber = rawNumber.replace(/[\s\-()]/g, '').replace('+', '');
      
      const compName = currentPlan?.company_name || user?.company_name || '';
      const userName = user?.name || '';
      const userPhone = currentPlan?.company_phone || user?.phone || '';
      const userEmail = currentPlan?.company_email || user?.email || '';

      const lines = [
        `👋 *Hello HRM Software / Sales Team,*`,
        ``,
        `I would like to inquire about the *Custom Enterprise Plan* for my organization.`,
        ``,
        `🏢 *Company:* ${compName || 'Our Organization'}`,
        userName ? `👤 *Contact Person:* ${userName}` : null,
        userPhone ? `📱 *Phone:* ${userPhone}` : null,
        userEmail ? `📧 *Email:* ${userEmail}` : null,
        ``,
        `💼 *Requirements:*`,
        `• Unlimited / Custom Employee Limits`,
        `• Dedicated Cloud Server & Fast Database`,
        `• Biometric Device / Face Attendance API Integration`,
        `• Custom Modules & 24/7 Dedicated Account Manager`,
        ``,
        `Please share the enterprise proposal and custom pricing. Thank you!`
      ].filter(Boolean).join('\n');

      const text = encodeURIComponent(lines);
      window.open(`https://wa.me/${cleanNumber}?text=${text}`, '_blank');
      return;
    }

    setIsRequesting(true);
    try {
      // 1. Create Razorpay Order on server
      const orderRes = await api.post('/payment/create-order', {
        planName: selectedPlan
      });

      const { orderId, amount, currency, keyId, planName } = orderRes.data;

      // 2. Open Razorpay Checkout modal
      await initiateRazorpayCheckout({
        orderId,
        amount,
        currency,
        keyId,
        planName,
        companyName: currentPlan?.company_name || user?.company_name || 'Company',
        customerName: user?.name || '',
        customerEmail: currentPlan?.company_email || user?.email || '',
        customerPhone: currentPlan?.company_phone || user?.phone || '',
        onSuccess: async (response) => {
          try {
            // 3. Verify Payment Signature & Activate Subscription
            await api.post('/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            showAlert('Payment Successful! 🎉 Your plan has been activated & dashboard unlocked.', 'success');
            
            // Clear warning flags
            Object.keys(sessionStorage).forEach(k => {
              if (k.startsWith('hasSeenExpiryWarning')) {
                sessionStorage.removeItem(k);
              }
            });

            window.dispatchEvent(new Event('subscription_updated'));
            checkSubscription();
          } catch (verErr) {
            console.error('Payment verification failed:', verErr);
            showAlert(verErr.response?.data?.error || 'Payment verification failed. Please contact support.', 'error');
          } finally {
            setIsRequesting(false);
          }
        },
        onFailure: (failErr) => {
          console.warn('Payment cancelled or failed:', failErr);
          showAlert(failErr.message || 'Payment cancelled or failed. Please try again.', 'warning');
          setIsRequesting(false);
        }
      });
    } catch (err) {
      console.error('Error initiating payment:', err);
      showAlert(err.response?.data?.error || 'Failed to initiate payment. Please try again.', 'error');
      setIsRequesting(false);
    }
  };

  if (loading || isSuperadmin) return children;

  const currentPlanName = (currentPlan?.plan_name || '').toLowerCase();
  const currentPlanCycle = (currentPlan?.billing_cycle || '').toLowerCase();
  const isTrialPlan = currentPlanName.includes('free') || currentPlanName.includes('trial') || currentPlanCycle === 'weekly';
  let planDurationDays = 30;
  if (isTrialPlan) {
      planDurationDays = 7;
  } else if (currentPlanCycle === 'annually' || currentPlanCycle === 'yearly') {
      planDurationDays = 365;
  } else if (currentPlanCycle === 'half-yearly') {
      planDurationDays = 180;
  } else if (currentPlanCycle === 'quarterly') {
      planDurationDays = 90;
  }

  const isSuspended = currentPlan?.company_status === 'suspended' || currentPlan?.company_status === 'inactive';
  let endDateEnd = null;
  if (currentPlan?.created_at) {
      const created = new Date(currentPlan.created_at);
      endDateEnd = new Date(created.getTime() + planDurationDays * 24 * 60 * 60 * 1000);
  } else if (currentPlan?.end_date) {
      endDateEnd = new Date(currentPlan.end_date);
      endDateEnd.setHours(23, 59, 59, 999);
  }
  const isExpired = !endDateEnd || endDateEnd < new Date();

  if (!isExpired && !isSuspended) {
    return (
      <>
        {children}
        {showWarning && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <div className={`${isTrialPlan ? 'bg-gradient-to-r from-violet-600 to-indigo-600' : 'bg-amber-500'} p-6 flex flex-col items-center justify-center text-white relative`}>
                <AlertTriangle size={40} className="mb-2" />
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {isTrialPlan ? 'Free Trial Ending Soon' : 'Subscription Expiring'}
                </h3>
              </div>
              <div className="p-8 text-center">
                <p className="text-slate-600 font-medium leading-relaxed mb-6">
                  {isTrialPlan ? (
                    <>
                      Your <span className="font-bold text-violet-600">Free Trial</span> is expiring in <span className="font-black text-rose-600">{daysLeftState <= 0 ? 'a few hours' : '1 day'}</span>. Please purchase a paid plan to continue using all HRM features without interruption.
                    </>
                  ) : (
                    <>
                      Your company's subscription to HRM Software is expiring in <span className="font-black text-amber-600">{daysLeftState} day{daysLeftState !== 1 ? 's' : ''}</span>. 
                      Please renew your plan soon to avoid any interruption in service.
                    </>
                  )}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      sessionStorage.setItem(`hasSeenExpiryWarning_${isTrialPlan ? 'trial_' : ''}${daysLeftState}`, 'true');
                      setHasDismissedWarning(true);
                      setShowWarning(false);
                    }}
                    className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
                  >
                    I Understand, Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }

  const paidPlans = availablePlans.filter(plan => {
    const name = (plan.name || '').toLowerCase();
    const cycle = (plan.duration || '').toLowerCase();
    const price = parseFloat(plan.price || 0);
    return !name.includes('free') && !name.includes('trial') && cycle !== 'weekly' && price > 0;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
      <div className="absolute top-6 right-6 z-[10000]">
        <button 
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-white font-bold text-sm transition-all shadow-lg"
        >
          <LogOut size={16} />
          Switch Company / Logout
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl shadow-rose-500/20 overflow-hidden flex flex-col md:flex-row relative"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="md:w-1/3 bg-gradient-to-b from-rose-500 to-rose-700 p-10 flex flex-col items-center justify-center text-center text-white relative z-10">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner backdrop-blur-md">
            <AlertTriangle size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">
            {isSuspended ? 'Account Suspended' : 'Subscription Expired'}
          </h2>
          <p className="text-rose-100 font-medium text-sm opacity-90 leading-relaxed">
            {isSuspended 
              ? 'Your company account has been suspended by the platform administrator. All dashboard access is temporarily disabled.'
              : "Your Free Trial / subscription has ended. Choose a plan below to immediately activate your account."
            }
          </p>
        </div>

        <div className="md:w-2/3 p-8 sm:p-10 bg-white relative z-10 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <CreditCard className="text-primary" /> {isSuspended ? 'Account Reactivation & Plans' : 'Choose a Paid Plan to Unlock'}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
              Trial Expired
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            {paidPlans.map(plan => {
              let feats = [];
              try {
                feats = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
              } catch(e) {}

              return (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.name)}
                  className={`cursor-pointer relative overflow-hidden rounded-2xl p-4 border-2 transition-all duration-300 ${
                    selectedPlan === plan.name 
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10 scale-[1.02]' 
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                        <Crown size={14} className="text-amber-500" /> {plan.name}
                      </h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{plan.duration || 'monthly'}</p>
                    </div>
                    <div className="text-base font-black text-slate-900">
                      ₹{parseFloat(plan.price || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {feats.slice(0, 3).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedPlan === plan.name ? 'border-primary bg-primary' : 'border-slate-200'
                  }`}>
                    {selectedPlan === plan.name && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                  </div>
                </div>
              );
            })}

            <div 
              onClick={() => setSelectedPlan('custom_enterprise')}
              className={`cursor-pointer relative overflow-hidden rounded-2xl p-4 border-2 transition-all duration-300 bg-gradient-to-br from-emerald-50/40 to-teal-50/40 ${
                selectedPlan === 'custom_enterprise'
                  ? 'border-emerald-500 bg-emerald-50/80 shadow-md shadow-emerald-500/10 scale-[1.02]' 
                  : 'border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50/60'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600" /> Custom Enterprise
                  </h4>
                  <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Tailored / WhatsApp</p>
                </div>
                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Contact
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  'Unlimited Employees & Custom Limits',
                  'Dedicated Server & Priority Setup',
                  '24/7 Dedicated Account Manager'
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-semibold text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
              <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                selectedPlan === 'custom_enterprise' ? 'border-emerald-600 bg-emerald-600' : 'border-emerald-300'
              }`}>
                {selectedPlan === 'custom_enterprise' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
              </div>
            </div>
          </div>

          {selectedPlan === 'custom_enterprise' ? (
            <button 
              onClick={handlePlanRequest}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
            >
              <MessageCircle size={20} className="text-white animate-bounce" />
              <span>Contact Sales on WhatsApp</span>
              <ArrowRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handlePlanRequest}
              disabled={isRequesting || !selectedPlan}
              className="w-full btn-primary px-8 py-4 flex items-center justify-center gap-2 shadow-xl shadow-primary/30 relative overflow-hidden group rounded-2xl text-sm font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
              {isRequesting ? <Zap size={20} className="animate-pulse" /> : <ShieldCheck size={20} />}
              <span className="relative z-10">{isRequesting ? 'Submitting...' : `Upgrade to ${selectedPlan} & Unlock`}</span>
            </button>
          )}
          
          <p className="text-center mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Instant activation upon confirmation
          </p>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-2">
            <button
              onClick={async () => {
                try {
                  Object.keys(sessionStorage).forEach(k => {
                    if (k.startsWith('hasSeenExpiryWarning')) {
                      sessionStorage.removeItem(k);
                    }
                  });
                  await api.post('/settings/test-subscription', { status: 'reset' });
                  window.dispatchEvent(new Event('subscription_updated'));
                  checkSubscription();
                } catch(e) {
                  console.error(e);
                }
              }}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border border-emerald-200 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔄</span> Developer Testing: Reset to 7 Days Trial
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionBlocker;
