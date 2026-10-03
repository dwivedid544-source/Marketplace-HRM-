import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Mail, CheckCircle2, Trash2, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';

const Enquiries = () => {
  const { showAlert, showConfirm } = useUI();
  const { formatDate } = useSettings();
  const [enquiries, setEnquiries] = useState([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const fetchEnquiries = async () => {
    try {
      const res = await api.get('/superadmin/enquiries');
      setEnquiries(res.data);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      showAlert('Failed to fetch enquiries', 'error');
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.put(`/superadmin/enquiry/${id}/resolve`);
      showAlert('Enquiry marked as resolved', 'success');
      fetchEnquiries();
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry({ ...selectedEnquiry, status: 'resolved' });
      }
    } catch (err) {
      console.error(err);
      showAlert('Error resolving enquiry', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Enquiry',
      message: 'Are you sure you want to delete this enquiry? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    
    if (confirmed) {
      try {
        await api.delete(`/superadmin/enquiry/${id}`);
        showAlert('Enquiry deleted successfully', 'success');
        fetchEnquiries();
        if (selectedEnquiry && selectedEnquiry.id === id) setSelectedEnquiry(null);
      } catch (err) {
        console.error(err);
        showAlert('Error deleting enquiry', 'error');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showConfirm({
      title: 'Delete Selected Enquiries',
      message: `Are you sure you want to delete ${selectedIds.length} selected enquiries?`,
      confirmText: 'Delete All',
      type: 'danger'
    });
    
    if (confirmed) {
      try {
        await Promise.all(selectedIds.map(id => api.delete(`/superadmin/enquiry/${id}`)));
        showAlert(`${selectedIds.length} enquiries deleted`, 'success');
        fetchEnquiries();
      } catch (err) {
        console.error(err);
        showAlert('Error deleting some enquiries', 'error');
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(enquiries.map(enq => enq.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Support Enquiries</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Manage user messages and support tickets</p>
        </div>
        {selectedIds.length > 0 && (
          <button 
            onClick={handleBulkDelete} 
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm"
          >
            <Trash2 size={14} /> Delete Selected ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="p-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                    checked={enquiries.length > 0 && selectedIds.length === enquiries.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Sender Details</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Subject</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Date</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Status</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {enquiries.map(e => (
                <tr key={e.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(e.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4 cursor-pointer"
                      checked={selectedIds.includes(e.id)}
                      onChange={() => handleSelect(e.id)}
                    />
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{e.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{e.email}</p>
                    {e.phone && <p className="text-xs text-slate-500">{e.phone}</p>}
                  </td>
                  <td className="p-4 font-semibold text-slate-700 max-w-xs truncate">{e.subject}</td>
                  <td className="p-4 text-xs font-medium text-slate-500">{formatDate(e.created_at)}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${e.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-3 justify-center items-center">
                    <button onClick={() => setSelectedEnquiry(e)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip" title="View Message">
                      <Eye size={16}/>
                    </button>
                    {e.status === 'pending' && (
                      <button onClick={() => handleResolve(e.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors tooltip" title="Mark Resolved">
                        <CheckCircle2 size={16}/>
                      </button>
                    )}
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors tooltip" title="Delete">
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
              {enquiries.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">No enquiries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedEnquiry && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={() => setSelectedEnquiry(null)} />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Enquiry Details</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From: {selectedEnquiry.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEnquiry(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                      <p className="font-bold text-slate-800 text-sm truncate"><a href={`mailto:${selectedEnquiry.email}`} className="text-primary hover:underline">{selectedEnquiry.email}</a></p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Number</p>
                      <p className="font-bold text-slate-800 text-sm">
                        {selectedEnquiry.phone ? (
                          <a href={`tel:${selectedEnquiry.phone}`} className="text-primary hover:underline">{selectedEnquiry.phone}</a>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Not provided</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date Submitted</p>
                      <p className="font-bold text-slate-800 text-sm">{formatDate(selectedEnquiry.created_at)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject</p>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="font-bold text-slate-800">{selectedEnquiry.subject}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message</p>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selectedEnquiry.message}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                  {selectedEnquiry.status === 'pending' && (
                    <button onClick={() => handleResolve(selectedEnquiry.id)} className="btn-primary px-5 py-2 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={14} /> Mark as Resolved
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedEnquiry(null)} className="px-5 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-200 rounded-xl transition-colors uppercase tracking-widest">Close</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Enquiries;
