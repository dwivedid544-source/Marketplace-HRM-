import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  TrendingUp, 
  Award, 
  CalendarCheck, 
  CheckSquare, 
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const MyKPI = () => {
  const { t } = useSettings();
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyKPI();
  }, []);

  const fetchMyKPI = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kpis/my');
      setKpi(response.data);
    } catch (err) {
      console.error('Error fetching employee KPI:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRatingStyle = (rating) => {
    switch (rating) {
      case 'Excellent':
        return { bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
      case 'Good':
        return { bg: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500', bar: 'bg-blue-500' };
      case 'Average':
        return { bg: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500', bar: 'bg-amber-500' };
      case 'Needs Improvement':
        return { bg: 'bg-rose-50 text-rose-600 border-rose-100', dot: 'bg-rose-500', bar: 'bg-rose-500' };
      default:
        return { bg: 'bg-slate-100 text-slate-400 border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' };
    }
  };

  const getPerformanceMessage = (rating) => {
    switch (rating) {
      case 'Excellent':
        return 'Outstanding contribution! You consistently exceed performance standards and set a high benchmark for operational excellence. Keep up the brilliant work!';
      case 'Good':
        return 'Solid execution! You perform at a high standard, meet all core benchmarks on time, and display excellent compliance with attendance requirements.';
      case 'Average':
        return 'Steady output. You meet the minimum expectations for your operational scope, but have opportunities to improve task completion speeds and attendance consistency.';
      case 'Needs Improvement':
        return 'Action required. Your performance score is below the operational baseline. Please review task management and coordinate with administration for alignment support.';
      default:
        return 'Data is currently being compiled by the administration department.';
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-20 bg-white border border-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Querying KPI metrics...')}</p>
      </div>
    );
  }

  const ratingStyle = getRatingStyle(kpi?.rating);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('My Performance')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Review performance metrics, score cards, and operational clearance rating')}
          </p>
        </div>
      </div>

      {/* Main Score Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Overall Score Card */}
        <div className="card bg-slate-900 border-none text-white shadow-xl py-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">{t('Overall Index')}</span>
              <Award size={18} className="text-indigo-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-5xl font-black text-white tracking-tighter">
                {kpi?.overall_score || 0}%
              </h2>
              <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider inline-block ${ratingStyle.bg}`}>
                {t(kpi?.rating)} {t('Rating')}
              </span>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 relative z-10 flex items-start gap-2.5 bg-white/5 p-3 rounded-xl border border-white/5">
            <HelpCircle size={16} className="text-indigo-300 shrink-0 mt-0.5" />
            <p className="text-[8px] font-bold text-slate-400 uppercase leading-normal">
              Overall score is computed client-side based on combined attendance consistency (50%) and task execution indices (50%).
            </p>
          </div>
        </div>

        {/* Attendance Score Card */}
        <div className="card bg-white shadow-sm border border-slate-100 flex flex-col justify-between py-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Attendance Score')}</span>
              <CalendarCheck size={18} className="text-emerald-500" />
            </div>
            
            <div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                {kpi?.attendance_score || 0}%
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">{t('Punch compliance rate')}</p>
            </div>
            
            {/* Visual Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${kpi?.attendance_score || 0}%` }}></div>
            </div>
          </div>

          <p className="text-[8px] font-bold text-slate-400 mt-6 uppercase">{t('Tracks attendance timing and punch deviations')}</p>
        </div>

        {/* Task Score Card */}
        <div className="card bg-white shadow-sm border border-slate-100 flex flex-col justify-between py-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Task Score')}</span>
              <CheckSquare size={18} className="text-indigo-500" />
            </div>
            
            <div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">
                {kpi?.task_score || 0}%
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1">{t('Task completion speed')}</p>
            </div>

            {/* Visual Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${kpi?.task_score || 0}%` }}></div>
            </div>
          </div>

          <p className="text-[8px] font-bold text-slate-400 mt-6 uppercase">{t('Evaluates task counts completed vs assigned')}</p>
        </div>

      </div>

      {/* Performance Summary section */}
      <div className="card bg-white shadow-sm border border-slate-100 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('Performance Evaluation Summary')}</h3>
          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">{t('Qualitative feedback report for the current cycle')}</p>
        </div>

        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Badge Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${ratingStyle.bg}`}>
            <Award size={28} />
          </div>

          {/* Feedback details */}
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <h4 className="text-[12px] font-black uppercase text-slate-800">
                {t('Evaluation Clearance Status:')} <span className={kpi?.rating === 'Needs Improvement' ? 'text-rose-600' : 'text-emerald-600'}>{t(kpi?.rating)}</span>
              </h4>
              <p className="text-xs font-bold text-slate-600 leading-relaxed">
                {getPerformanceMessage(kpi?.rating)}
              </p>
            </div>

            {/* Quick Goals checklist */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-1">{t('Operational Targets checklist')}</span>
              
              <div className="flex items-center gap-2.5 text-[10px] text-slate-700 font-bold">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{t('Attendance punch compliance (Target: >90% - MET)')}</span>
              </div>
              
              <div className="flex items-center gap-2.5 text-[10px] text-slate-700 font-bold">
                {(kpi?.task_score || 0) >= 80 ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0 ml-1.5 mr-1.5"></div>
                )}
                <span>Task SLA speed indexes (Target: &gt;80% - {(kpi?.task_score || 0) >= 80 ? 'MET' : 'PENDING'})</span>
              </div>

              <div className="flex items-center gap-2.5 text-[10px] text-slate-700 font-bold">
                {(kpi?.overall_score || 0) >= 80 ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0 ml-1.5 mr-1.5"></div>
                )}
                <span>Overall rating clearance index (Target: Good/Excellent - {(kpi?.overall_score || 0) >= 80 ? 'MET' : 'PENDING'})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyKPI;
