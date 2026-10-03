import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LifeBuoy, Plus, Send, Paperclip, X, Clock, Eye, CheckCircle2, 
  AlertCircle, FileText, Image as ImageIcon, Loader2, MessageSquare, 
  Lock, ArrowUpRight, ShieldCheck, User
} from 'lucide-react';
import api from '../../utils/axios';
import { useSettings } from '../../context/SettingsContext';

const statusConfig = {
  pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock size={14} />, dotColor: 'bg-amber-500' },
  seen: { label: 'In Discussion', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Eye size={14} />, dotColor: 'bg-blue-500' },
  solved: { label: 'Solved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={14} />, dotColor: 'bg-emerald-500' },
};

const SupportTickets = () => {
  const { t } = useSettings();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', message: '' });
  const [attachment, setAttachment] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Ticket & Chat State
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [msgFile, setMsgFile] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatBottomRef = useRef(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get('/support/tickets');
      setTickets(res.data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const fetchMessages = async (ticketId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/support/tickets/${ticketId}/messages`);
      setMessages(res.data.messages || []);
      if (res.data.ticket) {
        setSelectedTicket(res.data.ticket);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setMessageText('');
    setMsgFile(null);
    fetchMessages(ticket.id);
  };

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim() || !form.message.trim()) {
      setError('Title and message are required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('message', form.message);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const res = await api.post('/support/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(`Ticket ${res.data.ticketNumber} created successfully!`);
      setForm({ title: '', message: '' });
      setAttachment(null);
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
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

      const res = await api.post(`/support/tickets/${selectedTicket.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.message) {
        setMessages(prev => [...prev, res.data.message]);
        setMessageText('');
        setMsgFile(null);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        setError('Only JPG, PNG, and PDF files are allowed.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB.');
        return;
      }
      setAttachment(file);
      setError('');
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

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatMsgTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <LifeBuoy size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{t('Support Tickets')}</h1>
            <p className="text-sm text-slate-500">{t('Raise issues & communicate directly with Super Admin')}</p>
          </div>
        </div>

        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t('Cancel') : t('+ Raise Issue')}
        </button>
      </div>

      {/* Success / Error Alerts */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 size={16} /> {success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raise Issue Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-800">Raise New Issue</h2>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Issue Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Attendance not syncing / Payroll report error"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Issue Message *</label>
                <textarea
                  placeholder="Describe the issue in detail..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Attachment (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
                    <Paperclip size={16} />
                    {attachment ? attachment.name : 'Choose Screenshot / PDF'}
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
                  </label>
                  {attachment && (
                    <button type="button" onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-700">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Allowed: JPG, PNG, PDF (max 10MB)</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? t('Submitting...') : t('Submit Ticket')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{t('My Tickets')} ({tickets.length})</h2>
          <span className="text-xs text-slate-400">{t('Click any ticket to view discussion')}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-violet-500" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LifeBuoy size={40} className="mb-3 opacity-40" />
            <p className="font-medium">{t('No tickets yet')}</p>
            <p className="text-sm">{t('Click "Raise Issue" to create your first ticket')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket, idx) => {
              const status = statusConfig[ticket.status] || statusConfig.pending;
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => openTicketDetail(ticket)}
                  className="px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                          {ticket.ticket_number}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></span>
                          {status.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 group-hover:text-violet-600 transition-colors truncate">
                        {ticket.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.message}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                      {ticket.attachment_url && (
                        <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-[11px] font-medium">
                          <Paperclip size={12} /> File
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(ticket.created_at)}
                      </span>
                      <button className="px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors">
                        View & Chat
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Detail & 2-Way Chat Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedTicket(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl w-full sm:w-[90%] md:w-[60%] max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-sm">
                    <LifeBuoy size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wider uppercase text-slate-900">
                        {selectedTicket.ticket_number}
                      </span>
                      {(() => {
                        const st = statusConfig[selectedTicket.status] || statusConfig.pending;
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${st.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dotColor}`}></span>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Submitted {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedTicket(null)} 
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {/* Initial Issue Card */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Issue Details
                  </span>
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {selectedTicket.title}
                    </h3>
                    <div className="h-px bg-slate-100"></div>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.message}
                    </p>

                    {/* Initial Attachment */}
                    {selectedTicket.attachment_url && (
                      <div className="pt-2">
                        <a
                          href={selectedTicket.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200/70 rounded-xl text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors"
                        >
                          {selectedTicket.attachment_url.endsWith('.pdf') ? <FileText size={14} /> : <ImageIcon size={14} />}
                          <span>View Uploaded File</span>
                          <ArrowUpRight size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Way Discussion / Chat Stream */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={12} className="text-violet-500" />
                      Discussion with Super Admin
                    </span>
                    {messages.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        {messages.length} message{messages.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* If ticket is Pending: Notice that chat is locked */}
                  {selectedTicket.status === 'pending' && (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-center space-y-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                        <Clock size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-800">Awaiting Super Admin Review</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Your issue has been submitted to Super Admin. Direct conversation will unlock as soon as Super Admin accepts your ticket.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chat Messages Box */}
                  {selectedTicket.status !== 'pending' && (
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 min-h-[180px] max-h-[280px] overflow-y-auto space-y-3 custom-scrollbar">
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 size={24} className="animate-spin text-violet-500" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <p className="text-xs font-semibold">Discussion unlocked!</p>
                          <p className="text-[11px] mt-0.5">Type below to send a message to Super Admin.</p>
                        </div>
                      ) : (
                        messages.map((msg, i) => {
                          const isMe = msg.sender_role === 'admin';
                          return (
                            <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center gap-1.5 mb-1 px-1">
                                <span className="text-[10px] font-bold text-slate-500">
                                  {isMe ? 'You' : 'Super Admin'}
                                </span>
                                <span className="text-[9px] text-slate-400">• {formatMsgTime(msg.created_at)}</span>
                              </div>
                              <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
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
                  )}
                </div>
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
                    <span>Chat will unlock once Super Admin accepts this ticket.</span>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 rounded-xl"
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
                        <button type="button" onClick={() => setMsgFile(null)} className="text-red-500 hover:text-red-700">
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
                        placeholder="Type message to Super Admin..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || (!messageText.trim() && !msgFile)}
                        className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {sendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportTickets;
