import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axios';
import { 
  CreditCard, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Fuel,
  UtensilsCrossed,
  Plane,
  MoreHorizontal
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const MyClaims = () => {
  const { currencySymbol, t } = useSettings();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

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

  const filteredClaims = claims.filter(c => {
    return statusFilter === 'All' || c.status === statusFilter;
  });

  const stats = {
    total: claims.length,
    pending: claims.filter(c => c.status === 'Pending').length,
    approved: claims.filter(c => c.status === 'Approved').length,
    rejected: claims.filter(c => c.status === 'Rejected').length,
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'Fuel': return <Fuel size={14} />;
      case 'Food': return <UtensilsCrossed size={14} />;
      case 'Travel': return <Plane size={14} />;
      default: return <MoreHorizontal size={14} />;
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('My Claims')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Submit expense claims and track reimbursement status')}
          </p>
        </div>
        <Link 
          to="/employee/claims/submit"
          className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          {t('Submit Claim')}
        </Link>
      </div>

      {/* Claims Log Table */}
      <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-slate-100 bg-slate-50/30">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('Claims History')}</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t('Records of all submitted expenses')}</p>
          </div>
          
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[8px] font-black uppercase text-slate-400 px-2 tracking-wider">{t('Status')}:</span>
            {['All', 'Pending', 'Approved', 'Rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  statusFilter === s 
                    ? 'bg-white text-primary shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 pl-8 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Type')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Amount')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Expense Date')}</th>
                <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Description')}</th>
                <th className="py-4 pr-8 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">{t('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Loading Claims...')}</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClaims.length > 0 ? (
                filteredClaims.map((claim, idx) => (
                  <tr key={claim.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="py-5 pl-8">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${getTypeBadge(claim.claim_type)}`}>
                        {getTypeIcon(claim.claim_type)}
                        {t(claim.claim_type)}
                      </span>
                    </td>
                    <td className="py-5">
                      <p className="text-[13px] font-black text-slate-800 tracking-tight">
                        {currencySymbol}{Number(claim.amount).toLocaleString()}
                      </p>
                    </td>
                    <td className="py-5 text-[11px] font-bold text-slate-500">
                      {new Date(claim.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-5 max-w-[200px] truncate">
                      <p className="text-[11px] text-slate-600 font-bold truncate" title={claim.description}>
                        {claim.description || <span className="text-slate-300 italic uppercase">{t('No Description')}</span>}
                      </p>
                    </td>
                    <td className="py-5 pr-8 text-right">
                      <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-2 border ${
                        claim.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                        claim.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        claim.status === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          claim.status === 'Approved' ? 'bg-emerald-500' : 
                          claim.status === 'Pending' ? 'bg-amber-500' : 
                          claim.status === 'Rejected' ? 'bg-rose-500' : 'bg-slate-400'
                        }`}></div>
                        {t(claim.status)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <CreditCard size={40} className="text-slate-400" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('No claims found for this selection')}</p>
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

export default MyClaims;
