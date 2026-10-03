import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { useSettings } from '../../context/SettingsContext';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreHorizontal,
  CalendarCheck,
  Calendar,
  Wallet,
  Activity,
  MapPin,
  Fingerprint
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const data = [];

const StatCard = ({ title, value, icon, subValue, color }) => (
  <motion.div 
    whileHover={{ y: -3 }}
    className="card flex items-center gap-4"
  >
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600 shrink-0 shadow-sm`}>
      {React.cloneElement(icon, { size: 20 })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest truncate">{title}</p>
      <h3 className="text-xl font-black text-slate-800 leading-none">{value}</h3>
      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{subValue}</p>
    </div>
  </motion.div>
);

const EmployeeDashboard = () => {
  const { currencySymbol, t } = useSettings();
  const [stats, setStats] = useState({
    attendance: '0%',
    hours: '0h',
    performance: '0.0',
    salary: `${currencySymbol}0`
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      fetchPersonalData(u.id || u.userId);
    }
  }, []);

  const fetchPersonalData = async (userId) => {
    try {
      setLoading(true);
      const [attRes, payRes] = await Promise.all([
        api.get('/attendance'),
        api.get('/payroll')
      ]);
      
      const myAttendance = attRes.data; // Backend already filters for role='employee'
      const myPayroll = payRes.data[0]; // Get the latest record for this user
      
      // Filter attendance to this month
      const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. '2026-06'
      const thisMonthAttendance = myAttendance.filter(a => a.date && a.date.startsWith(currentMonthStr));
      
      // Calculate Stats
      const totalHours = thisMonthAttendance.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) || 0), 0);
      const presentDays = thisMonthAttendance.filter(a => a.status?.toLowerCase() === 'present' || a.status?.toLowerCase() === 'late').length;
      
      // Calculate dynamic performance score based on on-time vs late vs absent
      let perfScore = 100;
      if (thisMonthAttendance.length > 0) {
          const onTimeDays = thisMonthAttendance.filter(a => a.status?.toLowerCase() === 'present').length;
          const lateDays = thisMonthAttendance.filter(a => a.status?.toLowerCase() === 'late').length;
          perfScore = Math.round(((onTimeDays + (lateDays * 0.5)) / thisMonthAttendance.length) * 100);
      }
      
      setStats({
        attendance: `${presentDays} ${t('Days')}`,
        hours: `${totalHours.toFixed(1)}h`,
        performance: `${perfScore}%`,
        salary: myPayroll?.net_salary ? `${currencySymbol}${parseFloat(myPayroll.net_salary).toLocaleString()}` : `${currencySymbol}0`
      });

      // Prepare Chart Data (Last 7 days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const log = myAttendance.find(a => a.date.startsWith(dateStr));
        return {
          name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          hours: log ? parseFloat(log.total_hours || 0) : 0
        };
      });
      setChartData(last7Days);

      // Recent Logs
      setRecentLogs(myAttendance.slice(0, 3));

    } catch (err) {
      console.error('Error fetching employee stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Welcome Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{t('My Dashboard')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">{t('Welcome back,')} {user?.name || 'Employee'}</p>
        </div>
        <div className="flex items-center gap-2">
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${user?.status === 'active' || !user?.status ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className={`h-2 w-2 rounded-full ${user?.status === 'active' || !user?.status ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${user?.status === 'active' || !user?.status ? 'text-emerald-700' : 'text-rose-700'}`}>
                 {user?.status === 'active' || !user?.status ? t('Account Active') : t('Account Inactive')}
              </span>
           </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("Days Present")} value={loading ? '...' : stats.attendance} icon={<CalendarCheck />} subValue={t("This Month")} color="bg-indigo-500" />
        <StatCard title={t("Total Hours")} value={loading ? '...' : stats.hours} icon={<Clock />} subValue={t("Logged Work")} color="bg-emerald-500" />
        <StatCard title={t("Performance")} value={loading ? '...' : stats.performance} icon={<TrendingUp />} subValue={t("Rating Score")} color="bg-blue-500" />
        <StatCard title={t("Last Payout")} value={loading ? '...' : stats.salary} icon={<Wallet />} subValue={t("Net Salary")} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Working Hours Chart */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">{t('My Working Hours')}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{t('Weekly activity breakdown')}</p>
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 bg-slate-50 rounded-lg">{t('Last 7 Days')}</div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                  cursor={{ stroke: '#4F46E5', strokeWidth: 2 }}
                />
                <Area type="monotone" dataKey="hours" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Status Card */}
        <div className="card bg-slate-900 text-white border-none shadow-xl shadow-slate-900/10 flex flex-col">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-[12px] font-black uppercase tracking-widest">{t('Recent Activity')}</h3>
              <span className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div> {t('Updated')}
              </span>
           </div>

            <div className="space-y-4 flex-1">
               {recentLogs.length > 0 ? recentLogs.map((log, i) => (
                 <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-tight">{new Date(log.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{t(log.status)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[11px] font-black text-emerald-400">+{log.total_hours}h</p>
                    </div>
                 </div>
               )) : (
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center py-10">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('No recent activity detected')}</p>
                 </div>
               )}
            </div>

           <Link to="/employee/attendance" className="block text-center w-full mt-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5">
              {t('View All Logs')}
           </Link>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
