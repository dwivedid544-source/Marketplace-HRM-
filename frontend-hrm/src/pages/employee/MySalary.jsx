import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  Wallet, 
  Download, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  FileText,
  TrendingUp,
  AlertCircle,
  Calendar,
  Printer,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { handleDownload } from '../../utils/export';
import { useSettings } from '../../context/SettingsContext';

const MySalary = () => {
  const { currencySymbol, formatCurrency, t } = useSettings();
  const [salaryData, setSalaryData] = useState(null);
  const [liveAccrual, setLiveAccrual] = useState(null);
  const [totalContributions, setTotalContributions] = useState(0);
  const [allPayrolls, setAllPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [settings, setSettings] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUserProfile(u);
      fetchMySalary(u.id || u.userId);
    }
    fetchSettings();
  }, []);

  // Auto-generate PDF if it's missing for the currently selected salary slip
  useEffect(() => {
    const autoGeneratePdf = async () => {
      if (showSlipModal && salaryData && !salaryData.pdf_path && generatingPdfId !== salaryData.id) {
        setGeneratingPdfId(salaryData.id);
        try {
          const res = await api.post(`/payroll/${salaryData.id}/generate-pdf`);
          if (res.data.success) {
            setAllPayrolls(prev => prev.map(p => p.id === salaryData.id ? { ...p, pdf_path: res.data.pdf_path } : p));
            setSalaryData(prev => ({ ...prev, pdf_path: res.data.pdf_path }));
          }
        } catch (err) {
          console.error('Error auto-generating PDF:', err);
        } finally {
          setGeneratingPdfId(null);
        }
      }
    };
    autoGeneratePdf();
  }, [showSlipModal, salaryData, generatingPdfId]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {}
  };

  const fetchMySalary = async (userId) => {
    try {
      setLoading(true);
      const [response, liveRes] = await Promise.all([
        api.get('/payroll'),
        api.get('/payroll/live-accrual')
      ]);
      const myData = response.data[0]; 
      setSalaryData(myData);
      setAllPayrolls(response.data);
      setLiveAccrual(liveRes.data);

      const calculatedTotal = response.data.reduce((sum, p) => {
        const total = parseFloat(p.total_contribution || p.cpf_total || (parseFloat(p.employee_contribution || p.cpf_employee || p.uif_amount || 0) + parseFloat(p.employer_contribution || p.cpf_employer || 0)));
        return sum + (isNaN(total) ? 0 : total);
      }, 0);
      setTotalContributions(calculatedTotal);
    } catch (err) {
      console.error('Error fetching my salary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (payrollId) => {
    try {
      setGeneratingPdfId(payrollId);
      const res = await api.post(`/payroll/${payrollId}/generate-pdf`);
      if (res.data.success) {
        setAllPayrolls(prev => prev.map(p => p.id === payrollId ? { ...p, pdf_path: res.data.pdf_path } : p));
        if (salaryData?.id === payrollId) {
          setSalaryData(prev => ({ ...prev, pdf_path: res.data.pdf_path }));
        }
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  return (
    <div className="pb-24">
      <div className="no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t('My Salary')}</h1>
            <p className="text-sm text-slate-500">{t('Track your earnings, deductions and payouts.')}</p>
          </div>
        <button 
          onClick={() => setShowSlipModal(true)}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Download size={18} />
          {t('View & Download Slip')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 card bg-slate-900 text-white border-none relative overflow-hidden">
          <div className="relative z-10">
            <div className="p-3 bg-white/10 rounded-2xl w-fit mb-8 border border-white/10">
              <Wallet size={24} className="text-primary-light" />
            </div>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest bg-white/5 inline-block px-2 py-1 rounded">
              {liveAccrual?.startDate ? new Date(liveAccrual.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '---'} TO {liveAccrual?.endDate ? new Date(liveAccrual.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
            </p>
            <h3 className="text-4xl font-black mt-2 tracking-tight">{loading ? '...' : (liveAccrual ? formatCurrency(liveAccrual.netSalary || 0) : formatCurrency(0))}</h3>
            <div className="mt-8 pt-8 border-t border-white/10 flex items-center justify-between">
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase mb-1">{t('Payment Status')}</p>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                  <Clock size={16} /> {t('LIVE ONGOING')}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-[10px] font-bold uppercase mb-1">{t('Cycle End')}</p>
                <p className="text-sm font-bold">{t('Pending')}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
        </div>

        <div className="lg:col-span-2 card grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">{t('Earnings Breakdown')}</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Gross Earnings')}</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(liveAccrual?.grossEarnings || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Hourly/Daily Rate')}</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(liveAccrual?.salaryRate || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Total Hours')}</span>
                <span className="text-sm font-bold text-slate-800">{liveAccrual?.totalHours || 0} {t('Hours')}</span>
              </div>
            </div>
          </div>
          <div className="space-y-6 md:border-l md:border-slate-50 md:pl-8">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-4">{t('Deductions')}</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Employee Contribution / Deduction')}</span>
                <span className="text-sm font-bold text-rose-500">-{formatCurrency(liveAccrual?.employeeContribution || liveAccrual?.cpfEmployee || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Employer Contribution')}</span>
                <span className="text-sm font-bold text-indigo-600">{formatCurrency(liveAccrual?.employerContribution || liveAccrual?.cpfEmployer || 0)}</span>
              </div>
              <div className="flex justify-between items-center py-1 px-2.5 bg-emerald-50/70 rounded-lg border border-emerald-100/60">
                <span className="text-xs font-bold text-emerald-800">{t('Total Contribution Savings (Employee + Employer)')}</span>
                <span className="text-xs font-black text-emerald-700">{formatCurrency(parseFloat(liveAccrual?.totalContribution || liveAccrual?.cpfTotal || (parseFloat(liveAccrual?.employeeContribution || liveAccrual?.cpfEmployee || 0) + parseFloat(liveAccrual?.employerContribution || liveAccrual?.cpfEmployer || 0))))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Advance Deductions')}</span>
                <span className="text-sm font-bold text-rose-500">-{formatCurrency(liveAccrual?.advanceDeduction || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-500">{t('Total Deductions')}</span>
                <span className="text-sm font-bold text-rose-500">-{formatCurrency(parseFloat(liveAccrual?.employeeContribution || liveAccrual?.cpfEmployee || 0) + parseFloat(liveAccrual?.advanceDeduction || 0))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accumulated Contributions Card */}
      <div className="card bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-none shadow-xl shadow-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
         <div className="flex items-center gap-4 relative z-10">
             <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/20">
                <Wallet size={32} />
             </div>
             <div>
                <h3 className="text-lg font-black uppercase tracking-widest">{t('Total Accumulated Contributions')}</h3>
                <p className="text-emerald-50 text-sm font-bold">{t('Your total retirement & pension contributions accumulated across all payroll cycles.')}</p>
             </div>
         </div>
         <div className="text-right relative z-10 w-full md:w-auto text-center md:text-right p-4 bg-black/10 rounded-2xl md:bg-transparent md:p-0">
             <h2 className="text-4xl font-black">{currencySymbol}{totalContributions.toLocaleString()}</h2>
         </div>
         <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl z-0"></div>
      </div>

      <div className="card">
        <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
          {t('Salary History')} <FileText size={16} className="text-primary" />
        </h3>
        <div className="space-y-3">
          {allPayrolls.length === 0 ? (
            <div className="py-10 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
              {t('No salary history available')}
            </div>
          ) : (
            allPayrolls.map((payroll) => (
              <div key={payroll.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-colors gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400 shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                      {new Date(payroll.cycle_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {new Date(payroll.cycle_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{t('Status')}: {t(payroll.status)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-black text-emerald-600">{currencySymbol}{parseFloat(payroll.net_salary || 0).toLocaleString()}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('Net Pay')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setSalaryData(payroll);
                        setShowSlipModal(true);
                      }}
                      className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 shadow-sm transition-all"
                      title="View Payslip"
                    >
                      <FileText size={16} />
                    </button>
                    {payroll.pdf_path && (
                      <button 
                        onClick={() => {
                          const baseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
                          const pdfPath = payroll.pdf_path.replace(/\\/g, '/').replace(/^\//, '');
                          window.open(`${baseUrl}/${pdfPath}`, '_blank');
                        }}
                        className="p-2 bg-sky-50 rounded-lg border border-sky-100 text-sky-600 hover:bg-sky-600 hover:text-white shadow-sm transition-all"
                        title="Download Official PDF"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Pay Slip Modal */}
      <AnimatePresence>
        {showSlipModal && salaryData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={() => setShowSlipModal(false)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="modal-box !max-w-3xl !p-0 overflow-hidden bg-slate-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="overflow-hidden flex flex-col h-full bg-slate-100">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                   <div className="flex items-center gap-3">
                     <div className="bg-primary text-white p-2 rounded-xl">
                       <FileText size={20} />
                     </div>
                     <div>
                       <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('SALARY SLIP')}</h2>
                       <p className="text-primary font-bold text-[10px] uppercase">
                          {salaryData.cycle_start ? new Date(salaryData.cycle_start).toLocaleDateString('en-GB') : '---'} TO {salaryData.cycle_end ? new Date(salaryData.cycle_end).toLocaleDateString('en-GB') : '---'}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={() => setShowSlipModal(false)} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600">
                       <X size={18} />
                     </button>
                   </div>
                </div>
                
                <div className="flex-1 relative min-h-[600px] w-full">
                   {salaryData?.pdf_path ? (
                     <iframe 
                       src={
                         window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                           ? `/${salaryData.pdf_path.replace(/\\/g, '/').replace(/^\//, '')}#toolbar=0`
                           : `${api.defaults.baseURL.replace(/\/api\/?$/, '')}/${salaryData.pdf_path.replace(/\\/g, '/').replace(/^\//, '')}#toolbar=0`
                       } 
                       className="absolute inset-0 w-full h-full border-0"
                       title="Payslip PDF"
                     />
                   ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-slate-100">
                       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                       <h4 className="text-xl font-black text-slate-400 uppercase tracking-widest">{t('Generating PDF...')}</h4>
                       <p className="text-sm text-slate-500 mt-2 max-w-sm mb-6">
                          Please wait while we automatically generate the official PDF for this payslip.
                       </p>
                     </div>
                   )}
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2 shrink-0 no-print">
                  <button onClick={() => setShowSlipModal(false)} className="btn-secondary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest">{t('Close')}</button>
                  {salaryData?.pdf_path && (
                    <button 
                      onClick={() => {
                        const baseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
                        const pdfPath = salaryData.pdf_path.replace(/\\/g, '/').replace(/^\//, '');
                        window.open(`${baseUrl}/${pdfPath}`, '_blank');
                      }}
                      className="btn-primary flex items-center gap-2 py-2.5 px-6 text-[10px] font-black uppercase tracking-widest"
                    >
                      <Download size={18} /> {t('Download PDF')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MySalary;
