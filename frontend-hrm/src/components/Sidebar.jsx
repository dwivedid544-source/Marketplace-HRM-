import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  Activity, 
  Wallet, 
  BarChart3, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Fingerprint,
  UserCheck,
  ChevronRight,
  Building2,
  CreditCard,
  ShieldAlert,
  ClipboardList,
  BookOpen,
  MapPin,
  Target,
  TabletSmartphone,
  CalendarOff,
  HelpCircle,
  LifeBuoy,
  Package,
  Database
} from 'lucide-react';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const Sidebar = ({ type = 'admin', onItemClick }) => {
  const { user, logout } = useAuth();
  const { t } = useSettings();
  const isMasterAdmin = user?.role?.toLowerCase().includes('master') || user?.role?.toLowerCase() === 'admin';

  const adminLinks = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/admin' },
    { name: 'Employees', icon: <Users size={18} />, path: '/admin/employees' },
    { name: 'Attendance', icon: <CalendarCheck size={18} />, path: '/admin/attendance' },
    { name: 'Face Register', icon: <Fingerprint size={18} />, path: '/admin/face-registration' },
    { name: 'Leaves', icon: <CalendarOff size={18} />, path: '/admin/leaves' },
    { name: 'Geo-Fencing', icon: <MapPin size={18} />, path: '/admin/geofencing', masterOnly: true },
    { name: 'Claims', icon: <ClipboardList size={18} />, path: '/admin/claims' },
    { name: 'KPI & Goals', icon: <Target size={18} />, path: '/admin/kpi' },
    { name: 'Kiosk Settings', icon: <TabletSmartphone size={18} />, path: '/admin/kiosk-settings', masterOnly: true },
    { name: 'Payroll', icon: <Wallet size={18} />, path: '/admin/payroll', masterOnly: true },
    { name: 'Invoices', icon: <FileText size={18} />, path: '/admin/invoices', masterOnly: true },
    { name: 'Reports', icon: <BarChart3 size={18} />, path: '/admin/reports' },
    { name: 'Audit Logs', icon: <ShieldAlert size={18} />, path: '/admin/audit-logs', masterOnly: true },
    { name: 'Backup & Data', icon: <Database size={18} />, path: '/admin/backup', masterOnly: true },
    { name: 'Settings', icon: <Settings size={18} />, path: '/admin/settings', masterOnly: true },
    { name: 'Profile', icon: <Users size={18} />, path: '/admin/profile' },
  ].filter(link => !link.masterOnly || isMasterAdmin);

  const employeeLinks = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/employee' },
    { name: 'My Attendance', icon: <CalendarCheck size={18} />, path: '/employee/attendance' },
    { name: 'Mobile Punch', icon: <MapPin size={18} />, path: '/employee/location-check' },
    { name: 'My Leaves', icon: <CalendarOff size={18} />, path: '/employee/leaves' },
    { name: 'My Claims', icon: <ClipboardList size={18} />, path: '/employee/claims' },
    { name: 'My KPI', icon: <Target size={18} />, path: '/employee/kpi' },
    { name: 'My Salary', icon: <Wallet size={18} />, path: '/employee/salary' },
    { name: 'Profile', icon: <Users size={18} />, path: '/employee/profile' },
  ];

  const superadminLinks = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/superadmin' },
    { name: 'Companies', icon: <Building2 size={18} />, path: '/superadmin/companies' },
    { name: 'Payment History', icon: <CreditCard size={18} />, path: '/superadmin/payments' },
    { name: 'Support Issues', icon: <LifeBuoy size={18} />, path: '/superadmin/support' },
    { name: 'Settings', icon: <Settings size={18} />, path: '/superadmin/settings' },
  ];

  const links = type === 'superadmin' ? superadminLinks : type === 'admin' ? adminLinks : employeeLinks;

  const handleLogout = () => {
    logout();
    if (onItemClick) onItemClick();
    window.location.href = '/login';
  };

  return (
    <div className="w-[235px] bg-white h-full flex flex-col no-print">
      {/* Brand Section */}
      <div className="p-5 border-b border-slate-100 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="HR Pilot Pro" className="w-11 h-11 object-contain drop-shadow-sm shrink-0" />
          <div>
             <span className="text-base font-black tracking-tight text-slate-800 uppercase leading-none block">HR PILOT</span>
             <span className="text-[9px] font-black text-sky-600 uppercase tracking-[0.25em] leading-none mt-1 block">PRO SYSTEM</span>
          </div>
        </div>
        {/* Mobile Close Button */}
        {onItemClick && (
          <button onClick={onItemClick} className="lg:hidden p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-lg transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-6 custom-scrollbar">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            end
            onClick={onItemClick}
            className={({ isActive }) => `
              flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-300 group
              ${isActive 
                ? 'bg-primary text-white shadow-xl shadow-primary/20 translate-x-1' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-primary hover:translate-x-1'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'}`}>
                    {link.icon}
                  </span>
                  <span className="font-black text-[11px] uppercase tracking-wider leading-none truncate">
                    {t(link.name)}
                  </span>
                </div>
                {isActive && (
                  <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="shrink-0 ml-1">
                    <ChevronRight size={14} className="text-white/70" />
                  </motion.div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer Profile Preview */}
      <div className="p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-white border border-slate-100 shadow-sm mb-4">
           <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
              {user?.photo ? (
                <img src={user.photo} alt="user" className="w-full h-full object-cover" />
              ) : (
                <Users size={16} className="text-slate-300" />
              )}
           </div>
           <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-800 truncate uppercase">
                {user?.name || 'HRM Admin'}
              </p>
              <p className="text-[8px] font-bold text-emerald-500 uppercase">{t('Active Now')}</p>
           </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all duration-200 font-black text-[11px] uppercase tracking-widest cursor-pointer"
        >
          <LogOut size={18} />
          <span>{t('Logout')}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
