import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  TrendingUp, 
  Search, 
  Award, 
  Filter, 
  Eye, 
  X,
  User,
  Users,
  Briefcase,
  CalendarCheck,
  CheckSquare,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';

const KPIManagement = () => {
  const { showConfirm, showAlert } = useUI();
  const { t } = useSettings();
  const [kpis, setKpis] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [selectedKpi, setSelectedKpi] = useState(null); // for Details Modal
  
  // Evaluation Form State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const getCurrentQ = () => `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`;
  const [evalForm, setEvalForm] = useState({ employee_id: '', task_score: '', review_period: getCurrentQ() });
  const [submitting, setSubmitting] = useState(false);

  const getNextReviewPeriod = (empId) => {
    const currentQ = getCurrentQ();
    if (!empId) return currentQ;
    const empKpis = kpis.filter(k => k.employee_id == empId);
    if (empKpis.length === 0) return currentQ;
    
    const latest = [...empKpis].sort((a, b) => b.id - a.id)[0];
    const match = latest.review_period?.match(/Q([1-4])\s+(\d{4})/i);
    
    if (match) {
      let q = parseInt(match[1]);
      let y = parseInt(match[2]);
      if (q === 4) { q = 1; y += 1; }
      else { q += 1; }
      return `Q${q} ${y}`;
    }
    return currentQ;
  };

  useEffect(() => {
    fetchKPIs();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/kpis');
      setKpis(response.data);
    } catch (err) {
      console.error('Error fetching KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateSubmit = async (e) => {
    e.preventDefault();
    if (!evalForm.employee_id || !evalForm.task_score) return;
    
    try {
      setSubmitting(true);
      // If updating existing (has id), use PUT. If creating new, use POST.
      if (evalForm.id) {
        await api.put(`/kpis/${evalForm.id}`, evalForm);
      } else {
        await api.post('/kpis', evalForm);
      }
      await fetchKPIs();
      setIsEvaluating(false);
      setEvalForm({ employee_id: '', task_score: '', review_period: getCurrentQ() });
    } catch (err) {
      console.error('Error saving KPI:', err);
      showAlert('Failed to save evaluation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteKpi = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Evaluation',
      message: 'Are you sure you want to delete this evaluation? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;
    
    try {
      await api.delete(`/kpis/${id}`);
      showAlert('Evaluation deleted successfully', 'success');
      await fetchKPIs();
    } catch (err) {
      console.error('Error deleting KPI:', err);
      showAlert('Failed to delete KPI record.', 'error');
    }
  };

  const getRatingStyle = (rating) => {
    switch (rating) {
      case 'High':
        return { bg: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
      case 'Average':
        return { bg: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500', bar: 'bg-blue-500' };
      case 'Low':
        return { bg: 'bg-rose-50 text-rose-600 border-rose-100', dot: 'bg-rose-500', bar: 'bg-rose-500' };
      default:
        return { bg: 'bg-slate-100 text-slate-400 border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' };
    }
  };

  // Card summary calculations
  const stats = {
    total: kpis.length,
    high: kpis.filter(k => k.overall_score >= 75).length,
    average: kpis.filter(k => k.overall_score >= 50 && k.overall_score < 75).length,
    low: kpis.filter(k => k.overall_score < 50).length,
  };

  // Filtering list
  const filteredKpis = kpis.filter(k => {
    const matchesSearch = k.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(k.employee_id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRating = ratingFilter === 'All' || k.rating === ratingFilter;
    return matchesSearch && matchesRating;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('Performance KPI Matrix')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Monitor company performance indexes, operational ratings, and task clearance compliance')}
          </p>
        </div>
        <button
          onClick={() => {
            setEvalForm({ employee_id: '', task_score: '', review_period: 'Q1 2026' });
            setIsEvaluating(true);
          }}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Award size={16} />
          {t('Evaluate Employee')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Employees */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Total Staff Mapped')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.total}</h3>
          </div>
        </div>

        {/* High Performers */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('High Performers')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.high}</h3>
          </div>
        </div>

        {/* Average Performers */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shadow-sm shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Average Performers')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.average}</h3>
          </div>
        </div>

        {/* Low Performers */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 shadow-sm shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Low Performers')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.low}</h3>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
        
        {/* Table Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative">
            <input
              type="text"
              placeholder={t('Search Employee name...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary w-60"
            />
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto overflow-hidden">
            {/* Filter by Status Rating */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full scrollbar-none shrink-0 whitespace-nowrap">
              <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider shrink-0">{t('Rating:')}</span>
              {['All', 'High', 'Average', 'Low'].map((rating) => (
                <button
                  key={rating}
                  onClick={() => setRatingFilter(rating)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shrink-0 ${
                    ratingFilter === rating 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t(rating)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 pl-8 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Employee Name')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Period')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Attendance')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Task Score')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Overall score')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Rating Status')}</th>
                <th className="py-4 pr-8 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Synchronizing KPIs...')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredKpis.length > 0 ? (
                filteredKpis.map((kpi, idx) => {
                  const rStyle = getRatingStyle(kpi.rating);
                  return (
                    <tr key={kpi.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-[12px] uppercase tracking-tight">{kpi.employee_name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{kpi.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{kpi.review_period}</p>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-[12px] font-bold text-slate-700">{kpi.attendance_score}%</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-[12px] font-bold text-slate-700">{kpi.task_score}%</span>
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-[13px] font-black text-primary bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">{kpi.overall_score}%</span>
                      </td>
                      <td className="py-4">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1.5 border ${rStyle.bg}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${rStyle.dot}`}></div>
                          {kpi.rating}
                        </span>
                      </td>
                      <td className="py-4 pr-8 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setSelectedKpi(kpi)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                            title="View KPI Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEvalForm({
                                id: kpi.id,
                                employee_id: kpi.employee_id,
                                task_score: kpi.task_score,
                                review_period: kpi.review_period || 'Q1 2026',
                                attendance_score: kpi.attendance_score,
                                overall_score: kpi.overall_score,
                                rating: kpi.rating
                              });
                              setIsEvaluating(true);
                            }}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-primary transition-colors"
                            title="Edit KPI"
                          >
                            <TrendingUp size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteKpi(kpi.id)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-rose-500 transition-colors"
                            title="Delete KPI"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <TrendingUp size={40} className="text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('No Performance Records Found')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* View Details Modal */}
      <AnimatePresence>
        {selectedKpi && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6 text-left"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">{t('Performance Review & Rating')}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ID: {selectedKpi.employee_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedKpi(null)}
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5 text-xs font-bold text-slate-700">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Employee Name')}</p>
                    <p className="text-[13px] font-black text-slate-800 mt-0.5">{selectedKpi.employee_name}</p>
                  </div>
                </div>

                {/* Score Indicators */}
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {/* Attendance Score */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                      <div className="flex items-center gap-1">
                        <CalendarCheck size={14} className="text-emerald-500" />
                        <span>{t('Attendance Score')}</span>
                      </div>
                      <span className="text-slate-800">{selectedKpi.attendance_score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${selectedKpi.attendance_score}%` }}></div>
                    </div>
                  </div>

                  {/* Task Score */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                      <div className="flex items-center gap-1">
                        <CheckSquare size={14} className="text-indigo-500" />
                        <span>{t('Task Score')}</span>
                      </div>
                      <span className="text-slate-800">{selectedKpi.task_score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${selectedKpi.task_score}%` }}></div>
                    </div>
                  </div>

                  {/* Overall Score Gauge Box */}
                  <div className="border-t border-slate-100 pt-4 mt-2 bg-slate-50 p-4 rounded-2xl flex items-center justify-between border">
                    <div>
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Overall score')}</p>
                      <h2 className="text-3xl font-black text-slate-800 tracking-tighter mt-0.5">{selectedKpi.overall_score}%</h2>
                    </div>

                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Rating Status')}</p>
                      <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1 border mt-1 ${
                        getRatingStyle(selectedKpi.rating).bg
                      }`}>
                        {t(selectedKpi.rating)}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedKpi(null)}
                  className="w-full py-2.5 bg-slate-100 rounded-xl text-center text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {t('Close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Evaluation Modal */}
        {isEvaluating && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-[420px] w-full shadow-2xl border border-slate-100 space-y-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">
                    {evalForm.id ? t('Edit') + ' ' + t('Evaluate Employee') : t('Evaluate Employee')}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {evalForm.id ? t('Task Score') : t('Quarterly Performance')}
                  </p>
                </div>
                <button 
                  onClick={() => setIsEvaluating(false)}
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEvaluateSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('Select Employee to Evaluate')}</label>
                  <select 
                    required
                    disabled={!!evalForm.id}
                    value={evalForm.employee_id}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setEvalForm({...evalForm, employee_id: empId, review_period: getNextReviewPeriod(empId)});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary disabled:opacity-50 transition-colors"
                  >
                    <option value="">-- {t('Select Employee to Evaluate')} --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('Quarter / Evaluation Period')}</label>
                  <input 
                    type="text"
                    required
                    value={evalForm.review_period}
                    onChange={(e) => setEvalForm({...evalForm, review_period: e.target.value})}
                    placeholder="e.g., Q1 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                    <span>{t('Employee Task Clearance Score (0-100)')}</span>
                    <span className="text-primary">{evalForm.task_score || 0}%</span>
                  </label>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    required
                    value={evalForm.task_score}
                    onChange={(e) => setEvalForm({...evalForm, task_score: e.target.value})}
                    className="w-full accent-primary"
                  />
                </div>

                {evalForm.id && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 font-bold">
                    <p>{t('Attendance Score')}: <span className="text-primary">{evalForm.attendance_score}%</span></p>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEvaluating(false)}
                    className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-70 cursor-pointer"
                  >
                    {submitting ? t('Saving Evaluation...') : t('Save Changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KPIManagement;
