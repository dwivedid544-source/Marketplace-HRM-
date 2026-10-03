import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  Receipt, 
  Search, 
  Download, 
  RefreshCw, 
  CreditCard, 
  TrendingUp, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  Calendar,
  DollarSign
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';

const PaymentHistory = () => {
  const { showAlert } = useUI();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    paidTransactions: 0,
    failedTransactions: 0,
    payingCompanies: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/superadmin/payments/history');
      if (res.data) {
        setInvoices(res.data.invoices || []);
        setStats(res.data.stats || {
          totalRevenue: 0,
          totalTransactions: 0,
          paidTransactions: 0,
          failedTransactions: 0,
          payingCompanies: 0
        });
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
      showAlert('Failed to load payment records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      showAlert('No transaction records to export', 'warning');
      return;
    }
    const headers = ['Invoice Number', 'Company Name', 'Customer Name', 'Email', 'Phone', 'Plan Name', 'Billing Cycle', 'Amount (INR)', 'Status', 'Payment Method', 'Razorpay Payment ID', 'Date'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      `"${inv.company_name || ''}"`,
      `"${inv.customer_name || ''}"`,
      inv.customer_email || '',
      inv.customer_phone || '',
      `"${inv.plan_name || ''}"`,
      inv.billing_cycle || '',
      inv.amount || '0',
      inv.payment_status || '',
      inv.payment_method || '',
      inv.razorpay_payment_id || '',
      inv.created_at || inv.invoice_date || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payment_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.company_name || '').toLowerCase().includes(q) ||
      (inv.customer_name || '').toLowerCase().includes(q) ||
      (inv.customer_email || '').toLowerCase().includes(q) ||
      (inv.plan_name || '').toLowerCase().includes(q) ||
      (inv.razorpay_payment_id || '').toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2.5">
            <Receipt className="text-primary w-6 h-6" /> Payment History & Revenue
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Complete transaction records, incoming revenue & invoice history across all companies
          </p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={fetchPaymentHistory}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/15">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Total Revenue</span>
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp size={18} className="text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight">
            ₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-emerald-100 font-medium mt-1">Verified incoming subscription revenue</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Transactions</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            {stats.totalTransactions}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-1">All processed payment attempts</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Successful Payments</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 tracking-tight">
            {stats.paidTransactions}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Paid invoices and renewals</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paying Companies</span>
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-primary tracking-tight">
            {stats.payingCompanies}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Unique subscribed organizations</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, invoice #, razorpay id..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-slate-800 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'paid', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Company & Client</th>
                <th className="p-4">Plan & Cycle</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Razorpay Payment ID</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading transaction records...</p>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400">
                    <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No payment transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">Transaction records will appear here as soon as companies subscribe.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 font-black text-slate-900 dark:text-white">
                      <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                        {inv.invoice_number || `INV-#${inv.id}`}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {inv.company_name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{inv.customer_name}</span>
                        {inv.customer_email && <span>• {inv.customer_email}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800">
                        {inv.plan_name}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Cycle: {inv.billing_cycle || 'Monthly'}
                      </div>
                    </td>
                    <td className="p-4 font-black text-base text-emerald-600 dark:text-emerald-400">
                      ₹{parseFloat(inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      {inv.razorpay_payment_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                            {inv.razorpay_payment_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(inv.razorpay_payment_id, inv.id)}
                            title="Copy Payment ID"
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {copiedId === inv.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Manual / Direct</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {inv.created_at || inv.invoice_date ? new Date(inv.created_at || inv.invoice_date).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${
                        inv.payment_status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : inv.payment_status === 'failed'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {inv.payment_status === 'paid' ? <CheckCircle2 size={12} /> : inv.payment_status === 'failed' ? <XCircle size={12} /> : <Clock size={12} />}
                        {inv.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentHistory;
