import React, { useState, useEffect } from 'react';
import saApi from '../../services/superAdminApi';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';

const Requests = () => {
  const { formatDate } = useSettings();
  const { showAlert, showConfirm } = useUI();
  const [requests, setRequests] = useState([]);
  const [planRequests, setPlanRequests] = useState([]);
  const [requestTab, setRequestTab] = useState('pending');
  const [planTab, setPlanTab] = useState('pending');
  const [mainTab, setMainTab] = useState('company'); // 'company' or 'plan'
  const [planFilter, setPlanFilter] = useState('all'); // 'all', 'trial', 'paid'

  useEffect(() => {
    fetchRequests();
    fetchPlanRequests();
  }, []);

  const fetchRequests = () => {
    saApi.get('/requests').then(res => setRequests(res.data)).catch(console.error);
  };

  const fetchPlanRequests = () => {
    saApi.get('/plan-requests').then(res => setPlanRequests(res.data)).catch(console.error);
  };

  const handleAction = async (id, action) => {
    const confirmed = await showConfirm({
      title: 'Confirm Action',
      message: `Are you sure you want to ${action} this company request?`,
      confirmText: 'Yes, proceed'
    });
    
    if (confirmed) {
      try {
        await saApi.put(`/request/${id}/${action}`);
        fetchRequests();
        showAlert(`Company request ${action}ed successfully.`, 'success');
      } catch (err) {
        console.error(err);
        showAlert(`Error trying to ${action} request`, 'error');
      }
    }
  };

  const handlePlanAction = async (id, action) => {
    const confirmed = await showConfirm({
      title: 'Confirm Action',
      message: `Are you sure you want to ${action} this plan upgrade request?`,
      confirmText: 'Yes, proceed'
    });
    
    if (confirmed) {
      try {
        await saApi.put(`/plan-request/${id}/${action}`);
        fetchPlanRequests();
        showAlert(`Plan request ${action}ed successfully.`, 'success');
      } catch (err) {
        console.error(err);
        showAlert(`Error trying to ${action} plan request`, 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Tabs */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-max shadow-inner border border-slate-200/60 no-print mb-6 relative">
        <button
          onClick={() => setMainTab('company')}
          className={`relative z-10 flex items-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            mainTab === 'company' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          Company & Trial Requests
        </button>
        <button
          onClick={() => setMainTab('plan')}
          className={`relative z-10 flex items-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            mainTab === 'plan' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          Plan Renewal Requests
        </button>
      </div>

      {mainTab === 'company' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Company & Free Trial Requests</h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Review onboarding applications and trial registrations</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Plan Filter Badges */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
                <button onClick={() => setPlanFilter('all')} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${planFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>All Plans</button>
                <button onClick={() => setPlanFilter('trial')} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${planFilter === 'trial' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Free Trial</button>
                <button onClick={() => setPlanFilter('paid')} className={`px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${planFilter === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Paid Plans</button>
              </div>

              {/* Status Tab */}
              <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50">
                <button onClick={() => setRequestTab('pending')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${requestTab === 'pending' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>Pending</button>
                <button onClick={() => setRequestTab('history')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${requestTab === 'history' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>History</button>
              </div>
            </div>
          </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Company Details</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Contact Info</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Requested Plan</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Date</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Status</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {requests
                .filter(r => requestTab === 'pending' ? r.status === 'pending' : r.status !== 'pending')
                .filter(r => {
                  if (planFilter === 'trial') return (r.plan || '').toLowerCase().includes('trial') || (r.plan || '').toLowerCase().includes('free');
                  if (planFilter === 'paid') return !((r.plan || '').toLowerCase().includes('trial') || (r.plan || '').toLowerCase().includes('free'));
                  return true;
                })
                .map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{r.company_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">By: {r.owner_name}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-slate-600 font-medium">{r.email}</p>
                    <p className="text-slate-500 text-xs mt-1">{r.phone || 'N/A'}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                      (r.plan || '').toLowerCase().includes('trial') || (r.plan || '').toLowerCase().includes('free')
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {r.plan || 'Free Trial'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={14}/>
                      <span className="text-[10px] font-black uppercase tracking-widest">{formatDate(r.created_at)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${r.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : r.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-3 justify-center items-center">
                    {r.status === 'pending' ? (
                      <>
                        <button onClick={() => handleAction(r.id, 'accept')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors tooltip flex items-center gap-1 font-bold text-xs" title="Approve & Activate Trial">
                          <CheckCircle2 size={18} className="text-emerald-500"/>
                        </button>
                        <button onClick={() => handleAction(r.id, 'reject')} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors tooltip flex items-center gap-1 font-bold text-xs" title="Reject Request">
                          <XCircle size={18} className="text-rose-500"/>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests
                .filter(r => requestTab === 'pending' ? r.status === 'pending' : r.status !== 'pending')
                .filter(r => {
                  if (planFilter === 'trial') return (r.plan || '').toLowerCase().includes('trial') || (r.plan || '').toLowerCase().includes('free');
                  if (planFilter === 'paid') return !((r.plan || '').toLowerCase().includes('trial') || (r.plan || '').toLowerCase().includes('free'));
                  return true;
                }).length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">No {requestTab} {planFilter !== 'all' ? planFilter : ''} requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}

      {mainTab === 'plan' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center no-print">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Plan Renewal Requests</h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Review plan upgrade requests from existing companies</p>
            </div>
            <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50">
              <button onClick={() => setPlanTab('pending')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${planTab === 'pending' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>Pending</button>
              <button onClick={() => setPlanTab('history')} className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${planTab === 'history' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>History</button>
            </div>
          </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Company Details</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Requested Plan</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Date requested</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Status</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {planRequests.filter(r => planTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{r.company_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">By: {r.owner_name || r.owner || 'Unknown'}</p>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">{r.requested_plan}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={14}/>
                      <span className="text-[10px] font-black uppercase tracking-widest">{formatDate(r.created_at)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : r.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-3 justify-center items-center">
                    {r.status === 'pending' ? (
                      <>
                        <button onClick={() => handlePlanAction(r.id, 'accept')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors tooltip" title="Approve Request">
                          <CheckCircle2 size={18}/>
                        </button>
                        <button onClick={() => handlePlanAction(r.id, 'reject')} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors tooltip" title="Reject Request">
                          <XCircle size={18}/>
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {planRequests.filter(r => planTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">No {planTab} plan requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}
    </div>
  );
};

export default Requests;
