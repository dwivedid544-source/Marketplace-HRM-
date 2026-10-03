import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Users, CreditCard, Activity, DollarSign, Building2 } from 'lucide-react';
import saApi from '../../services/superAdminApi';
import { useSettings } from '../../context/SettingsContext';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const formatINR = (amount) => {
  const num = parseFloat(amount || 0);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Analytics = () => {
  const [data, setData] = useState({
    overview: { totalRevenue: 0, activeSubscriptions: 0, totalCompanies: 0, activeUsers: 0 },
    revenueTrend: [],
    planDistribution: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saApi.get('/analytics/overview')
      .then(res => {
        if (res.data && res.data.overview) {
          setData(res.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch analytics', err);
        setLoading(false);
      });
  }, []);

  const stats = [
    { label: 'Total Revenue', value: formatINR(data.overview.totalRevenue), icon: <DollarSign size={20} />, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Active Subscriptions', value: data.overview.activeSubscriptions, icon: <CreditCard size={20} />, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    { label: 'Active Users', value: data.overview.activeUsers, icon: <Users size={20} />, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Total Companies', value: data.overview.totalCompanies, icon: <Building2 size={20} />, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Analytics Overview</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Platform growth and revenue metrics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} border ${stat.border}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={18} className="text-primary" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Revenue Trend (Last 6 Months)</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} tickFormatter={(val) => `₹${val}`} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Plan Distribution Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-6">
            <Activity size={18} className="text-emerald-500" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Plan Distribution</h3>
          </div>
          <div className="h-[300px] w-full flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.planDistribution}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Label inside Donut */}
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-2xl font-black text-slate-800">{data.overview.activeSubscriptions}</span>
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Active</span>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Analytics;
