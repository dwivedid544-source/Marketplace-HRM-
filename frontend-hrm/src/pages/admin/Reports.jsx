import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  FileText, 
  Printer, 
  Share2, 
  Download, 
  Calendar,
  Search,
  X,
  ChevronRight,
  TrendingUp,
  FileDown,
  Eye,
  Loader2,
  Activity,
  CheckCircle2,
  AlertCircle,
  Users,
  Clock
} from 'lucide-react';
import { handleDownload } from '../../utils/export';
import { useUI } from '../../context/UIContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';

const Reports = () => {
  const { showAlert } = useUI();
  const { currencySymbol, t } = useSettings();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Date range state
  const [fromDate, setFromDate] = useState(new Date(new Date().setDate(new Date().getDate() - 15)).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
      fetchAttendance();
    }
  }, [selectedEmpId, fromDate, toDate]);

  const fetchAttendance = async () => {
    try {
      setReportLoading(true);
      const response = await api.get(`/attendance`, {
        params: {
           employeeId: selectedEmpId,
           date_from: fromDate,
           date_to: toDate
        }
      });
      setAttendanceLogs(response.data);
      setReportLoading(false);
    } catch (err) {
      console.error('Error fetching attendance for reports:', err);
      setReportLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const [empRes, settingsRes] = await Promise.all([
        api.get('/employees'),
        api.get('/settings')
      ]);
      setEmployees(empRes.data);
      setSettings(settingsRes.data);
      if (empRes.data.length > 0 && isAdmin) {
        setSelectedEmpId(empRes.data[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching employees for reports:', err);
      setLoading(false);
    }
  };

  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      if (!isAdmin) {
        setSelectedEmpId(u.id || u.userId);
      }
    }
  }, [isAdmin]);

  const visibleEmployees = isAdmin ? employees : employees.filter(e => e.id === (user?.id || user?.userId));
  
  const filteredEmployees = visibleEmployees.filter(emp => 
    (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(emp.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedEmployee = employees.find(e => e.id === selectedEmpId) || (employees.length > 0 ? employees[0] : null);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  };

  const generateDirectPDF = async () => {
    setIsDownloading(true);
    try {
      const element = document.getElementById('printable-report-content');
      if (!element || !window.html2canvas || !window.jspdf) {
         window.print();
         return;
      }
      const canvas = await window.html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Report_${selectedEmployee?.name || 'Staff'}.pdf`);
    } catch (err) {
      showAlert('PDF generation failed. Using print fallback.', 'error');
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  const totalUIF = attendanceLogs.reduce((acc, log) => acc + parseFloat(log.uif || 0), 0);
  const totalEarnings = attendanceLogs.reduce((acc, log) => acc + parseFloat(log.earning || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            {isAdmin ? t('Performance Reports') : t('My Performance Report')}
          </h1>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6 items-start`}>
        {/* Left Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4 no-print">
          <div className="card !p-0 flex flex-col h-auto lg:h-[calc(100vh-140px)] overflow-hidden">
            <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50/50 space-y-4">
               <div>
                  <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3">{t('Filters & Range')}</h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('From')}</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('To')}</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold" />
                     </div>
                  </div>
                  {isAdmin && (
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                       <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('Find staff...')} className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-[11px] font-bold" />
                    </div>
                  )}
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
               {filteredEmployees.map((emp) => (
                 <button key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all text-left border ${selectedEmpId === emp.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-transparent border-transparent hover:bg-slate-50'}`}>
                   <div className={`w-9 h-9 rounded-lg overflow-hidden shrink-0 border ${selectedEmpId === emp.id ? 'border-white/20' : 'border-slate-100'}`}>
                      <img src={emp.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-black truncate leading-none ${selectedEmpId === emp.id ? 'text-white' : 'text-slate-800'}`}>{emp.name}</p>
                      <p className={`text-[8px] font-bold uppercase mt-1 leading-none ${selectedEmpId === emp.id ? 'text-white/70' : 'text-slate-400'}`}>{emp.id}</p>
                   </div>
                 </button>
               ))}
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <AnimatePresence mode="wait">
            <motion.div key={`${selectedEmpId}-${fromDate}-${toDate}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card !p-0 bg-white shadow-xl border-slate-200 overflow-hidden lg:h-[calc(100vh-140px)] flex flex-col" id="printable-report-content">
              <div className="flex-1 p-5 space-y-5 relative bg-white overflow-y-auto custom-scrollbar">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                       <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
                          <Activity size={32} />
                       </div>
                       <div>
                          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-tight">{t('PERFORMANCE REPORT')}</h2>
                          <p className="text-primary font-black uppercase text-[10px] tracking-widest mt-1 bg-primary/5 px-2 py-0.5 rounded-md inline-block">
                             {t('PERIOD:')} {formatDate(fromDate)} {t('TO')} {formatDate(toDate)}
                          </p>
                          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-1">
                            <Clock size={10} /> {t('GENERATED:')} {new Date().toLocaleString()}
                          </div>
                       </div>
                    </div>
                    <div className="text-right">
                       <h3 className="text-sm font-black text-primary uppercase tracking-widest leading-none">{settings?.business_name || 'BIOTRACK PRO'}</h3>
                       <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-wider">{t('OFFICIAL SYSTEM REPORT')}</p>
                       {settings?.business_address && <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase max-w-[200px] leading-relaxed">{settings?.business_address}</p>}
                       {(settings?.business_phone || settings?.business_email) && (
                          <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">
                             {[settings?.business_phone, settings?.business_email].filter(Boolean).join(' | ')}
                          </p>
                       )}
                    </div>
                 </div>

                 <div className="flex flex-col md:flex-row items-center gap-6 py-4 border-y border-slate-50">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0 bg-slate-100 flex items-center justify-center">
                       <img src={selectedEmployee?.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee?.name || 'User')}&background=random&size=128`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                       <h2 className="text-2xl font-black text-slate-800 leading-none mb-1">{selectedEmployee?.name || '---'}</h2>
                       <p className="text-xs font-bold text-primary uppercase tracking-widest leading-none">{selectedEmployee?.role || 'Staff Member'} <span className="mx-1 opacity-20">|</span> ID: {selectedEmployee?.custom_id || selectedEmployee?.id}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 text-center">
                       <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">{t('Days')}</p>
                       <p className="text-2xl font-black text-indigo-700 tracking-tighter">{attendanceLogs.length}</p>
                    </div>
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 text-center">
                       <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">{t('Hours')}</p>
                       <p className="text-2xl font-black text-emerald-700 tracking-tighter">{attendanceLogs.reduce((acc, log) => acc + parseFloat(log.total_hours || 0), 0).toFixed(1)}h</p>
                    </div>
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center">
                       <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">{t('Earnings')}</p>
                       <p className="text-2xl font-black text-blue-700 tracking-tighter">{currencySymbol}{totalEarnings.toFixed(0)}</p>
                    </div>
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 text-center">
                       <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">{t('Contribution')}</p>
                       <p className="text-2xl font-black text-amber-700 tracking-tighter">{currencySymbol}{totalUIF.toFixed(2)}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-4">
                       <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">{t('Attendance Activity & Deductions')} <ChevronRight size={14} className="text-primary" /></h4>
                       <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                          <table className="w-full">
                             <thead className="bg-slate-50/50">
                                <tr className="text-left border-b border-slate-100">
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Date')}</th>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Clock Activity')}</th>
                                   <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{t('Contrib.')}</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50 text-[11px]">
                                {attendanceLogs.length > 0 ? attendanceLogs.map((log, i) => (
                                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                     <td className="p-4 font-black text-slate-800">{new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                                     <td className="p-4 text-slate-500 font-bold">
                                       {log.in_time ? new Date(log.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} → {log.out_time ? new Date(log.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                                     </td>
                                     <td className="p-4 font-black text-rose-500 text-right">{currencySymbol}{parseFloat(log.uif || 0).toFixed(2)}</td>
                                  </tr>
                                )) : (
                                  <tr><td colSpan="3" className="p-12 text-center opacity-30"><AlertCircle className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase">No records</p></td></tr>
                                )}
                             </tbody>
                          </table>
                       </div>
                    </div>
                    </div>
                 </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 no-print">
                 <button onClick={() => window.print()} className="w-full btn-primary !py-3 flex items-center justify-center gap-2 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-primary/20">
                    <Printer size={20} /> {t('Print Report')}
                 </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Reports;
