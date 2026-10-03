import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  FileText, 
  Download, 
  Printer, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  CreditCard,
  Search,
  X,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { handleDownload, handlePrint } from '../../utils/export';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useSettings } from '../../context/SettingsContext';

const Invoices = () => {
  const { currencySymbol, formatCurrency, t } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [generatingPdfId, setGeneratingPdfId] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [empRes, payrollRes, settingsRes] = await Promise.all([
        api.get('/employees'),
        api.get('/payroll'),
        api.get('/settings')
      ]);
      setEmployees(empRes.data);
      setPayrollRecords(payrollRes.data);
      setSettings(settingsRes.data);
      const paid = payrollRes.data.filter(p => p.status === 'paid');
      if (paid.length > 0) {
        setSelectedInvoiceId(paid[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data for invoices:', err);
      setLoading(false);
    }
  };

  const paidPayrolls = payrollRecords.filter(p => p.status === 'paid');
  
  const filteredPayrolls = paidPayrolls.filter(p => {
    const emp = employees.find(e => String(e.id) === String(p.employee_id) || String(e.custom_id) === String(p.employee_id));
    return (emp?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
           String(emp?.custom_id || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const currentPayroll = payrollRecords.find(p => p.id === selectedInvoiceId) || filteredPayrolls[0];
  const selectedEmployee = currentPayroll ? employees.find(e => String(e.id) === String(currentPayroll.employee_id) || String(e.custom_id) === String(currentPayroll.employee_id)) : null;

  // Auto-generate PDF if it's missing for the currently selected invoice
  useEffect(() => {
    const autoGeneratePdf = async () => {
      if (currentPayroll && !currentPayroll.pdf_path && generatingPdfId !== currentPayroll.id) {
        setGeneratingPdfId(currentPayroll.id);
        try {
          const res = await api.post(`/payroll/${currentPayroll.id}/generate-pdf`);
          if (res.data.success) {
            setPayrollRecords(prev => prev.map(p => p.id === currentPayroll.id ? { ...p, pdf_path: res.data.pdf_path } : p));
          }
        } catch (err) {
          console.error('Error auto-generating PDF:', err);
        } finally {
          setGeneratingPdfId(null);
        }
      }
    };
    autoGeneratePdf();
  }, [currentPayroll, generatingPdfId]);

  const generatePDF = () => {
    window.print();
  };

  const handleGeneratePdf = async (payrollId) => {
    try {
      setGeneratingPdfId(payrollId);
      const res = await api.post(`/payroll/${payrollId}/generate-pdf`);
      if (res.data.success) {
        setPayrollRecords(prev => prev.map(p => p.id === payrollId ? { ...p, pdf_path: res.data.pdf_path } : p));
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPdfId(null);
    }
  };

  return (
    <div className="space-y-6">


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Employee List Sidebar */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="card flex flex-col h-auto lg:h-[650px] overflow-hidden p-0">
            <div className="p-6 border-b border-slate-50 shrink-0">
              <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider">{t('GENERATED PAYSLIPS')}</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('Search employee...')} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-10 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Loading Records...')}</p>
                </div>
              ) : filteredPayrolls.length === 0 ? (
                <div className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   {t('No paid invoices found')}
                </div>
              ) : filteredPayrolls.map((payroll) => {
                  const item = employees.find(e => String(e.id) === String(payroll.employee_id) || String(e.custom_id) === String(payroll.employee_id));
                  if(!item) return null;
                  return (
                    <button 
                      key={payroll.id} 
                      onClick={() => setSelectedInvoiceId(payroll.id)}
                      className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all text-left group ${
                        selectedInvoiceId === payroll.id 
                        ? 'bg-primary/5 border border-primary/20 shadow-sm' 
                        : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border ${
                        selectedInvoiceId === payroll.id ? 'border-primary/20 scale-110' : 'border-slate-100'
                      }`}>
                        <img 
                          src={item.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selectedInvoiceId === payroll.id ? 'text-primary' : 'text-slate-800'}`}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-black uppercase mt-0.5">{new Date(payroll.cycle_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600">{formatCurrency(payroll.net_salary || 0)}</p>
                      </div>
                    </button>
                  );
              })}
            </div>
          </div>
        </div>

        {/* Payslip Preview Container */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedInvoiceId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card bg-white shadow-2xl border-slate-200 relative overflow-hidden p-0"
              id="payslip-content"
            >
              <div className="p-0 h-full flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary text-white p-2 rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('SALARY SLIP')}</h2>
                      <p className="text-primary font-bold text-[10px] uppercase">
                         {currentPayroll ? new Date(currentPayroll.cycle_start).toLocaleDateString('en-GB') : '---'} TO {currentPayroll ? new Date(currentPayroll.cycle_end).toLocaleDateString('en-GB') : '---'}
                      </p>
                    </div>
                  </div>
                  {currentPayroll?.pdf_path && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const baseUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
                          const pdfPath = currentPayroll.pdf_path.replace(/\\/g, '/').replace(/^\//, '');
                          window.open(`${baseUrl}/${pdfPath}`, '_blank');
                        }} 
                        className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                      >
                        <Download size={14} /> {t('View / Download')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-slate-100 min-h-[600px] relative">
                  {!currentPayroll ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-white">
                      <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-4">
                        <FileText size={40} />
                      </div>
                      <h4 className="text-lg font-black text-slate-700 uppercase tracking-widest">{t('No Invoice Selected')}</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs font-bold">
                        {t('Process payroll and mark as paid to view generated invoice payslips here.')}
                      </p>
                    </div>
                  ) : currentPayroll?.pdf_path ? (
                    <object 
                      data={`${api.defaults.baseURL.replace(/\/api\/?$/, '')}/${currentPayroll.pdf_path.replace(/\\/g, '/').replace(/^\//, '')}#toolbar=0`} 
                      type="application/pdf"
                      className="absolute inset-0 w-full h-full border-0"
                    >
                      <iframe 
                        src={`${api.defaults.baseURL.replace(/\/api\/?$/, '')}/${currentPayroll.pdf_path.replace(/\\/g, '/').replace(/^\//, '')}#toolbar=0`} 
                        className="w-full h-full border-0"
                        title="Payslip PDF"
                      >
                        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                          <p className="text-sm font-bold text-slate-600 mb-2">PDF Document Ready</p>
                          <a 
                            href={`${api.defaults.baseURL.replace(/\/api\/?$/, '')}/${currentPayroll.pdf_path.replace(/\\/g, '/').replace(/^\//, '')}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-primary py-2 px-4 text-xs"
                          >
                            {t('View / Download')}
                          </a>
                        </div>
                      </iframe>
                    </object>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-white">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4"></div>
                      <h4 className="text-lg font-black text-slate-800 uppercase tracking-widest">{t('Generating PDF...')}</h4>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Invoices;
