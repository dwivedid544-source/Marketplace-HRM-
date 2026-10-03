import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Activity,
  FileText,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  Eye,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AuditLogs = () => {
  const { t } = useSettings();
  const { showAlert } = useUI();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, total: 0, topActions: [] });
  const [availableActions, setAvailableActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get('/audit-logs/stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        ...(search && { search }),
        ...(selectedAction !== 'ALL' && { action: selectedAction }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      };

      const res = await api.get('/audit-logs', { params });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setAvailableActions(res.data.availableActions || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      showAlert('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, selectedAction, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedAction('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const getActionBadgeColor = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('APPROVE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CHANGE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('DELETE') || act.includes('REJECT') || act.includes('REMOVE') || act.includes('RESET')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (act.includes('PAYROLL') || act.includes('PAYMENT')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    return 'bg-sky-50 text-sky-700 border-sky-200';
  };

  const parseDetailsObj = (details) => {
    if (!details) return null;
    if (typeof details === 'object') return details;
    if (typeof details === 'string') {
      try {
        return JSON.parse(details);
      } catch (e) {
        return details;
      }
    }
    return details;
  };

  const renderDetailsSnippet = (details, action = '') => {
    const data = parseDetailsObj(details);
    if (!data) return <span className="text-slate-400 font-semibold text-xs">—</span>;

    if (typeof data !== 'object') {
      return <span className="text-xs font-semibold text-slate-700">{String(data)}</span>;
    }

    // 1. Direct Messages & Announcements
    if (data.subject || data.channels || data.target_audience || data.recipients !== undefined) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {data.subject && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs max-w-[220px]"
              title={data.subject}
            >
              <span className="text-[13px] shrink-0">💬</span>
              <span className="truncate">{data.subject}</span>
            </span>
          )}
          {data.channels && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                data.channels === 'whatsapp'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : data.channels === 'email'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'
              }`}
            >
              {data.channels === 'both' ? 'WA + Email' : data.channels === 'whatsapp' ? 'WhatsApp' : 'Email'}
            </span>
          )}
          {data.recipients !== undefined && (
            <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
              👥 {data.recipients} {data.recipients === 1 ? 'recipient' : 'recipients'}
            </span>
          )}
          {data.target_audience && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
              {data.target_audience}
            </span>
          )}
        </div>
      );
    }

    // 2. Attendance & Punches
    if (data.date || data.status || data.punch_in || data.punch_out) {
      const isPresent = data.status?.toLowerCase() === 'present';
      const isAbsent = data.status?.toLowerCase() === 'absent';
      const isHalfDay = data.status?.toLowerCase()?.includes('half');
      return (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {data.date && (
            <span className="text-xs font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200 inline-flex items-center gap-1">
              📅 {data.date}
            </span>
          )}
          {data.status && (
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                isPresent
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isAbsent
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isHalfDay
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {data.status}
            </span>
          )}
          {data.punch_in && (
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              In: {data.punch_in}
            </span>
          )}
          {data.punch_out && (
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              Out: {data.punch_out}
            </span>
          )}
        </div>
      );
    }

    // 3. Leave Applications & Approvals
    if (data.leave_type || data.days || data.reason || data.leave_id) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {data.leave_type && (
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 text-[10px] font-black uppercase">
              {data.leave_type}
            </span>
          )}
          {data.days && (
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
              {data.days} {Number(data.days) === 1 ? 'Day' : 'Days'}
            </span>
          )}
          {data.status && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {data.status}
            </span>
          )}
          {data.reason && (
            <span className="text-xs text-slate-500 italic truncate max-w-[160px]" title={data.reason}>
              "{data.reason}"
            </span>
          )}
        </div>
      );
    }

    // 4. Payroll & Salary
    if (data.month || data.year || data.net_salary || data.gross_salary || data.amount) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 py-0.5">
          {(data.month || data.year) && (
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
              🗓️ {[data.month, data.year].filter(Boolean).join(' ')}
            </span>
          )}
          {(data.net_salary || data.amount) && (
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              ₹{(data.net_salary || data.amount).toLocaleString()}
            </span>
          )}
          {data.status && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {data.status}
            </span>
          )}
        </div>
      );
    }

    // 5. Generic Key-Value formatting for any other JSON objects
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-slate-400 font-semibold text-xs">—</span>;

    return (
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        {entries.slice(0, 3).map(([k, v]) => {
          const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
          return (
            <span
              key={k}
              className="bg-slate-100/90 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md text-[11px] inline-flex items-center gap-1 shadow-2xs"
            >
              <span className="font-bold text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
              <span className="font-bold text-slate-800 truncate max-w-[120px]" title={valStr}>
                {valStr}
              </span>
            </span>
          );
        })}
        {entries.length > 3 && (
          <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
            +{entries.length - 3} more
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                {t('Company Audit Trail')}
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                {t('Real-time security log of all administrative actions and data modifications.')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStats();
              fetchLogs();
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{t('Refresh')}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t("Today's Events")}
              </p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {statsLoading ? '...' : stats.today}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t('Last 7 Days')}
              </p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {statsLoading ? '...' : stats.thisWeek}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity size={18} />
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {t('Total Audit Records')}
              </p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {statsLoading ? '...' : stats.total}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card p-4 border border-slate-100 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('Search by user, action, details...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Action Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              <option value="ALL">{t('All Action Types')}</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="Start Date"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="End Date"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Reset button */}
          <div className="md:col-span-1 flex items-center">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full py-2.5 text-center text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              {t('Reset')}
            </button>
          </div>
        </form>
      </div>

      {/* Logs Table */}
      <div className="card !p-0 overflow-hidden border border-slate-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Performer / Admin')}</th>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Action')}</th>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Target ID')}</th>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Details')}</th>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Date & Time')}</th>
                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('View')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center p-12 text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                    <span className="text-xs font-bold">{t('Loading audit logs...')}</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-12 text-slate-400">
                    <ShieldAlert size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">{t('No audit records found.')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('Try adjusting your search query or filters.')}</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Performer */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                          {log.admin_photo ? (
                            <img src={log.admin_photo} alt={log.admin_name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 leading-tight">{log.admin_name || 'System / Auto'}</p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{log.admin_email || log.admin_role || 'system'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Target ID */}
                    <td className="p-4 text-xs font-bold text-slate-600">
                      {log.target_id ? `#${log.target_id}` : '—'}
                    </td>

                    {/* Details Snippet */}
                    <td className="p-4 max-w-md">
                      {renderDetailsSnippet(log.details, log.action)}
                    </td>

                    {/* Timestamp */}
                    <td className="p-4 whitespace-nowrap text-xs font-semibold text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    {/* View Details Button */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title={t('View Full Event Details')}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs font-bold text-slate-500">
              {t('Showing page')} {pagination.page} {t('of')} {pagination.totalPages} ({pagination.total} {t('records')})
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLog && (() => {
          const parsedDetails = parseDetailsObj(selectedLog.details);
          const isObj = parsedDetails && typeof parsedDetails === 'object';
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800">{t('Audit Event Details')}</h3>
                      <p className="text-[10px] font-semibold text-slate-400">ID #{selectedLog.id} • {new Date(selectedLog.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('Performer')}</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{selectedLog.admin_name || 'System'}</p>
                      <p className="text-[10px] font-medium text-slate-500">{selectedLog.admin_email || 'N/A'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('Action & Target')}</p>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">{selectedLog.action}</p>
                      <p className="text-[10px] font-medium text-slate-500">Target ID: {selectedLog.target_id || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Formatted Attributes */}
                  {isObj && Object.keys(parsedDetails).length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{t('Structured Event Data')}</p>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                        {Object.entries(parsedDetails).map(([key, val]) => (
                          <div key={key} className="bg-white p-2.5 rounded-lg border border-slate-200/70 shadow-2xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-bold text-slate-800 mt-0.5 block break-words">
                              {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{t('Raw Event Payload')}</p>
                    <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                      {typeof selectedLog.details === 'object'
                        ? JSON.stringify(selectedLog.details, null, 2)
                        : (selectedLog.details || 'No additional payload.')}
                    </pre>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    {t('Close')}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};

export default AuditLogs;
