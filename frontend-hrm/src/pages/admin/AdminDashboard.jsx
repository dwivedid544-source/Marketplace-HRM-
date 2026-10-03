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
  Edit3,
  X
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

const data = [];

const StatCard = ({ title, value, icon, trend, trendValue, color }) => (
  <motion.div
    whileHover={{ y: -3 }}
    className="card flex items-center gap-2.5 sm:gap-4 p-3 sm:p-5"
  >
    <div className={`p-2.5 sm:p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600 shrink-0 shadow-sm`}>
      {React.cloneElement(icon, { size: 18, className: "sm:w-5 sm:h-5" })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-slate-400 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest truncate">{title}</p>
      <div className="flex items-baseline gap-1.5 sm:gap-2">
        <h3 className="text-lg sm:text-xl font-black text-slate-800 leading-none">{value}</h3>
        <div className={`flex items-center text-[9px] sm:text-[10px] font-black ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend === 'up' ? <ArrowUpRight size={11} className="sm:w-3 sm:h-3" /> : <ArrowDownRight size={11} className="sm:w-3 sm:h-3" />}
          {trendValue}
        </div>
      </div>
    </div>
  </motion.div>
);

const AdminDashboard = () => {
  const { currencySymbol, formatCurrency, t } = useSettings();
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentNow: 0,
    absentToday: 0,
    lateEntry: 0,
    trend: [],
    salaryCycle: {
      progress: 0,
      day: 0,
      totalDays: 15,
      estimatedPayout: 0,
      pendingAmount: 0
    }
  });
  const [range, setRange] = useState(7);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  // Salary Cycle Edit State
  const [showSalaryCycleModal, setShowSalaryCycleModal] = useState(false);
  const [cycleType, setCycleType] = useState('Monthly (1st to 30th)');
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [savingCycle, setSavingCycle] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      const [empRes, attRes, statsRes, settingsRes] = await Promise.all([
        api.get('/employees'),
        api.get('/attendance', { params: { date: localDate } }),
        api.get('/stats/dashboard', { params: { date: localDate, range } }),
        api.get('/settings')
      ]);

      setEmployees(empRes.data);
      setAttendanceLogs(attRes.data);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const openSalaryCycleModal = () => {
    setCycleType(settings?.salary_cycle || stats.salaryCycle?.cycleType || 'Monthly (1st to 30th)');
    setCycleStartDay(settings?.salary_cycle_start_date || stats.salaryCycle?.startDay || 1);
    setShowSalaryCycleModal(true);
  };

  const handleSaveSalaryCycle = async (e) => {
    e?.preventDefault();
    setSavingCycle(true);
    try {
      await api.put('/settings', {
        ...settings,
        salary_cycle: cycleType,
        salary_cycle_start_date: parseInt(cycleStartDay) || 1
      });
      setShowSalaryCycleModal(false);
      await fetchDashboardData();
    } catch (err) {
      console.error('Error saving salary cycle:', err);
    } finally {
      setSavingCycle(false);
    }
  };
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tighter truncate">
            {settings?.business_name || t('Dashboard')}
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider sm:tracking-widest leading-none mt-0.5 sm:mt-0">
            {t('Upcoming Pay Date')}: {new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() <= 15 ? 15 : 30).toLocaleDateString()}
          </p>
        </div>

      </div>

      {/* Stats Grid - 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard 
          title={t('Total Staff')} 
          value={loading ? '...' : stats.totalStaff} 
          icon={<Users />} 
          trend={stats.totalStaffTrend?.trend || 'up'} 
          trendValue={stats.totalStaffTrend?.value || '0%'} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title={t('Present Now')} 
          value={loading ? '...' : stats.presentToday} 
          icon={<UserCheck />} 
          trend={stats.presentTrend?.trend || 'up'} 
          trendValue={stats.presentTrend?.value || '0%'} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title={t('Absent Today')} 
          value={loading ? '...' : stats.absentToday} 
          icon={<UserMinus />} 
          trend={stats.absentTrend?.trend || 'down'} 
          trendValue={stats.absentTrend?.value || '0%'} 
          color="bg-rose-500" 
        />
        <StatCard 
          title={t('Late Entry')} 
          value={loading ? '...' : stats.lateToday} 
          icon={<Clock />} 
          trend={stats.lateTrend?.trend || 'up'} 
          trendValue={stats.lateTrend?.value || '0%'} 
          color="bg-amber-500" 
        />
      </div>

      {/* Charts & Biometric Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        <div className="lg:col-span-2 card flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">{t('Attendance Trend')}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                {range === 7 ? t('Weekly Performance Analytics') : range === 30 ? t('Monthly Performance Analytics') : t('Quarterly Performance Analytics')}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-black text-primary uppercase tracking-tighter shadow-sm">
              {t('Last 7 Days')}
            </div>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            {stats.trend && stats.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    itemStyle={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '9px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    name="Present"
                    stroke="#4F46E5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorPresent)"
                    animationDuration={1500}
                  />
                  <Area
                    type="monotone"
                    dataKey="absent"
                    name="Absent"
                    stroke="#EF4444"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorAbsent)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-widest">Loading Analytics...</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 card h-full flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">{t('Salary Cycle')}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {stats.salaryCycle?.formattedRange || (settings?.salary_cycle || t('15 Days Cycle'))}
              </p>
            </div>
            <button
              onClick={openSalaryCycleModal}
              className="p-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-primary/10 text-slate-600 hover:text-primary transition-all text-[10px] font-black uppercase flex items-center gap-1.5 border border-slate-100 shadow-sm cursor-pointer"
              title={t('Configure Salary Cycle')}
            >
              <Edit3 size={13} />
              <span>{t('Edit')}</span>
            </button>
          </div>

          <div className="flex flex-col items-center my-auto py-2">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
                <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={339} strokeDashoffset={339 * (1 - (stats.salaryCycle?.progress || 0) / 100)} strokeLinecap="round" className="text-primary transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-800">{stats.salaryCycle?.progress}%</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">{t('Day')} {stats.salaryCycle?.day}/{stats.salaryCycle?.totalDays}</span>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/15 text-primary text-[10px] font-black tracking-wider uppercase">
              <Calendar size={11} />
              <span>{stats.salaryCycle?.cycleType || settings?.salary_cycle || t('Monthly Cycle')}</span>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('Est. Payout')}</span>
              <span className="text-[12px] font-black text-slate-800">
                {formatCurrency(stats.salaryCycle?.estimatedPayout || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('Contributions')}</span>
              <span className="text-[12px] font-black text-amber-600">{formatCurrency(stats.totalContributionCollected || stats.totalCpfCollected || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Salary Cycle Edit Modal */}
      {showSalaryCycleModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-[90%] sm:w-[80%] md:w-[45%] lg:w-[40%] max-w-[460px] shadow-2xl border border-slate-100 relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('Configure Salary Cycle')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{t('Set when your company payroll cycle begins')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSalaryCycleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSalaryCycle} className="space-y-4 pt-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  {t('Payout Cycle Frequency')}
                </label>
                <select
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Monthly (1st to 30th)">Monthly (Custom Start Date)</option>
                  <option value="15 Days Cycle">15 Days Cycle (Bi-Weekly)</option>
                  <option value="Weekly Payout">Weekly Payout (7 Days)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Cycle Start Day (Day of Month)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={cycleStartDay}
                    onChange={(e) => setCycleStartDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="text-[11px] text-slate-500 font-medium leading-tight">
                    Day <strong>{cycleStartDay}</strong> of every month <br />
                    <span className="text-[10px] text-slate-400">
                      {cycleType.includes('Monthly')
                        ? `(e.g. ${cycleStartDay}th of this month to ${cycleStartDay === 1 ? 'End' : (cycleStartDay - 1)}th of next month)`
                        : `(Starts on Day ${cycleStartDay})`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Quick Presets</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCycleType('Monthly (1st to 30th)'); setCycleStartDay(1); }}
                    className={`p-2 rounded-xl text-[10px] font-bold text-left border transition-all cursor-pointer ${
                      cycleType.includes('Monthly') && cycleStartDay === 1
                        ? 'bg-primary/10 border-primary text-primary font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🏢 1st of Month (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCycleType('Monthly (1st to 30th)'); setCycleStartDay(25); }}
                    className={`p-2 rounded-xl text-[10px] font-bold text-left border transition-all cursor-pointer ${
                      cycleType.includes('Monthly') && cycleStartDay === 25
                        ? 'bg-primary/10 border-primary text-primary font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    💼 25th of Month (Corporate)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCycleType('Monthly (1st to 30th)'); setCycleStartDay(10); }}
                    className={`p-2 rounded-xl text-[10px] font-bold text-left border transition-all cursor-pointer ${
                      cycleType.includes('Monthly') && cycleStartDay === 10
                        ? 'bg-primary/10 border-primary text-primary font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📅 10th of Month
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCycleType('15 Days Cycle'); setCycleStartDay(1); }}
                    className={`p-2 rounded-xl text-[10px] font-bold text-left border transition-all cursor-pointer ${
                      cycleType === '15 Days Cycle'
                        ? 'bg-primary/10 border-primary text-primary font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ 15 Days (Bi-Weekly)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSalaryCycleModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCycle}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingCycle ? 'Saving...' : 'Apply Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Absent Staff List */}
      <div className="grid grid-cols-1 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Absent Staff List</h3>
            <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">Not Clocked In Today</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-3 font-black text-slate-400 text-[9px] uppercase tracking-widest">Employee Information</th>

                  <th className="pb-3 font-black text-slate-400 text-[9px] uppercase tracking-widest text-right">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {!loading && stats.absentStaff && stats.absentStaff.length > 0 ? (
                  stats.absentStaff.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-[12px] font-black uppercase shadow-sm overflow-hidden">
                            {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" alt="" /> : emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-slate-700 leading-tight">{emp.name}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Employee ID: {emp.custom_id || emp.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-right">
                        <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black uppercase tracking-tighter border border-rose-100 shadow-sm">
                          Not Present
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="text-center">
                    <td colSpan="2" className="py-20">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-2">
                          <UserCheck size={24} />
                        </div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          {loading ? 'Analyzing real-time logs...' : 'Perfect Attendance! All staff are present.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
