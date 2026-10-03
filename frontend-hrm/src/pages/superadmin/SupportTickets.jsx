import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LifeBuoy, Clock, Eye, CheckCircle2, X, Building2, User, FileText, 
  Image as ImageIcon, Loader2, Paperclip, Send, Lock, MessageSquare, 
  ShieldCheck, AlertCircle, ArrowUpRight, Mail, Phone, Trash2, MessageCircle
} from 'lucide-react';
import saApi from '../../services/superAdminApi';
import { useUI } from '../../context/UIContext';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock size={14} />, dotColor: 'bg-amber-500' },
  seen: { label: 'In Discussion', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Eye size={14} />, dotColor: 'bg-blue-500' },
  solved: { label: 'Solved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={14} />, dotColor: 'bg-emerald-500' },
};

const SASupportTickets = () => {
  const { showAlert, showConfirm } = useUI();
  const [mainTab, setMainTab] = useState('tickets'); // 'tickets' | 'enquiries'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Enquiries State
  const [enquiries, setEnquiries] = useState([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [enquiryFilter, setEnquiryFilter] = useState('all');
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [enquirySearch, setEnquirySearch] = useState('');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [msgFile, setMsgFile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await saApi.get('/support-tickets');
      setTickets(res.data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEnquiries = useCallback(async () => {
    setEnquiriesLoading(true);
    try {
      const res = await saApi.get('/enquiries');
      setEnquiries(res.data || []);
    } catch (err) {
      console.error('Error fetching enquiries:', err);
    } finally {
      setEnquiriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchEnquiries();
  }, [fetchTickets, fetchEnquiries]);

  const fetchMessages = async (ticketId) => {
    setLoadingMessages(true);
    try {
      const res = await saApi.get(`/support-ticket/${ticketId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openTicketDetail = async (ticketId) => {
    setDetailLoading(true);
    setMessageText('');
    setMsgFile(null);
    try {
      const res = await saApi.get(`/support-ticket/${ticketId}`);
      setSelectedTicket(res.data);
      fetchMessages(ticketId);
    } catch (err) {
      console.error('Error fetching ticket detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const updateStatus = async (ticketId, newStatus) => {
    setUpdating(true);
    try {
      await saApi.put(`/support-ticket/${ticketId}/status`, { status: newStatus });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !msgFile) || sendingMessage || !selectedTicket) return;

    setSendingMessage(true);
    try {
      const formData = new FormData();
      formData.append('message', messageText.trim() || (msgFile ? 'Sent an attachment' : ''));
      if (msgFile) {
        formData.append('attachment', msgFile);
      }

      const res = await saApi.post(`/support-ticket/${selectedTicket.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.message) {
        setMessages(prev => [...prev, res.data.message]);
        setMessageText('');
        setMsgFile(null);

        if (selectedTicket.status === 'pending') {
          setSelectedTicket(prev => ({ ...prev, status: 'seen' }));
          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'seen' } : t));
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleMsgFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be under 10MB');
        return;
      }
      setMsgFile(file);
    }
  };

  const handleResolveEnquiry = async (id) => {
    try {
      await saApi.put(`/enquiry/${id}/resolve`);
      showAlert('Enquiry marked as resolved!', 'success');
      fetchEnquiries();
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry(prev => ({ ...prev, status: 'resolved' }));
      }
    } catch (err) {
      console.error('Failed to resolve enquiry:', err);
      showAlert('Failed to resolve enquiry.', 'error');
    }
  };

  const handleDeleteEnquiry = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Enquiry',
      message: 'Are you sure you want to delete this enquiry? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      try {
        await saApi.delete(`/enquiry/${id}`);
        showAlert('Enquiry deleted successfully.', 'success');
        fetchEnquiries();
        if (selectedEnquiry && selectedEnquiry.id === id) {
          setSelectedEnquiry(null);
        }
      } catch (err) {
        console.error('Failed to delete enquiry:', err);
        showAlert('Failed to delete enquiry.', 'error');
      }
    }
  };

  const filteredTickets = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  const counts = {
    all: tickets.length,
    pending: tickets.filter(t => t.status === 'pending').length,
    seen: tickets.filter(t => t.status === 'seen').length,
    solved: tickets.filter(t => t.status === 'solved').length,
  };

  const filteredEnquiries = enquiries.filter(e => {
    const matchesFilter = enquiryFilter === 'all' ? true : e.status === enquiryFilter;
    const matchesSearch = enquirySearch.trim() === '' || 
      (e.name && e.name.toLowerCase().includes(enquirySearch.toLowerCase())) ||
      (e.email && e.email.toLowerCase().includes(enquirySearch.toLowerCase())) ||
      (e.phone && e.phone.includes(enquirySearch)) ||
      (e.subject && e.subject.toLowerCase().includes(enquirySearch.toLowerCase())) ||
      (e.message && e.message.toLowerCase().includes(enquirySearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const pendingEnquiryCount = enquiries.filter(e => e.status !== 'resolved').length;

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatMsgTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <LifeBuoy size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Support & Inquiries Hub</h1>
          <p className="text-sm text-slate-500">Manage client tickets and website/login help enquiries</p>
        </div>
      </div>

      {/* Main View Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200/80">
        <button
          onClick={() => setMainTab('tickets')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            mainTab === 'tickets' 
              ? 'bg-white text-violet-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LifeBuoy size={15} />
          <span>Client Support Tickets ({tickets.length})</span>
        </button>

        <button
          onClick={() => setMainTab('enquiries')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer relative ${
            mainTab === 'enquiries' 
              ? 'bg-white text-violet-700 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail size={15} />
          <span>Website & Login Enquiries ({enquiries.length})</span>
          {pendingEnquiryCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {pendingEnquiryCount} New
            </span>
          )}
        </button>
      </div>

      {/* ─── TAB 1: CLIENT SUPPORT TICKETS ─── */}
      {mainTab === 'tickets' && (
        <div className="space-y-4">
          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'seen', 'solved'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'All Tickets' : f === 'seen' ? 'In Discussion' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            ))}
          </div>

          {/* Tickets Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-violet-500" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <LifeBuoy size={48} className="mb-3 opacity-40" />
                <p className="font-semibold text-base">No tickets found</p>
                <p className="text-xs mt-1">There are no tickets matching this filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Ticket #</th>
                      <th className="px-5 py-3.5">Company</th>
                      <th className="px-5 py-3.5">Issue</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((ticket, idx) => {
                      const status = statusConfig[ticket.status] || statusConfig.pending;
                      return (
                        <motion.tr
                          key={ticket.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-5 py-4 font-mono font-bold text-violet-600 text-xs">
                            #{ticket.id}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 size={15} className="text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-800">{ticket.company_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="max-w-xs">
                              <p className="font-semibold text-slate-800 truncate">{ticket.subject || ticket.title}</p>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{ticket.description || ticket.message}</p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                            {formatDate(ticket.created_at)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => openTicketDetail(ticket.id)}
                              className="px-3.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 font-semibold rounded-xl text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={14} />
                              <span>View & Chat</span>
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: PUBLIC & LOGIN ENQUIRIES ─── */}
      {mainTab === 'enquiries' && (
        <div className="space-y-4">
          {/* Controls Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'all', label: 'All Enquiries', count: enquiries.length },
                { id: 'pending', label: 'Pending', count: enquiries.filter(e => e.status !== 'resolved').length },
                { id: 'resolved', label: 'Resolved', count: enquiries.filter(e => e.status === 'resolved').length }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEnquiryFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    enquiryFilter === f.id
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                value={enquirySearch}
                onChange={e => setEnquirySearch(e.target.value)}
                placeholder="Search by name, email, subject..."
                className="w-full sm:w-64 pl-3.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              />
            </div>
          </div>

          {/* Enquiries Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {enquiriesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-violet-500" />
              </div>
            ) : filteredEnquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Mail size={48} className="mb-3 opacity-40" />
                <p className="font-semibold text-base">No enquiries found</p>
                <p className="text-xs mt-1">Website contact & login help enquiries will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Sender</th>
                      <th className="px-5 py-3.5">Contact Details</th>
                      <th className="px-5 py-3.5">Subject & Message</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEnquiries.map((enq, idx) => {
                      const isResolved = enq.status === 'resolved';
                      const cleanPhone = (enq.phone || '').replace(/[^0-9]/g, '');

                      return (
                        <motion.tr
                          key={enq.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-black text-xs flex items-center justify-center shrink-0">
                                {enq.name ? enq.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <span className="font-bold text-slate-800">{enq.name}</span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Mail size={13} className="text-slate-400" />
                              <a href={`mailto:${enq.email}`} className="hover:text-violet-600 hover:underline">{enq.email}</a>
                            </div>
                            {enq.phone && (
                              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                <Phone size={13} className="text-slate-400" />
                                <span>{enq.phone}</span>
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="max-w-xs">
                              <p className="font-bold text-slate-800 text-xs truncate">{enq.subject}</p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">{enq.message}</p>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isResolved 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isResolved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              {isResolved ? 'Resolved' : 'Pending'}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                            {formatDate(enq.created_at)}
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setSelectedEnquiry(enq)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                title="View Enquiry Details"
                              >
                                <Eye size={15} />
                              </button>

                              {/* WhatsApp Direct */}
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${enq.name}, replying to your enquiry regarding: ${enq.subject}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors cursor-pointer"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageCircle size={15} />
                                </a>
                              )}

                              {/* Mark Resolved */}
                              {!isResolved && (
                                <button
                                  onClick={() => handleResolveEnquiry(enq.id)}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                                  title="Mark Resolved"
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteEnquiry(enq.id)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Delete Enquiry"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ENQUIRY DETAILS MODAL ─── */}
      <AnimatePresence>
        {selectedEnquiry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedEnquiry(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-black">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Public Enquiry Details</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Submitted on {formatDate(selectedEnquiry.created_at)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEnquiry(null)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sender Name</span>
                    <strong className="text-slate-800 text-sm">{selectedEnquiry.name}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                      selectedEnquiry.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {selectedEnquiry.status === 'resolved' ? 'Resolved' : 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                    <a href={`mailto:${selectedEnquiry.email}`} className="text-violet-600 font-bold hover:underline">{selectedEnquiry.email}</a>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone / Mobile</span>
                    <span className="text-slate-800 font-bold">{selectedEnquiry.phone || 'Not provided'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Subject</span>
                  <p className="text-sm font-extrabold text-slate-800 bg-violet-50/50 p-3 rounded-xl border border-violet-100">
                    {selectedEnquiry.subject}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Message Content</span>
                  <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedEnquiry.message}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {selectedEnquiry.phone && (
                      <a
                        href={`https://wa.me/${selectedEnquiry.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${selectedEnquiry.name}, we received your enquiry regarding ${selectedEnquiry.subject}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                    <a
                      href={`mailto:${selectedEnquiry.email}?subject=${encodeURIComponent(`Re: ${selectedEnquiry.subject}`)}`}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Mail size={14} /> Send Email
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedEnquiry.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolveEnquiry(selectedEnquiry.id)}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <CheckCircle2 size={14} /> Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TICKET DETAIL / CHAT MODAL ─── */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto"
            onClick={() => setSelectedTicket(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
            >
              {detailLoading ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={36} className="animate-spin text-violet-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Ticket Details...</p>
                </div>
              ) : (
                <>
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-mono font-bold text-xs">
                        #{selectedTicket.id}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">{selectedTicket.subject || selectedTicket.title}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                          <Building2 size={12} /> {selectedTicket.company_name} • {formatDate(selectedTicket.created_at)}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>

                  {/* Modal Body & Chat */}
                  <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                    {/* Ticket Status Bar */}
                    <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${(statusConfig[selectedTicket.status] || statusConfig.pending).color}`}>
                          {(statusConfig[selectedTicket.status] || statusConfig.pending).label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedTicket.status === 'pending' && (
                          <button
                            disabled={updating}
                            onClick={() => updateStatus(selectedTicket.id, 'seen')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Eye size={13} /> Accept & Unlock Chat
                          </button>
                        )}
                        {selectedTicket.status !== 'solved' && (
                          <button
                            disabled={updating}
                            onClick={() => updateStatus(selectedTicket.id, 'solved')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} /> Mark Solved
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Original Issue Description */}
                    <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-violet-700 block mb-1.5">Original Issue Description:</span>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedTicket.description || selectedTicket.message}</p>
                    </div>

                    {/* Chat Messages */}
                    {selectedTicket.status !== 'pending' && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block ml-1">Live Discussion:</span>
                        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 min-h-[160px] max-h-[260px] overflow-y-auto space-y-3 custom-scrollbar">
                          {loadingMessages ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 size={24} className="animate-spin text-violet-500" />
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="text-center py-6 text-slate-400">
                              <p className="text-xs font-semibold">No messages in discussion yet.</p>
                              <p className="text-[11px] mt-0.5">Type below to reply directly to {selectedTicket.company_name}.</p>
                            </div>
                          ) : (
                            messages.map((msg, i) => {
                              const isMe = msg.sender_role === 'superadmin';
                              return (
                                <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                  <div className="flex items-center gap-1.5 mb-1 px-1">
                                    <span className="text-[10px] font-bold text-slate-500">
                                      {isMe ? 'You (Super Admin)' : msg.sender_name || 'Company Admin'}
                                    </span>
                                    <span className="text-[9px] text-slate-400">• {formatMsgTime(msg.created_at)}</span>
                                  </div>
                                  <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                                    isMe 
                                      ? 'bg-violet-600 text-white rounded-tr-none' 
                                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                                  }`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                    {msg.attachment_url && (
                                      <div className="mt-2 pt-1.5 border-t border-white/20">
                                        <a
                                          href={msg.attachment_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 ${
                                            isMe ? 'text-violet-100 hover:text-white' : 'text-violet-600 hover:text-violet-800'
                                          }`}
                                        >
                                          <Paperclip size={12} />
                                          <span>Attachment</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={chatBottomRef} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer / Chat Input Bar */}
                  <div className="px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
                    {selectedTicket.status === 'solved' ? (
                      <div className="flex items-center justify-center gap-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                        <Lock size={14} />
                        <span>This ticket is resolved. Discussion is now read-only.</span>
                      </div>
                    ) : selectedTicket.status === 'pending' ? (
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Click 'Accept & Unlock Chat' above to start communication.</span>
                        <button
                          onClick={() => setSelectedTicket(null)}
                          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-xl cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="space-y-2">
                        {msgFile && (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
                            <span className="truncate max-w-[300px] flex items-center gap-1.5">
                              <Paperclip size={13} /> {msgFile.name}
                            </span>
                            <button type="button" onClick={() => setMsgFile(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <label className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer transition-colors shrink-0" title="Attach file">
                            <Paperclip size={16} />
                            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleMsgFileChange} className="hidden" />
                          </label>
                          <input
                            type="text"
                            placeholder="Type reply to company admin..."
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                          />
                          <button
                            type="submit"
                            disabled={sendingMessage || (!messageText.trim() && !msgFile)}
                            className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                          >
                            {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SASupportTickets;
