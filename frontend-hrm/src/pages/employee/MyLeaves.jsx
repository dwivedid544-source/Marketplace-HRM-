import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axios';
import { 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  Filter,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const MyLeaves = () => {
  const { t } = useSettings();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState({ annual: 0, sick: 0, unpaid: 0, emergency: 0 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const [leavesRes, balancesRes] = await Promise.all([
        api.get('/leaves'),
        api.get('/leaves/balances')
      ]);
      setLeaves(leavesRes.data);
      setBalances(balancesRes.data);
    } catch (err) {
      console.error('Error fetching employee leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const filteredLeaves = leaves.filter(leave => {
    return filterStatus === 'All' || leave.status?.toLowerCase() === filterStatus.toLowerCase();
  });
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('My Leaves')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Monitor balances, check application status, and request time off')}
          </p>
        </div>
        <Link 
          to="/employee/leaves/apply"
          className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          {t('Apply For Leave')}
        </Link>
      </div>

      {/* Leave History Table Card */}
      <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
        {/* Table Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('Leave Log History')}</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t('Records of all requested and processed leaves')}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto overflow-hidden">
            {/* Filter by Status */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full scrollbar-none shrink-0 whitespace-nowrap">
              <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider shrink-0">{t('Status')}:</span>
              {['All', 'Pending', 'Approved', 'Rejected'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shrink-0 ${
                    filterStatus === s 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 pl-8 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Requested Duration')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Total Days')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Applied Date')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Reason')}</th>
                <th className="py-4 pr-8 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Retrieving Time-Off Records...')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLeaves.length > 0 ? (
                filteredLeaves.map((leave, idx) => (
                  <tr key={leave.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="py-5 pl-8">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <span>{new Date(leave.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span>{new Date(leave.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {leave.half_day === 1 && (
                        <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 inline-block">{t('Half Day')}</span>
                      )}
                    </td>
                    <td className="py-5 text-center">
                      <p className="text-[13px] font-black text-slate-800 tracking-tight">
                        {leave.days} <span className="text-[10px] text-slate-400 uppercase">{t('Days')}</span>
                      </p>
                    </td>
                    <td className="py-5 text-[11px] font-bold text-slate-500">
                      {new Date(leave.applied_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-5 max-w-[200px] truncate">
                      <p className="text-[11px] text-slate-600 font-bold truncate" title={leave.reason}>
                        {leave.reason || <span className="text-slate-300 italic uppercase">{t('No Reason Stated')}</span>}
                      </p>
                    </td>
                    <td className="py-5 pr-8 text-right">
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-2 border ${
                        leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        leave.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        leave.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          leave.status === 'Approved' ? 'bg-emerald-500' : 
                          leave.status === 'Pending' ? 'bg-amber-500' : 
                          leave.status === 'Rejected' ? 'bg-rose-500' : 'bg-slate-400'
                        }`}></div>
                        {t(leave.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Calendar size={40} className="text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('No leaves found for this selection')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyLeaves;
