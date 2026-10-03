import React, { useState, useEffect } from 'react';
import saApi from '../../services/superAdminApi';
import api from '../../utils/axios';
import { Building2, Activity, CreditCard, Users, ArrowUpRight, ArrowDownRight, Server, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSettings } from '../../context/SettingsContext';

const StatCard = ({ title, value, icon, trend, trendValue, color }) => (
  <motion.div whileHover={{ y: -3 }} className="card flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600 shrink-0 shadow-sm`}>
      {React.cloneElement(icon, { size: 20 })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest truncate">{title}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <h3 className="text-xl font-black text-slate-800 leading-none">{value}</h3>
        <div className={`flex items-center text-[10px] font-black ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
          {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trendValue}
        </div>
      </div>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const { formatDate } = useSettings();
  const [stats, setStats] = useState({ totalCompanies: 0, activeCompanies: 0, monthlyRevenue: 0, totalAdmins: 0, totalEmployees: 0, activePlans: 0, chartData: [], recentActivity: [] });
  const [recentCompanies, setRecentCompanies] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const formatLogDetails = (details) => {
    if (!details) return 'Action Executed';
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      if (typeof parsed === 'object' && parsed !== null) {
         if (parsed.info) return parsed.info;
         return Object.entries(parsed).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`).join(', ');
      }
      return String(details);
    } catch (e) {
      return String(details);
    }
  };
  const [chartFilter, setChartFilter] = useState(7);

  useEffect(() => {
    fetchStats();
    saApi.get('/companies').then(res => setRecentCompanies(res.data.slice(0, 5))).catch(console.error);
    api.get('/plans').then(res => setAvailablePlans(res.data)).catch(console.error);
  }, [chartFilter]);

  const getPlanName = (planIdentifier) => {
    if (!planIdentifier) return 'No Plan';
    const planObj = availablePlans.find(p => p.id === parseInt(planIdentifier) || p.name === planIdentifier);
    return planObj ? planObj.name : planIdentifier;
  };

  const fetchStats = () => {
    saApi.get(`/dashboard/stats?days=${chartFilter}`).then(res => setStats(res.data)).catch(console.error);
  };

  const handleGenerateReport = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("HRM SOFTWARE - SUPERADMIN REPORT", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated on: ${formatDate(new Date(), true)}`, 14, 30);
      
      // Divider
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 35, 196, 35);

      // Key Metrics
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Platform Metrics Overview", 14, 45);

      autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Value']],
        body: [
          ['Total Companies', stats.totalCompanies.toString()],
          ['Total Revenue', `INR ${(stats.monthlyRevenue || 0).toLocaleString('en-IN')}`],
          ['Active Plans (Paid)', stats.activePlans.toString()],
          ['Total Employees (Global)', stats.totalEmployees.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 11, cellPadding: 5 }
      });

      // Recent Companies
      const finalY1 = doc.lastAutoTable.finalY || 50;
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Recently Onboarded Companies", 14, finalY1 + 15);

      autoTable(doc, {
        startY: finalY1 + 20,
        head: [['Company Name', 'Contact Email', 'Plan', 'Status']],
        body: recentCompanies.map(c => [
          c.company_name, 
          c.email, 
          c.active_plan || c.plan || 'No Plan', 
          (c.status || 'Pending').toUpperCase()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        styles: { fontSize: 10 }
      });

      // Recent Activity
      const finalY2 = doc.lastAutoTable.finalY || finalY1;
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Recent Audit Logs", 14, finalY2 + 15);

      autoTable(doc, {
        startY: finalY2 + 20,
        head: [['Date/Time', 'Action', 'Details']],
        body: stats.recentActivity ? stats.recentActivity.map(log => [
          formatDate(log.created_at, true),
          log.action.replace(/_/g, ' ').toUpperCase(),
          log.details ? JSON.stringify(log.details) : 'Action Executed'
        ]) : [],
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
        styles: { fontSize: 9, cellPadding: 4 }
      });

      doc.save(`HRM_Software_Platform_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating structured PDF:', error);
      alert('Failed to generate report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            SuperAdmin Dashboard
          </h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            Platform overview and key metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className={`px-4 py-2 bg-slate-800 text-white rounded-lg text-[11px] font-black uppercase tracking-widest shadow-md transition-colors ${isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-700'}`}
          >
            {isGenerating ? 'Generating PDF...' : 'Generate Report'}
          </button>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Companies" value={stats.totalCompanies} icon={<Building2 />} trend="up" trendValue={`${stats.activeCompanies || 0} Active`} color="bg-indigo-500" />
        <StatCard title="Total Revenue" value={`₹${(stats.monthlyRevenue || 0).toLocaleString('en-IN')}`} icon={<CreditCard />} trend="up" trendValue="Earnings" color="bg-emerald-500" />
        <StatCard title="Active Plans" value={stats.activePlans} icon={<Activity />} trend="up" trendValue={`${stats.activePlans || 0} Paid`} color="bg-amber-500" />
        <StatCard title="Total Employees" value={stats.totalEmployees} icon={<Users />} trend="up" trendValue={`${stats.totalEmployees || 0} Staff`} color="bg-sky-500" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Platform Growth</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Revenue vs Signups</p>
            </div>
            <select 
              className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-tighter shadow-sm"
              value={chartFilter}
              onChange={(e) => setChartFilter(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData && stats.chartData.length > 0 ? stats.chartData : []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }}
                  itemStyle={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '9px' }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={1500} />
                <Area type="monotone" dataKey="signups" name="New Signups" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorSignups)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Recent Activity</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Platform Audit Logs</p>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto max-h-[300px] space-y-3 custom-scrollbar pr-2">
            {stats.recentActivity && stats.recentActivity.length > 0 ? stats.recentActivity.map((log, i) => (
              <div key={i} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">{log.action.replace(/_/g, ' ')}</span>
                <span className="text-[11px] font-bold text-slate-600 truncate">{formatLogDetails(log.details)}</span>
                <span className="text-[9px] font-bold text-slate-400 mt-1">{formatDate(log.created_at, true)}</span>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-[10px] font-black text-slate-400 uppercase tracking-widest py-10">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Companies Table */}
      <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-4">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Recently Onboarded</h3>
          <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">Company Name</th>
                <th className="p-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">Plan</th>
                <th className="p-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentCompanies.length > 0 ? recentCompanies.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="text-[12px] font-black text-slate-700 leading-tight">{c.company_name}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{c.email}</p>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">{getPlanName(c.active_plan || c.plan)}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {c.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="3" className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">No recent signups.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
