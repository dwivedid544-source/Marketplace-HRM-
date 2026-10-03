import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { LifeBuoy, Menu, LogOut, FileText, FileSpreadsheet, FileIcon, Settings, Users, ArrowUpRight, ArrowLeft, MoreVertical, Search, Bell, AlertCircle, Info, ChevronRight, CheckCircle2, User, Building, Building2, BellOff, AlertTriangle, Clock, X, ChevronDown, BookOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../utils/axios';
import SubscriptionBlocker from './SubscriptionBlocker';

const Layout = ({ children, type = 'admin' }) => {
  const { user, logout } = useAuth();
  const { t } = useSettings();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [realNotifications, setRealNotifications] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState(null);
  const [isTimeWarning, setIsTimeWarning] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'Master Admin' && user.role !== 'superadmin') {
      const fetchPlan = async () => {
        try {
          const res = await api.get('/settings/current-plan');
          setCurrentPlan(res.data);
        } catch (e) {}
      };
      fetchPlan();
      const int = setInterval(fetchPlan, 30000);
      
      const handleUpdate = () => fetchPlan();
      window.addEventListener('subscription_updated', handleUpdate);
      
      return () => {
          clearInterval(int);
          window.removeEventListener('subscription_updated', handleUpdate);
      };
    }
  }, [user]);

  useEffect(() => {
    if (!currentPlan) return;
    
    const updateTimer = () => {
        let endDateEnd = null;
        const cycle = (currentPlan.billing_cycle || '').toLowerCase();
        const plan = (currentPlan.plan_name || '').toLowerCase();
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

        if (currentPlan.created_at) {
            // Exact 168 hours (7 days) from subscription creation time
            const created = new Date(currentPlan.created_at);
            endDateEnd = new Date(created.getTime() + durationDays * 24 * 60 * 60 * 1000);
        } else if (currentPlan.end_date) {
            endDateEnd = new Date(currentPlan.end_date);
            endDateEnd.setHours(23, 59, 59, 999);
        }
        
        if (!endDateEnd) return;
        const diff = endDateEnd - new Date();
        if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60)) % 60);
            const s = Math.floor((diff / 1000) % 60);
            
            if (d === 0 && h === 0) {
                setTimeLeftStr(`${m}m ${s}s left`);
            } else if (d === 0) {
                setTimeLeftStr(`${h}h ${m}m left`);
            } else {
                setTimeLeftStr(`${d}d ${h}h left`);
            }
            setIsTimeWarning(diff <= 3 * 24 * 60 * 60 * 1000);
        } else {
            setTimeLeftStr(null);
            setIsTimeWarning(false);
        }
    };
    
    updateTimer();
    const timerInt = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInt);
  }, [currentPlan]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const notifTimer = setInterval(fetchNotifications, 10000);
      return () => clearInterval(notifTimer);
    }
  }, [user]);

  const fetchNotifications = () => {
      api.get('/notifications')
        .then(res => setRealNotifications(Array.isArray(res.data) ? res.data : []))
        .catch(err => {
          console.error('Failed to load notifications', err);
          setRealNotifications([]);
        });
  };

  const markAsRead = async (id) => {
      try {
          await api.put(`/notifications/${id}/read`);
          fetchNotifications();
      } catch (err) {
          console.error('Failed to mark as read', err);
      }
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) {
        markAsRead(n.id);
    }
    setShowNotifications(false);
  };

  const markAllAsRead = async () => {
      try {
          await api.put(`/notifications/read-all`);
          fetchNotifications();
      } catch (err) {
          console.error('Failed to mark all as read', err);
      }
  };

  const notificationsList = Array.isArray(realNotifications) ? realNotifications : [];
  const unreadCount = notificationsList.filter(n => !n.is_read).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block shrink-0 border-r border-slate-200 h-full shadow-sm bg-white z-30 no-print">
        <Sidebar type={type} />
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] lg:hidden"
            />
            <motion.div
              initial={{ x: -235 }} animate={{ x: 0 }} exit={{ x: -235 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[235px] bg-white z-[50] lg:hidden shadow-2xl"
            >

              <Sidebar type={type} onItemClick={() => setMobileMenuOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Refined Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-2.5 sm:px-6 sticky top-0 z-20 shrink-0 shadow-sm no-print">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-100 shrink-0"
            >
              <Menu size={20} className="sm:w-[22px] sm:h-[22px]" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              {timeLeftStr ? (
                <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border shrink-0 ${isTimeWarning ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className={`h-2 w-2 rounded-full animate-pulse shrink-0 ${isTimeWarning ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest ${isTimeWarning ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {isTimeWarning ? `${t('Renew')} • ${timeLeftStr}` : `${t('Active')} • ${timeLeftStr}`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 rounded-full border border-emerald-100 shrink-0">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 uppercase tracking-wider sm:tracking-widest">{t('Online')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 sm:p-2.5 rounded-2xl transition-all duration-300 border backdrop-blur-sm shadow-sm ${showNotifications ? 'bg-indigo-500 text-white border-indigo-400 shadow-indigo-200/50' : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 bg-white'}`}
              >
                <Bell size={18} className={`sm:w-5 sm:h-5 ${unreadCount > 0 ? "animate-[ring_2s_ease-in-out_infinite]" : ""}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center shadow-md">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setShowNotifications(false)}
                      className="fixed inset-0 z-10 bg-slate-900/5 backdrop-blur-[1px]"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-4 sm:w-96 bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white/50 z-30 overflow-hidden ring-1 ring-slate-900/5"
                    >
                      <div className="p-5 border-b border-slate-100/50 bg-gradient-to-br from-indigo-50/50 to-white/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Bell size={16} className="fill-indigo-100" />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-800 text-sm tracking-tight">{t('Notifications')}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{t('Alerts & Updates')}</p>
                          </div>
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors px-3 py-1.5 rounded-xl border border-indigo-100/50 flex items-center gap-1.5">
                                <CheckCircle2 size={12} /> {t('MARK ALL READ')}
                            </button>
                        )}
                      </div>
                      <div className="max-h-[28rem] overflow-y-auto custom-scrollbar bg-slate-50/30">
                        {notificationsList.length === 0 ? (
                          <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                              <BellOff size={28} />
                            </div>
                            <p className="text-slate-500 font-bold text-sm">{t('No new notifications')}</p>
                            <p className="text-slate-400 text-xs mt-1">{t("You're all caught up!")}</p>
                          </div>
                        ) : (
                          <div className="p-2 space-y-1">
                            {notificationsList.map((n, i) => (
                              <div key={i} onClick={() => handleNotificationClick(n)} className={`relative p-4 rounded-2xl transition-all cursor-pointer group flex gap-4 ${n.is_read ? 'bg-transparent hover:bg-slate-100/50' : 'bg-white shadow-sm ring-1 ring-indigo-50 hover:shadow-md'}`}>
                                <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-inner ${
                                  n.type === 'error' ? 'bg-rose-50 text-rose-500' :
                                  n.type === 'warning' ? 'bg-amber-50 text-amber-500' :
                                  n.type === 'success' ? 'bg-emerald-50 text-emerald-500' :
                                  'bg-indigo-50 text-indigo-500'
                                }`}>
                                  {n.type === 'error' ? <AlertCircle size={18} /> : n.type === 'warning' ? <AlertTriangle size={18} /> : n.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                      <p className={`text-sm font-black truncate transition-colors ${n.is_read ? 'text-slate-700' : 'text-slate-900 group-hover:text-indigo-600'}`}>{n.title}</p>
                                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>}
                                  </div>
                                  <p className={`text-xs mt-1 leading-relaxed ${n.is_read ? 'text-slate-500' : 'text-slate-600'}`}>{n.message}</p>
                                  <p className="text-[9px] font-black text-slate-400 mt-2.5 uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={10} /> {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {type !== 'employee' && (
              <>
                <Link
                  to="/admin/guide"
                  title={t('How to Use')}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 text-slate-700 hover:text-primary transition-all text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  <BookOpen size={16} className="text-indigo-600" />
                  <span className="hidden md:inline">{t('How to Use')}</span>
                </Link>

                <Link
                  to={type === 'superadmin' ? '/superadmin/support' : '/admin/support'}
                  title={t('Help Desk')}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 text-slate-700 hover:text-primary transition-all text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  <LifeBuoy size={16} className="text-primary" />
                  <span className="hidden md:inline">{t('Help Desk')}</span>
                </Link>

                <div className="h-8 w-px bg-slate-200 mx-1"></div>
              </>
            )}

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className={`flex items-center gap-3 pl-1 group p-1.5 pr-3 rounded-2xl border transition-all cursor-pointer ${
                  showProfileMenu
                    ? 'bg-primary/10 border-primary/30 text-primary shadow-xs'
                    : 'bg-slate-50 hover:bg-primary/5 hover:border-primary/20 border-slate-100 text-slate-700'
                }`}
              >
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-all">
                {user?.photo ? (
                  <img src={user.photo} alt="user" className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-slate-300" />
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[12px] font-black text-slate-800 leading-none group-hover:text-primary transition-colors uppercase tracking-tight">
                  {user?.name || 'HRM Admin'}
                </p>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {t(user?.role || 'Master Admin')}
                </p>
              </div>
              <ChevronDown size={14} className="text-slate-400 group-hover:text-primary transition-colors ml-1" />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowProfileMenu(false)}
                    className="fixed inset-0 z-10 bg-slate-900/5 backdrop-blur-[1px]"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-64 bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] border border-slate-100 z-30 overflow-hidden ring-1 ring-slate-900/5 divide-y divide-slate-100"
                  >
                    {/* User Header */}
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black shrink-0 overflow-hidden">
                        {user?.photo ? (
                          <img src={user.photo} alt="user" className="w-full h-full object-cover" />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                          {user?.name || 'HRM Admin'}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 truncate">
                          {user?.email || user?.role || 'Admin'}
                        </p>
                      </div>
                    </div>

                    {/* Menu Options */}
                    <div className="p-2 space-y-1">
                      <Link
                        to={`/${type}/profile`}
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-black text-slate-700 hover:text-primary hover:bg-primary/5 transition-all group cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-primary/10 text-slate-500 group-hover:text-primary flex items-center justify-center transition-colors">
                          <User size={15} />
                        </div>
                        <span className="uppercase tracking-wider">{t('Profile')}</span>
                      </Link>
                    </div>

                    {/* Logout */}
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                          window.location.href = '/login';
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-black text-rose-600 hover:bg-rose-50 transition-all group cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                          <LogOut size={15} />
                        </div>
                        <span className="uppercase tracking-wider">{t('Logout')}</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Content Area - Medium Density Padding */}
        <SubscriptionBlocker>
          <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3 sm:p-5 lg:p-6">
            <div className="max-w-[1600px] mx-auto w-full">
              {children}
            </div>
          </main>
        </SubscriptionBlocker>
      </div>
    </div>
  );
};

export default Layout;
