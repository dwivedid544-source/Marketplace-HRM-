import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  Search,
  User,
  AlertCircle,
  Fuel,
  UtensilsCrossed,
  Plane,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const ClaimsManagement = () => {
  const { currencySymbol, t } = useSettings();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await api.get('/claims');
      setClaims(response.data);
    } catch (err) {
      console.error('Error fetching claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setErrorMsg('');
    setSuccessMsg('');
    setUpdatingId(id);
    try {
      await api.put(`/claims/${id}`, { status });
      setSuccessMsg(`Claim successfully marked as ${status}!`);
      await fetchClaims();
    } catch (err) {
      console.error('Error updating claim status:', err);
      setErrorMsg('Failed to update claim status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = {
    total: claims.length,
    pending: claims.filter(c => c.status === 'Pending').length,
    approved: claims.filter(c => c.status === 'Approved').length,
    rejected: claims.filter(c => c.status === 'Rejected').length,
  };

  const filteredClaims = claims.filter(c => {
    const name = c.employee_name || '';
    const customId = c.employee_custom_id || '';
    const desc = c.description || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          customId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesType = typeFilter === 'All' || c.claim_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getTypeIcon = (type) => {
    switch(type) {
      case 'Fuel': return <Fuel size={12} />;
      case 'Food': return <UtensilsCrossed size={12} />;
      case 'Travel': return <Plane size={12} />;
      default: return <MoreHorizontal size={12} />;
    }
  };

  const getTypeBadge = (type) => {
    switch(type) {
      case 'Fuel': return 'bg-amber-50 text-amber-600';
      case 'Food': return 'bg-orange-50 text-orange-600';
      case 'Travel': return 'bg-indigo-50 text-indigo-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-start gap-8 no-print">
        <div className="shrink-0">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('Claims Management')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Review and approve employee expense reimbursement requests')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500 min-w-[140px]">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0"><Clock size={18} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Pending')}</p>
            <h3 className="text-xl font-black text-slate-800 leading-none ml-auto">{loading ? '...' : stats.pending}</h3>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500 min-w-[140px]">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0"><CheckCircle2 size={18} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Approved')}</p>
            <h3 className="text-xl font-black text-slate-800 leading-none ml-auto">{loading ? '...' : stats.approved}</h3>
          </div>
          <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500 min-w-[140px]">
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0"><XCircle size={18} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Rejected')}</p>
            <h3 className="text-xl font-black text-slate-800 leading-none ml-auto">{loading ? '...' : stats.rejected}</h3>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
        {/* Filters - matching Leaves style */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder={t('Search Employee...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-primary w-full"
            />
            <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto">
            <div className="flex flex-1 lg:flex-none items-center justify-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider hidden sm:block">{t('Filter')}:</span>
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

            <div className="flex flex-1 lg:flex-none items-center justify-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider hidden sm:block">{t('Type')}:</span>
              {['All', 'Fuel', 'Food', 'Travel', 'Other'].map((tVal) => (
                <button
                  key={tVal}
                  onClick={() => setTypeFilter(tVal)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    typeFilter === tVal 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t(tVal)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-5 pl-8 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Employee')}</th>
                <th className="py-5 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Type')}</th>
                <th className="py-5 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Amount')}</th>
                <th className="py-5 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Dates')}</th>
                <th className="py-5 pl-12 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Status')}</th>
                <th className="py-5 font-black text-slate-400 text-xs uppercase tracking-widest">{t('Description')}</th>
                <th className="py-5 text-center font-black text-slate-400 text-xs uppercase tracking-widest">{t('Receipt')}</th>
                <th className="py-5 pr-8 font-black text-slate-400 text-xs uppercase tracking-widest text-center">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loading Claims...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClaims.length > 0 ? (
                filteredClaims.map((claim, idx) => (
                  <tr key={claim.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="py-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm uppercase tracking-tight">{claim.employee_name || 'Employee'}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">{claim.employee_custom_id || claim.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${getTypeBadge(claim.claim_type)}`}>
                        {getTypeIcon(claim.claim_type)}
                        {claim.claim_type}
                      </span>
                    </td>
                    <td className="py-5 font-black text-slate-800 text-base tracking-tight">
                      {currencySymbol}{Number(claim.amount).toLocaleString()}
                    </td>
                    <td className="py-5 text-xs font-bold text-slate-500">
                      {new Date(claim.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-5 pl-12">
                      <span className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1.5 border ${
                        claim.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        claim.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        claim.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        <div className={`h-2 w-2 rounded-full ${
                          claim.status === 'Approved' ? 'bg-emerald-500' : 
                          claim.status === 'Pending' ? 'bg-amber-500' : 
                          claim.status === 'Rejected' ? 'bg-rose-500' : 'bg-slate-400'
                        }`}></div>
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-5 max-w-[200px] truncate">
                      <p className="text-xs text-slate-600 font-bold truncate" title={claim.description}>
                        {claim.description || <span className="text-slate-300 italic uppercase">No Description</span>}
                      </p>
                    </td>
                    <td className="py-5 text-center">
                      {claim.receipt ? (
                        <a 
                          href={`${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '')}${claim.receipt}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          View
                        </a>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">N/A</span>
                      )}
                    </td>
                    <td className="py-5 pr-8 text-center">
                      <div className="relative inline-block">
                        <select
                          disabled={updatingId === claim.id}
                          value={claim.status}
                          onChange={(e) => handleUpdateStatus(claim.id, e.target.value)}
                          className={`text-[10px] font-black uppercase tracking-wider rounded-lg px-3 py-2 outline-none cursor-pointer border shadow-sm transition-all ${
                            updatingId === claim.id ? 'opacity-50 cursor-wait' : ''
                          } ${
                            claim.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 
                            claim.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 
                            'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <option value="Pending" className="font-bold">Pending</option>
                          <option value="Approved" className="font-bold">Approved</option>
                          <option value="Rejected" className="font-bold">Rejected</option>
                        </select>
                        {updatingId === claim.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-lg">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <CreditCard size={40} className="text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">No expense claims found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClaimsManagement;
