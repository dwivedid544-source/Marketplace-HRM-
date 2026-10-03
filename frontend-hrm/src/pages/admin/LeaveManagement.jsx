import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Eye,
  User,
  ArrowRight,
  Download,
  AlertCircle
} from 'lucide-react';
import { Calendar as CalendarComponent } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';

const LeaveManagement = () => {
  const { showAlert } = useUI();
  const { t } = useSettings();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'calendar'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeave, setSelectedLeave] = useState(null); // for view details modal
  const [showClearConfirm, setShowClearConfirm] = useState(false); // for clear history confirm
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    fetchLeaves();
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const response = await api.get('/attendance/holidays');
      if (response.data && Array.isArray(response.data)) {
        setHolidays(response.data);
      }
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await api.get('/leaves');
      setLeaves(response.data);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await api.put(`/leaves/${id}`, { status });
      setSuccessMsg(`Leave request successfully marked as ${status}!`);
      // Refresh local lists
      fetchLeaves();
      if (selectedLeave && selectedLeave.id === id) {
        setSelectedLeave({ ...selectedLeave, status });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setErrorMsg('Failed to update leave request status.');
    }
  };

  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  const executeClearHistory = async () => {
    try {
      await api.delete('/leaves/clear');
      setSuccessMsg('Leave history cleared successfully!');
      fetchLeaves();
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Error clearing leave history:', err);
      setErrorMsg('Failed to clear leave history.');
      setShowClearConfirm(false);
    }
  };

  // Stats calculations
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'Pending').length,
    approved: leaves.filter(l => l.status === 'Approved').length,
    rejected: leaves.filter(l => l.status === 'Rejected').length,
  };

  // Filtering Table Requests
  const filteredRequests = leaves.filter(l => {
    const matchesSearch = l.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (l.reason && l.reason.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay(); // 0 = Sunday, 1 = Monday...

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const generateCalendarCells = () => {
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    const cells = [];

    // Previous month filler days
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateString: new Date(year, month - 1, prevMonthDays - i).toISOString().split('T')[0]
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      // Create local date string in YYYY-MM-DD
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        day: i,
        isCurrentMonth: true,
        dateString: dateStr
      });
    }

    // Next month filler days (to make full grid of 6 weeks = 42 cells)
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateString: new Date(year, month + 1, i).toISOString().split('T')[0]
      });
    }

    return cells;
  };

  // Get active leaves for a date
  const getLeavesForDate = (dateStr) => {
    const targetDate = new Date(dateStr);
    targetDate.setHours(0,0,0,0);

    return leaves.filter(leave => {
      const start = new Date(leave.start_date);
      start.setHours(0,0,0,0);
      const end = new Date(leave.end_date);
      end.setHours(0,0,0,0);
      return targetDate >= start && targetDate <= end;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('Leave Administration')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Authorize employee time-off requests and review schedule conflicts')}
          </p>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-wide">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600"><XCircle size={16} /></button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-rose-500" />
            <p className="text-[11px] text-rose-600 font-bold uppercase tracking-wide">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-rose-600"><XCircle size={16} /></button>
        </div>
      )}

      {/* Overview Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Total Requests')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.total}</h3>
          </div>
        </div>

        {/* Pending */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 shadow-sm shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Pending Action')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.pending}</h3>
          </div>
        </div>

        {/* Approved */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Approved Requests')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.approved}</h3>
          </div>
        </div>

        {/* Rejected */}
        <div className="card flex items-center gap-4 py-5 bg-white shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600 shadow-sm shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Rejected Requests')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.rejected}</h3>
          </div>
        </div>
      </div>

      {/* Main Panel Card */}
      <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
        {/* Toggle navigation tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'requests' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('Requests Table')}
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'calendar' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t('Leave Calendar')}
            </button>
          </div>

          {activeTab === 'requests' ? (
            /* Search and Filter actions */
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('Search Employee / Reason...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary w-60"
                />
                <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider">{t('Filter')}:</span>
                {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      statusFilter === status 
                        ? 'bg-white text-primary shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t(status)}
                  </button>
                ))}
              </div>

              <button
                onClick={handleClearHistory}
                className="px-4 py-2 ml-auto bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <AlertCircle size={14} /> {t('Clear History')}
              </button>
            </div>
          ) : (
            /* Calendar Header arrows */
            <div className="flex items-center gap-4">
              <button 
                onClick={handlePrevMonth}
                className="p-2 bg-white rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-100"
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest w-36 text-center">
                {monthsList[month]} {year}
              </h3>
              <button 
                onClick={handleNextMonth}
                className="p-2 bg-white rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-100"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Rendering */}
        {activeTab === 'requests' ? (
          /* TABLE VIEW */
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 pl-8 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Employee Name')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Dates')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Days')}</th>
                  <th className="py-4 pl-12 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Status')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Reason')}</th>
                  <th className="py-4 pr-8 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Synchronizing Registry...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRequests.length > 0 ? (
                  filteredRequests.map((leave, idx) => (
                    <tr key={leave.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="py-5 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                            <User size={16} />
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-[12px] uppercase tracking-tight">{leave.employee_name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{leave.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <span>{new Date(leave.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                          <ArrowRight size={10} className="text-slate-400" />
                          <span>{new Date(leave.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                        </div>
                        {leave.half_day === 1 && (
                          <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider mt-0.5 inline-block">Half Day</span>
                        )}
                      </td>
                      <td className="py-5 text-center">
                        <p className="text-[12px] font-black text-slate-800">{Number(leave.days)}d</p>
                      </td>
                      <td className="py-5 pl-12">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1.5 border ${
                          leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          leave.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                          leave.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${
                            leave.status === 'Approved' ? 'bg-emerald-500' : 
                            leave.status === 'Pending' ? 'bg-amber-500' : 
                            leave.status === 'Rejected' ? 'bg-rose-500' : 'bg-slate-400'
                          }`}></div>
                          {leave.status}
                        </span>
                      </td>
                      <td className="py-5 max-w-[200px] truncate">
                        <p className="text-[11px] text-slate-600 font-bold truncate" title={leave.reason}>
                          {leave.reason || <span className="text-slate-300 italic uppercase">No Reason Stated</span>}
                        </p>
                      </td>
                      <td className="py-5 pr-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {leave.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Approved')}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Rejected')}
                                className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-rose-600 shadow-sm shadow-rose-500/20 transition-colors flex items-center gap-1"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                          {leave.status === 'Approved' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Rejected')}
                                className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-rose-100 transition-colors flex items-center gap-1"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Pending')}
                                className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors flex items-center gap-1"
                              >
                                <Clock size={12} /> Revert
                              </button>
                            </>
                          )}
                          {leave.status === 'Rejected' && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Approved')}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-colors flex items-center gap-1"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(leave.id, 'Pending')}
                                className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors flex items-center gap-1"
                              >
                                <Clock size={12} /> Revert
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-30">
                        <Calendar size={40} className="text-slate-400" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No requests pending approval</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* CALENDAR VIEW */
          <div className="p-6">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
              {generateCalendarCells().map((cell, idx) => {
                const dateLeaves = getLeavesForDate(cell.dateString);
                const isHoliday = holidays.find(h => new Date(h.holiday_date).toISOString().split('T')[0] === cell.dateString);
                return (
                  <div
                    key={idx}
                    className={`min-h-[60px] sm:min-h-[100px] border rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 flex flex-col justify-between transition-all ${
                      cell.isCurrentMonth 
                        ? 'bg-white border-slate-100 shadow-sm hover:border-slate-300' 
                        : 'bg-slate-50/50 border-slate-100/50 text-slate-300 pointer-events-none'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${
                        cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        {cell.day}
                      </span>
                      {dateLeaves.length > 0 && cell.isCurrentMonth && (
                        <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase">
                          {dateLeaves.length} {dateLeaves.length === 1 ? 'Out' : 'Staff'}
                        </span>
                      )}
                    </div>

                    {/* Overlay pills for active leaves */}
                    <div className="space-y-1 mt-2 overflow-y-auto max-h-[64px] custom-scrollbar">
                      {cell.isCurrentMonth && isHoliday && (
                        <div className="px-1.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 mb-1 flex flex-col gap-0.5" title={isHoliday.holiday_name}>
                          <span className="text-[7px] font-black uppercase opacity-60 leading-none">★ Holiday</span>
                          <span className="text-[8px] font-bold truncate leading-none">{isHoliday.holiday_name}</span>
                        </div>
                      )}
                      {cell.isCurrentMonth && dateLeaves.map((leave, lIdx) => (
                        <div
                          key={leave.id || lIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeave(leave);
                          }}
                          className={`text-[8px] font-black px-1.5 py-1 rounded-lg truncate cursor-pointer transition-all border ${
                            leave.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                              : leave.status === 'Rejected'
                                ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100 border-dashed hover:bg-amber-100'
                          }`}
                          title={`${leave.employee_name} - ${leave.leave_type} (${leave.status})`}
                        >
                          <span className="capitalize">{leave.employee_name.split(' ')[0]}</span> ({leave.leave_type.replace(' Leave', '')[0]})
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* View Details Drawer/Modal */}
      <AnimatePresence>
        {selectedLeave && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 space-y-4 mx-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <FileText size={16} />
                  </div>
                  <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wide">Leave Reason</h3>
                </div>
                <button 
                  onClick={() => setSelectedLeave(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="text-xs font-bold text-slate-700">
                <p className="text-[12px] text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-bold min-h-[80px]">
                  {selectedLeave.reason || 'No description provided.'}
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedLeave(null)}
                  className="w-full py-3 bg-slate-100 rounded-xl text-center text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clear History Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-80 max-w-[90vw] shadow-2xl border border-slate-100 space-y-5 mx-auto flex flex-col"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-1">
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">Clear Leave History?</h3>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed px-1">
                  Are you sure you want to clear all Approved and Rejected leave history? <span className="text-rose-500 block mt-1">This action cannot be undone.</span>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="w-full py-3 bg-slate-100 rounded-xl text-center text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeClearHistory}
                  className="w-full py-3 bg-rose-500 text-white rounded-xl text-center text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
                >
                  Yes, Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaveManagement;
