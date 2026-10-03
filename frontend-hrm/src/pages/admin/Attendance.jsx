import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import {
  Calendar,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  X,
  MapPin,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';

const Attendance = () => {
  const { showAlert, showConfirm } = useUI();
  const { t } = useSettings();
  const formatForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return localDate.toISOString().slice(0, 16);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    return days;
  };

  const [view, setView] = useState('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDateRange, setIsDateRange] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [dailyLogs, setDailyLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [manualData, setManualData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    inTime: '08:00',
    outTime: '17:00',
    status: 'present'
  });
  const [bulkData, setBulkData] = useState({
    employeeIds: [],
    date: new Date().toISOString().split('T')[0],
    inTime: '08:00',
    outTime: '',
    status: 'present'
  });
  const [holidays, setHolidays] = useState([]);
  const [bulkSearch, setBulkSearch] = useState('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isDateRange || (isDateRange && dateRange.start && dateRange.end)) {
      fetchAttendance();
    }
    fetchEmployees();
    fetchHolidays();
    fetchSettings();
  }, [currentDate, isDateRange, dateRange]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    if (showManualModal && manualData.employeeId && manualData.date) {
      const log = dailyLogs.find(l => l.employee_id == manualData.employeeId && l.date === manualData.date);
      let inTime = settings?.standard_start_time?.substring(0, 5) || '09:00';
      let outTime = settings?.standard_end_time?.substring(0, 5) || '17:00';
      let status = 'present';

      if (log) {
        status = log.status || 'present';
        if (log.in_time) {
          const d = new Date(log.in_time);
          inTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        if (log.out_time) {
          const d = new Date(log.out_time);
          outTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else {
          // If they punched in but not out, keep standard out time
        }
      }
      
      setManualData(prev => ({ ...prev, inTime, outTime, status }));
    }
  }, [manualData.employeeId, manualData.date, showManualModal, dailyLogs, settings]);

  const fetchHolidays = async () => {
    try {
      const response = await api.get('/attendance/holidays');
      setHolidays(response.data);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (isDateRange && dateRange.start && dateRange.end) {
        params.date_from = dateRange.start;
        params.date_to = dateRange.end;
      } else {
        params.date = currentDate.toISOString().split('T')[0];
      }
      const response = await api.get('/attendance', { params });
      setDailyLogs(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/attendance/manual', manualData);
      setShowManualModal(false);
      fetchAttendance();
      showAlert('Manual attendance added successfully!', 'success');
    } catch (err) {
      console.error('Error adding manual attendance:', err);
      showAlert('Failed to add manual attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/attendance/bulk', bulkData);
      setShowBulkModal(false);
      fetchAttendance();
      showAlert('Bulk attendance updated successfully', 'success');
    } catch (err) {
      console.error('Error in bulk attendance:', err);
      showAlert('Failed to update bulk attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAttendance = async () => {
    try {
      setLoading(true);
      await api.put(`/attendance/${selectedLog.id}`, selectedLog);
      setIsEditing(false);
      setShowDetailModal(false);
      fetchAttendance();
    } catch (err) {
      console.error('Error updating attendance:', err);
      showAlert('Update failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (employees.length === 0) return showAlert('No employees found to export', 'warning');

    const escapeCSV = (val) => {
      const str = String(val ?? '---');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvRows = [];
    let filename = '';

    if (isDateRange && dateRange.start && dateRange.end) {
      // DATE RANGE MODE: one row per employee with summary
      const headers = ['Employee Name', 'Employee ID', 'Present Days', 'Late Days', 'Half Days', 'Total Present', 'Total Hours', 'Date Range'];
      csvRows.push(headers.map(escapeCSV).join(','));

      employees.forEach(emp => {
        const logs = dailyLogs.filter(l => l.employee_id === emp.id);
        const present = logs.filter(l => l.status?.toLowerCase() === 'present').length;
        const late = logs.filter(l => l.status?.toLowerCase() === 'late').length;
        const half = logs.filter(l => l.status?.toLowerCase() === 'half_day').length;
        const totalPresentDays = present + late + (half * 0.5);
        const totalHours = logs.reduce((acc, l) => acc + parseFloat(l.total_hours || 0), 0).toFixed(2);

        csvRows.push([
          escapeCSV(emp.name),
          escapeCSV(emp.custom_id || emp.id),
          present,
          late,
          half,
          totalPresentDays,
          totalHours,
          escapeCSV(`${dateRange.start} to ${dateRange.end}`)
        ].join(','));
      });

      filename = `Attendance_${dateRange.start}_to_${dateRange.end}.csv`;
    } else {
      // SINGLE DAY MODE: one row per employee with punch details
      const dateStr = currentDate.toISOString().split('T')[0];
      const headers = ['Employee Name', 'Employee ID', 'Date', 'Status', 'Check-In', 'Check-Out', 'Working Hours'];
      csvRows.push(headers.map(escapeCSV).join(','));

      employees.forEach(emp => {
        const log = dailyLogs.find(l => l.employee_id === emp.id);
        const status = log ? (log.status || 'Present') : 'Absent';
        const inTime = log?.in_time ? new Date(log.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---';
        const outTime = log?.out_time ? new Date(log.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---';
        const hours = log ? (parseFloat(log.total_hours || 0).toFixed(2)) : '0.00';

        csvRows.push([
          escapeCSV(emp.name),
          escapeCSV(emp.custom_id || emp.id),
          escapeCSV(dateStr),
          escapeCSV(status),
          escapeCSV(inTime),
          escapeCSV(outTime),
          hours
        ].join(','));
      });

      filename = `Attendance_${dateStr}.csv`;
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('Attendance report exported successfully!', 'success');
  };

  const handlePrevDate = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNextDate = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setIsEditing(false);
    setShowDetailModal(true);
  };

  const filteredLogs = dailyLogs.filter(log =>
    (log.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.employee_id?.toString().includes(searchQuery)
  );

  const expectedDays = isDateRange && dateRange.start && dateRange.end ? (() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    let count = 0;
    let cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  })() : ((currentDate.getDay() !== 0 && currentDate.getDay() !== 6) ? 1 : 0);

  const totalExpected = expectedDays * employees.length;
  const presentLogs = dailyLogs.filter(l => l.status?.toLowerCase() === 'present' || l.status?.toLowerCase() === 'late');
  const validAttendanceLogs = dailyLogs.filter(l => l.status?.toLowerCase() === 'present' || l.status?.toLowerCase() === 'late' || l.status?.toLowerCase() === 'half_day');
  const totalAbsent = Math.max(0, totalExpected - validAttendanceLogs.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title area - roughly 30% */}
        <div className="md:w-[30%] shrink-0">
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">{t('Attendance Logs')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('Realtime biometric & kiosk punches')}</p>
        </div>

        {/* Stats area - roughly 70% */}
        <div className="md:w-[70%] grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{t('Total Staff Mapped')}</p>
            <h4 className="text-2xl font-black text-blue-700 leading-none">{totalExpected}</h4>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{t('Present')}</p>
            <h4 className="text-2xl font-black text-emerald-700 leading-none">{presentLogs.length}</h4>
          </div>
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">{t('Absent')}</p>
            <h4 className="text-2xl font-black text-rose-700 leading-none">{totalAbsent}</h4>
          </div>
          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">{t('Late')}</p>
            <h4 className="text-2xl font-black text-amber-700 leading-none">{dailyLogs.filter(l => l.status?.toLowerCase() === 'late').length}</h4>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('Search by name, ID or email...')} className="bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm w-full focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDateRange(!isDateRange)} 
                className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-colors ${isDateRange ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {isDateRange ? 'Range Mode' : 'Single Day'}
              </button>
              
              {!isDateRange ? (
                <div className="flex items-center gap-1">
                  <button onClick={handlePrevDate} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 hover:text-primary transition-colors"><ChevronLeft size={16} /></button>
                  <input type="date" className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-primary/20 outline-none" value={currentDate.toISOString().split('T')[0]} onChange={(e) => setCurrentDate(new Date(e.target.value))} />
                  <button onClick={handleNextDate} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 hover:text-primary transition-colors"><ChevronRight size={16} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-2 py-1">
                  <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 outline-none py-1.5" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
                  <span className="text-slate-300 text-xs font-bold">to</span>
                  <input type="date" className="bg-transparent border-none text-xs font-bold text-slate-600 focus:ring-0 outline-none py-1.5" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">

            <button onClick={() => setShowBulkModal(true)} className="btn-primary py-2.5 px-4 sm:px-6 flex items-center gap-2 shadow-lg shadow-primary/20 text-[10px] uppercase font-black tracking-widest"><Plus size={16} /> <span className="hidden sm:inline">Bulk</span> Mark</button>
            <button onClick={() => {
              setManualData({
                employeeId: '',
                date: currentDate.toISOString().split('T')[0],
                inTime: settings?.standard_start_time?.substring(0, 5) || '09:00',
                outTime: settings?.standard_end_time?.substring(0, 5) || '17:00',
                status: 'present'
              });
              setShowManualModal(true);
            }} className="btn-secondary py-2.5 px-4 sm:px-6 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest border border-slate-100"><Clock size={16} /> Manual</button>
            <button onClick={() => setShowHolidayModal(true)} className="btn-secondary py-2.5 px-4 sm:px-6 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest border border-slate-100 bg-amber-50 text-amber-600 border-amber-100"><Calendar size={16} /> Holidays</button>
            <button onClick={exportToCSV} className="btn-secondary py-2.5 px-4 sm:px-6 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest border border-slate-100 bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 transition-colors"><Download size={16} /> Export</button>
          </div>
        </div>

        {view === 'monthly' ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
              ))}
              {getDaysInMonth(currentDate).map((date, i) => {
                if (!date) return <div key={`pad-${i}`} className="aspect-square bg-slate-50/50 rounded-2xl"></div>;
                const dStr = date.toISOString().split('T')[0];
                const isSelected = dStr === currentDate.toISOString().split('T')[0];
                return (
                  <button key={dStr} onClick={() => { setCurrentDate(date); setView('daily'); }} className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all border ${isSelected ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white text-slate-600 border-slate-100 hover:border-primary/30'}`}>
                    <span className="text-sm font-black">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-50/50">
                  <tr className="text-left border-b border-slate-100">
                    <th className="py-4 pl-8 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Employee Name')}</th>
                    <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{isDateRange ? t('Status') : t('Status')}</th>
                    <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{isDateRange ? t('Total Present') : t('Attendance')}</th>
                    <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{t('Earnings')}</th>
                    <th className="py-4 text-right pr-8 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan="5" className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Database...</td></tr>
                  ) : employees

                    .filter(emp => (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || String(emp.id).includes(searchQuery))
                    .length > 0 ? (
                    employees

                      .filter(emp => (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || String(emp.id).includes(searchQuery))
                      .map((emp) => {
                        
                        if (isDateRange) {
                          const logs = dailyLogs.filter(l => l.employee_id === emp.id);
                          const present = logs.filter(l => l.status?.toLowerCase() === 'present').length;
                          const late = logs.filter(l => l.status?.toLowerCase() === 'late').length;
                          const half = logs.filter(l => l.status?.toLowerCase() === 'half_day').length;
                          const totalPresentDays = present + late + (half * 0.5);
                          const totalHours = logs.reduce((acc, l) => acc + parseFloat(l.total_hours || 0), 0);
                          
                          return (
                            <tr key={`range-${emp.id}`} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 pl-8">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                    {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-primary font-black">{emp.name?.charAt(0)}</div>}
                                  </div>
                                  <div>
                                    <h4 className="text-[12px] font-black text-slate-700 leading-tight">{emp.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100" title="Present">{present} P</span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-100" title="Late">{late} L</span>
                                  {half > 0 && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-50 text-purple-600 border border-purple-100" title="Half Day">{half} HD</span>}
                                </div>
                              </td>
                              <td className="py-4 text-center">
                                <span className="text-[13px] font-black text-slate-800">{totalPresentDays} <span className="text-[9px] text-slate-400 uppercase tracking-widest">Days</span></span>
                              </td>
                              <td className="py-4 text-center">
                                <span className="text-[12px] font-black text-slate-800">{totalHours.toFixed(1)}h</span>
                              </td>
                              <td className="py-4 pr-8 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => { 
                                    setManualData({ 
                                      employeeId: emp.id, 
                                      date: currentDate.toISOString().split('T')[0], 
                                      inTime: settings?.standard_start_time?.substring(0,5) || '09:00', 
                                      outTime: settings?.standard_end_time?.substring(0,5) || '17:00', 
                                      status: 'present' 
                                    }); 
                                    setShowManualModal(true); 
                                  }} className="p-2 text-slate-400 hover:text-amber-500 bg-white rounded-xl border border-slate-100" title="Add manual log"><Pencil size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        // SINGLE DAY VIEW LOGIC
                        const log = dailyLogs.find(l => l.employee_id === emp.id);
                        
                        let status = log ? log.status : 'Absent';
                        if (!log) {
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const checkDate = new Date(currentDate);
                          checkDate.setHours(0,0,0,0);
                          
                          if (checkDate > today) {
                            status = 'Upcoming';
                          } else if (checkDate.getTime() === today.getTime()) {
                            const currentHour = new Date().getHours();
                            let isOver = false;
                            
                            if (currentHour >= 14) isOver = true; // Fallback

                            status = isOver ? 'Absent' : 'Pending';
                          }
                        }

                        const getStatusColor = (s) => {
                          const val = (s || '').toLowerCase();
                          if (val === 'present') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
                          if (val === 'late') return 'bg-amber-50 text-amber-600 border-amber-100';
                          if (val === 'pending') return 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse';
                          if (val === 'upcoming') return 'bg-slate-50 text-slate-500 border-slate-200';
                          return 'bg-rose-50 text-rose-600 border-rose-100'; // Absent
                        };

                        const holiday = holidays.find(h => h.holiday_date.split('T')[0] === currentDate.toISOString().split('T')[0]);

                        return (
                          <tr key={`daily-${emp.id}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 pl-8">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                  {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-primary font-black">{emp.name?.charAt(0)}</div>}
                                </div>
                                <div>
                                  <h4 className="text-[12px] font-black text-slate-700 leading-tight">{emp.name}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</p>
                                    {holiday && (
                                      <span className="text-[7px] font-black bg-amber-50 text-amber-600 px-1 rounded uppercase flex items-center gap-1">
                                        <Calendar size={8} /> {holiday.holiday_name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(status)}`}>{status}</span>
                            </td>
                            <td className="py-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-600">
                                <span>{log?.in_time ? new Date(log.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                <span className="opacity-30">→</span>
                                <span>{log?.out_time ? new Date(log.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                              </div>
                            </td>
                            <td className="py-4 text-center">
                  <span className="text-[11px] font-black text-slate-800">{log?.total_hours || '0.00'}h</span>
                            </td>
                            <td className="py-4 pr-8 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => handleViewDetails(log || { ...emp, employee_id: emp.id, status: 'Absent', date: currentDate.toISOString().split('T')[0] })} className="p-2 text-slate-400 hover:text-primary bg-white rounded-xl border border-slate-100"><Eye size={16} /></button>
                                <button onClick={() => { 
                                  setManualData({ 
                                    employeeId: emp.id, 
                                    date: currentDate.toISOString().split('T')[0], 
                                    inTime: log?.in_time ? new Date(log.in_time).toTimeString().substring(0,5) : (settings?.standard_start_time?.substring(0,5) || '09:00'), 
                                    outTime: log?.out_time ? new Date(log.out_time).toTimeString().substring(0,5) : (settings?.standard_end_time?.substring(0,5) || '17:00'), 
                                    status: log?.status || 'present' 
                                  }); 
                                  setShowManualModal(true); 
                                }} className="p-2 text-slate-400 hover:text-amber-500 bg-white rounded-xl border border-slate-100" title="Add manual log"><Pencil size={16} /></button>
                                {log && (
                                  <button onClick={async () => {
                                    const confirmed = await showConfirm({
                                      title: 'Delete Record',
                                      message: 'Delete this attendance record?',
                                      confirmText: 'Delete',
                                      type: 'danger'
                                    });
                                    if(confirmed) {
                                      try {
                                        await api.delete(`/attendance/${log.id}`);
                                        showAlert('Record deleted successfully', 'success');
                                        fetchAttendance();
                                      } catch(err) {
                                        showAlert('Failed to delete attendance record.', 'error');
                                      }
                                    }
                                  }} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100"><Trash2 size={16} /></button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr><td colSpan="5" className="py-20 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No matching records</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Manual Modal */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowManualModal(false); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-box modal-sm"
              style={{ maxWidth: '440px', width: '95%', margin: '0 auto' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Manual Log</h3>
                <button onClick={() => setShowManualModal(false)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100"><X size={18} /></button>
              </div>
              <div className="modal-body custom-scrollbar !overflow-visible">
                <form onSubmit={handleManualSubmit} className="space-y-4 flex flex-col min-h-[400px]">
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Employee</label>
                    <div 
                      className="input-field flex items-center justify-between cursor-pointer"
                      onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                    >
                      <span className={manualData.employeeId ? "text-slate-700" : "text-slate-400"}>
                        {manualData.employeeId ? employees.find(e => e.id == manualData.employeeId)?.name : "Choose Staff Member..."}
                      </span>
                      <ChevronRight size={16} className={`text-slate-400 transition-transform ${isEmployeeDropdownOpen ? 'rotate-90' : ''}`} />
                    </div>
                    
                    <AnimatePresence>
                      {isEmployeeDropdownOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                          className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden"
                        >
                          <div className="p-2 border-b border-slate-100 bg-slate-50">
                            <input 
                              type="text" 
                              placeholder="Search employee..." 
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                              value={employeeSearchQuery}
                              onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {employees
                              .filter(e => (e.name||'').toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                              .map(e => (
                                <div 
                                  key={e.id} 
                                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${manualData.employeeId == e.id ? 'bg-primary/5 text-primary font-bold' : 'text-slate-600'}`}
                                  onClick={() => {
                                    setManualData({ ...manualData, employeeId: e.id });
                                    setIsEmployeeDropdownOpen(false);
                                    setEmployeeSearchQuery('');
                                  }}
                                >
                                  {e.name}
                                </div>
                              ))}
                            {employees.filter(e => (e.name||'').toLowerCase().includes(employeeSearchQuery.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-xs text-center text-slate-400 font-bold">No employee found</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                      <input type="date" required value={manualData.date} onChange={(e) => setManualData({ ...manualData, date: e.target.value })} className="input-field" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                      <select value={manualData.status} onChange={(e) => setManualData({ ...manualData, status: e.target.value })} className="input-field">
                        <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
                      </select></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Punch In</label>
                      <input type="time" required value={manualData.inTime} onChange={(e) => setManualData({ ...manualData, inTime: e.target.value })} className="input-field" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Punch Out</label>
                      <input type="time" required value={manualData.outTime} onChange={(e) => setManualData({ ...manualData, outTime: e.target.value })} className="input-field" /></div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full btn-primary py-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 mt-auto">
                    {loading ? 'Saving...' : 'Confirm Manual Entry'}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-box modal-md"
              style={{ maxWidth: '550px', width: '95%', margin: '0 auto' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Bulk Attendance</h3>
                <button onClick={() => setShowBulkModal(false)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100"><X size={18} /></button>
              </div>
              <div className="modal-body custom-scrollbar">
                <form onSubmit={handleBulkSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                      <input type="date" required value={bulkData.date} onChange={(e) => setBulkData({ ...bulkData, date: e.target.value })} className="input-field" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                      <select value={bulkData.status} onChange={(e) => setBulkData({ ...bulkData, status: e.target.value })} className="input-field">
                        <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
                      </select></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Punch In *</label>
                      <input type="time" required value={bulkData.inTime} onChange={(e) => setBulkData({ ...bulkData, inTime: e.target.value })} className="input-field" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Punch Out</label>
                      {bulkData.outTime ? (
                        <div className="relative">
                          <input type="time" value={bulkData.outTime} onChange={(e) => setBulkData({ ...bulkData, outTime: e.target.value })} className="input-field pr-8" />
                          <button type="button" onClick={() => setBulkData({ ...bulkData, outTime: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 transition-colors"><X size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setBulkData({ ...bulkData, outTime: '17:00' })} className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-600 text-left hover:bg-amber-100 transition-colors">
                          No punch out currently — Click to add
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="text-[10px] font-black uppercase text-slate-400">Select Staff ({bulkData.employeeIds.length})</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const allIds = employees.map(e => e.id);
                          setBulkData({ ...bulkData, employeeIds: allIds });
                        }} 
                        className="text-[10px] font-black text-primary uppercase whitespace-nowrap bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 hover:bg-slate-100 transition-colors"
                      >
                        Select All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100 custom-scrollbar">
                      {employees.map(emp => (
                        <label key={emp.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                          <input type="checkbox" checked={bulkData.employeeIds.includes(emp.id)} onChange={(e) => {
                            const ids = e.target.checked ? [...bulkData.employeeIds, emp.id] : bulkData.employeeIds.filter(id => id !== emp.id);
                            setBulkData({ ...bulkData, employeeIds: ids });
                          }} className="rounded text-primary" />
                          <div className="flex items-center min-w-0">
                            <span className="text-xs font-bold text-slate-700 truncate">{emp.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" disabled={loading || bulkData.employeeIds.length === 0}
                    className="w-full btn-primary py-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 disabled:opacity-50">
                    {loading ? 'Processing...' : 'Confirm Bulk Update'}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail / Edit Modal */}
      <AnimatePresence>
        {showDetailModal && selectedLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-box modal-sm"
              style={{ maxWidth: '440px', width: '95%', margin: '0 auto' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                    {selectedLog.photo ? <img src={selectedLog.photo} className="w-full h-full object-cover" /> : <div className="text-lg font-black text-primary">{selectedLog.name?.charAt(0)}</div>}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">{selectedLog.name}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log details</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100"><X size={18} /></button>
              </div>
              <div className="modal-body custom-scrollbar">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Punch In</label>
                        <input type="datetime-local" className="input-field" value={formatForInput(selectedLog.in_time)} onChange={(e) => setSelectedLog({ ...selectedLog, in_time: e.target.value })} /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Punch Out</label>
                        <input type="datetime-local" className="input-field" value={formatForInput(selectedLog.out_time)} onChange={(e) => setSelectedLog({ ...selectedLog, out_time: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Status</label>
                      <select className="input-field" value={selectedLog.status} onChange={(e) => setSelectedLog({ ...selectedLog, status: e.target.value })}>
                        <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
                      </select></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">In</p><p className="text-sm font-black text-slate-800">{selectedLog.in_time ? new Date(selectedLog.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p></div>
                      <div className="p-4 bg-slate-50 rounded-2xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Out</p><p className="text-sm font-black text-slate-800">{selectedLog.out_time ? new Date(selectedLog.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p></div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase">Total Duration</span><span className="text-sm font-black text-slate-800">{selectedLog.total_hours || '0.00'} Hours</span></div>
                    <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase">Status</span>
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${selectedLog.status?.toLowerCase() === 'present' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{selectedLog.status}</span></div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="flex-1 btn-secondary py-2.5 text-[10px] uppercase font-black">Cancel</button>
                    <button onClick={handleUpdateAttendance} className="flex-1 btn-primary py-2.5 text-[10px] uppercase font-black">Save</button>
                  </>
                ) : (
                  <button onClick={() => setShowDetailModal(false)} className="flex-1 btn-secondary py-2.5 text-[10px] uppercase font-black tracking-widest">Close</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Holiday Modal */}
      <AnimatePresence>
        {showHolidayModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowHolidayModal(false); }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-box modal-sm"
              style={{ maxWidth: '440px', width: '95%', margin: '0 auto' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Public Holidays</h3>
                <button onClick={() => setShowHolidayModal(false)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl border border-slate-100"><X size={18} /></button>
              </div>
              <div className="modal-body custom-scrollbar space-y-5">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" placeholder="Holiday Name" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} className="input-field" />
                    <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} className="input-field" />
                  </div>
                  <button onClick={async () => {
                    if (!newHoliday.name) {
                      showAlert('Enter name', 'error');
                      return;
                    }
                    try {
                      await api.post('/attendance/holidays', { name: newHoliday.name, date: newHoliday.date });
                      setNewHoliday({ name: '', date: new Date().toISOString().split('T')[0] });
                      showAlert('Holiday added successfully', 'success');
                      fetchHolidays();
                    } catch (err) { showAlert('Failed to add holiday', 'error'); }
                  }} className="w-full btn-primary py-3 font-black uppercase text-[10px] tracking-widest">Add Holiday</button>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upcoming Holidays</p>
                  {holidays.map(h => (
                    <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-black text-slate-800">{h.holiday_name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.holiday_date).toLocaleDateString()}</p>
                      </div>
                      <button onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Delete Holiday',
                          message: 'Are you sure you want to delete this holiday?',
                          confirmText: 'Delete',
                          type: 'danger'
                        });
                        if (confirmed) {
                          try { await api.delete(`/attendance/holidays/${h.id}`); fetchHolidays(); showAlert('Holiday deleted', 'success'); }
                          catch (err) { showAlert('Failed to delete holiday', 'error'); }
                        }
                      }} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><X size={14} /></button>
                    </div>
                  ))}
                  {holidays.length === 0 && <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase">No holidays set</p>}
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowHolidayModal(false)} className="flex-1 btn-secondary py-2.5 text-[10px] uppercase font-black">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Attendance;
