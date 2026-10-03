import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { handleDownload } from '../../utils/export';
import { useSettings } from '../../context/SettingsContext';

const MyAttendance = () => {
  const { t } = useSettings();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  
  // Date selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      fetchMyAttendance();
    }
  }, []);

  const fetchMyAttendance = async () => {
    try {
      setLoading(true);
      const response = await api.get('/attendance');
      setHistory(response.data);
    } catch (err) {
      console.error('Error fetching my attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtering Logic
  const filteredData = history.filter(log => {
    const logDate = new Date(log.date);
    const matchesMonth = logDate.getMonth() === selectedMonth;
    const matchesYear = logDate.getFullYear() === selectedYear;
    const matchesStatus = filterStatus === 'All' || log.status?.toLowerCase() === filterStatus.toLowerCase();
    return matchesMonth && matchesYear && matchesStatus;
  });

  // Card Calculations
  const stats = {
    daysPresent: filteredData.filter(h => h.status?.toLowerCase() === 'present' || h.status?.toLowerCase() === 'late').length,
    lateEntries: filteredData.filter(h => h.status?.toLowerCase() === 'late').length,
    totalHours: filteredData.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) || 0), 0).toFixed(1),
    otHours: filteredData.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) > 9 ? parseFloat(curr.total_hours) - 9 : 0), 0).toFixed(1)
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const changeMonth = (dir) => {
    let nextMonth = selectedMonth + dir;
    let nextYear = selectedYear;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear--;
    } else if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    setSelectedMonth(nextMonth);
    setSelectedYear(nextYear);
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) {
      if (window.globalShowAlert) window.globalShowAlert('No attendance logs to export for this month.', 'warning');
      else alert('No attendance logs to export for this month.');
      return;
    }

    const headers = ['Date', 'Cycle', 'Clock In', 'Clock Out', 'Total Hours', 'Status'];
    const csvRows = [headers.join(',')];

    filteredData.forEach(row => {
      const date = new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const cycle = `Week ${Math.ceil(new Date(row.date).getDate() / 7)}`;
      const inTime = row.in_time ? new Date(row.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---';
      const outTime = row.out_time ? new Date(row.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---';
      const hours = parseFloat(row.total_hours || 0).toFixed(2);
      const status = row.status || '---';

      csvRows.push([date, cycle, inTime, outTime, hours, status].map(v => `"${v}"`).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `My_Attendance_${months[selectedMonth]}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (window.globalShowAlert) window.globalShowAlert('Logs exported successfully to CSV!', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('My Attendance')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{t('Detailed punch-in logs and work hours summary')}</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Download size={18} />
          {t('Export My Logs')}
        </button>
      </div>

      <div id="attendance-report-content" className="space-y-6 bg-slate-50/50 p-2 md:p-4 rounded-3xl -m-2 md:-m-4">
        {/* Dynamic Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card flex flex-col items-center justify-center py-6 group hover:border-primary/20 transition-all">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t('Days Present')}</p>
          <h4 className="text-3xl font-black text-slate-800 tracking-tighter">
            {stats.daysPresent} 
            <span className="text-sm text-slate-400 ml-1">/ {filteredData.length}</span>
          </h4>
        </div>
        <div className="card flex flex-col items-center justify-center py-6 group hover:border-amber-500/20 transition-all">
          <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">{t('Late Entries')}</p>
          <h4 className="text-3xl font-black text-slate-800 tracking-tighter">
            {stats.lateEntries}
          </h4>
        </div>
        <div className="card flex flex-col items-center justify-center py-6 border-l-4 border-l-primary group hover:bg-slate-50/50 transition-all">
          <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">{t('Total Hours')}</p>
          <h4 className="text-3xl font-black text-slate-800 tracking-tighter">
            {stats.totalHours}
          </h4>
        </div>
        <div className="card flex flex-col items-center justify-center py-6 group hover:border-emerald-500/20 transition-all">
          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">{t('OT Hours')}</p>
          <h4 className="text-3xl font-black text-emerald-600 tracking-tighter">{stats.otHours}</h4>
        </div>
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-3">
            <button onClick={() => changeMonth(-1)} className="p-2 bg-white rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-100"><ChevronLeft size={18} /></button>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest w-32 text-center">{months[selectedMonth]} {selectedYear}</h3>
            <button onClick={() => changeMonth(1)} className="p-2 bg-white rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm border border-slate-100"><ChevronRight size={18} /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {['All', 'Present', 'Late', 'Absent'].map(s => (
                <button 
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    filterStatus === s ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 pl-8 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Date / Cycle')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Clock In Activity')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Clock Out Activity')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Total Duration')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Attendance Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Synchronizing Records...')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? filteredData.map((row, i) => (
                <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 pl-8">
                    <p className="font-black text-slate-800 text-[12px]">{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Week {Math.ceil(new Date(row.date).getDate() / 7)} Cycle</p>
                  </td>
                  <td className="py-5 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-[12px] font-black text-emerald-600">
                        {row.in_time ? new Date(row.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'}
                      </p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{t('Punched In')}</span>
                    </div>
                  </td>
                  <td className="py-5 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-[12px] font-black text-rose-600">
                        {row.out_time ? new Date(row.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'}
                      </p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{t('Punched Out')}</span>
                    </div>
                  </td>
                  <td className="py-5 text-center">
                     <p className="text-[13px] font-black text-slate-800 tracking-tight">{parseFloat(row.total_hours || 0).toFixed(2)} <span className="text-[10px] text-slate-400">{t('Hours')}</span></p>
                  </td>
                  <td className="py-5">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 w-fit border ${
                      row.status?.toLowerCase() === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      row.status?.toLowerCase() === 'late' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                      row.status?.toLowerCase() === 'absent' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        row.status?.toLowerCase() === 'present' ? 'bg-emerald-500' : 
                        row.status?.toLowerCase() === 'late' ? 'bg-amber-500' : 
                        row.status?.toLowerCase() === 'absent' ? 'bg-rose-500' : 'bg-slate-400'
                      }`}></div>
                      {t(row.status)}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                     <div className="flex flex-col items-center gap-3 opacity-30">
                        <Calendar size={40} />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('No logs found for')} {months[selectedMonth]} {selectedYear}</p>
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

export default MyAttendance;
