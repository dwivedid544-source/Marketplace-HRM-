import React, { useState, useEffect } from 'react';
import api from '../utils/axios';
import { useUI } from '../context/UIContext';
import { useSettings } from '../context/SettingsContext';
import {
  Megaphone,
  User,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Search,
  Check,
  Zap,
  Filter,
  RefreshCw,
  Eye,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BroadcastMessaging = () => {
  const { showAlert } = useUI();
  const { t } = useSettings();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('compose'); // 'compose' | 'history'

  // Data from backend
  const [recipientsData, setRecipientsData] = useState({
    employees: [],
    departments: [],
    channels: {
      whatsapp: { connected: false, phoneNumber: null },
      email: { configured: false, senderEmail: '', senderName: '' }
    }
  });

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Form State
  const [messageType, setMessageType] = useState('broadcast'); // 'broadcast' | 'personal'
  const [channels, setChannels] = useState('both'); // 'whatsapp' | 'email' | 'both'
  const [targetAudience, setTargetAudience] = useState('all'); // 'all' | 'department' | 'selected'
  const [targetDepartment, setTargetDepartment] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [personalEmployeeId, setPersonalEmployeeId] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [priority, setPriority] = useState('normal'); // 'normal' | 'important' | 'urgent'

  // Search & Filter
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    fetchRecipientsData();
  }, []);

  const fetchRecipientsData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messaging/recipients');
      if (res.data.success) {
        setRecipientsData(res.data);
        if (res.data.departments.length > 0 && !targetDepartment) {
          setTargetDepartment(res.data.departments[0]);
        }
        if (res.data.employees.length > 0 && !personalEmployeeId) {
          setPersonalEmployeeId(res.data.employees[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Error fetching recipients data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/messaging/history');
      if (res.data.success) {
        setHistory(res.data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubTabChange = (tab) => {
    setActiveSubTab(tab);
    if (tab === 'history') {
      fetchHistory();
    }
  };

  // Compute selected recipients count
  const getSelectedRecipients = () => {
    if (messageType === 'personal') {
      return recipientsData.employees.filter(e => e.id.toString() === personalEmployeeId.toString());
    }
    if (targetAudience === 'all') {
      return recipientsData.employees;
    }
    if (targetAudience === 'department') {
      return recipientsData.employees.filter(e => e.department === targetDepartment);
    }
    if (targetAudience === 'selected') {
      return recipientsData.employees.filter(e => selectedEmployeeIds.includes(e.id));
    }
    return [];
  };

  const targetList = getSelectedRecipients();

  const handleToggleSelectEmployee = (id) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter(item => item !== id));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filtered = filteredEmployees.map(e => e.id);
    const allSelected = filtered.every(id => selectedEmployeeIds.includes(id));
    if (allSelected) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter(id => !filtered.includes(id)));
    } else {
      setSelectedEmployeeIds([...new Set([...selectedEmployeeIds, ...filtered])]);
    }
  };

  const insertVariable = (variableTag) => {
    setMessageText(prev => prev + ` ${variableTag}`);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      showAlert(t('Please enter a message subject / title.'), 'warning');
      return;
    }
    if (!messageText.trim()) {
      showAlert(t('Please enter the message content.'), 'warning');
      return;
    }
    if (messageType === 'personal' && !personalEmployeeId) {
      showAlert(t('Please select an employee to receive this message.'), 'warning');
      return;
    }
    if (messageType === 'broadcast' && targetAudience === 'selected' && selectedEmployeeIds.length === 0) {
      showAlert(t('Please select at least one employee.'), 'warning');
      return;
    }
    if (targetList.length === 0) {
      showAlert(t('No recipients found for the selected criteria.'), 'warning');
      return;
    }

    setSending(true);
    try {
      const payload = {
        message_type: messageType,
        channels: channels,
        target_audience: messageType === 'personal' ? 'individual' : targetAudience,
        target_department: targetDepartment,
        target_employee_ids: messageType === 'personal' ? [parseInt(personalEmployeeId)] : (targetAudience === 'selected' ? selectedEmployeeIds : targetList.map(e => e.id)),
        subject: subject.trim(),
        message_text: messageText.trim(),
        priority: priority
      };

      const res = await api.post('/messaging/send', payload);
      if (res.data.success) {
        showAlert(
          `${t('Messages sent successfully!')} (${res.data.stats.totalRecipients} ${t('recipients')})`,
          'success'
        );
        // Reset form
        setSubject('');
        setMessageText('');
        setSelectedEmployeeIds([]);
      } else {
        showAlert(res.data.error || t('Failed to send messages.'), 'error');
      }
    } catch (err) {
      showAlert(err.response?.data?.error || t('Error sending messages.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const filteredEmployees = recipientsData.employees.filter(e => {
    const q = empSearch.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.custom_id?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3.5 rounded-2xl text-primary shadow-sm">
              <Megaphone size={26} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">{t('Announcements & Messaging')}</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {t('Broadcast company-wide notices or send direct personal messages via Email and WhatsApp.')}
              </p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => handleSubTabChange('compose')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'compose'
                  ? 'bg-white text-primary shadow-md shadow-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Send size={15} />
              {t('Compose & Send')}
            </button>
            <button
              type="button"
              onClick={() => handleSubTabChange('history')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'history'
                  ? 'bg-white text-primary shadow-md shadow-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={15} />
              {t('Transmission History')}
            </button>
          </div>
        </div>

        {/* Live Channel Status Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            recipientsData.channels?.whatsapp?.connected
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-amber-50/70 border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                recipientsData.channels?.whatsapp?.connected ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-800">{t('WhatsApp Channel')}</h5>
                <p className="text-[11px] font-bold text-slate-500">
                  {recipientsData.channels?.whatsapp?.connected
                    ? `+${recipientsData.channels.whatsapp.phoneNumber || ''}`
                    : t('Not connected (Go to WhatsApp tab to link)')}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              recipientsData.channels?.whatsapp?.connected
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              {recipientsData.channels?.whatsapp?.connected ? t('Connected') : t('Offline')}
            </span>
          </div>

          <div className="p-4 rounded-2xl border bg-sky-50/70 border-sky-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center">
                <Mail size={18} />
              </div>
              <div>
                <h5 className="text-xs font-black text-slate-800">{t('Email Channel')}</h5>
                <p className="text-[11px] font-bold text-slate-500">
                  {recipientsData.channels?.email?.configured
                    ? `${recipientsData.channels.email.senderName} (${recipientsData.channels.email.senderEmail})`
                    : t('System Default SMTP Active')}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
              {recipientsData.channels?.email?.configured ? t('Custom SMTP') : t('System Active')}
            </span>
          </div>
        </div>
      </div>

      {activeSubTab === 'compose' && (
        <form onSubmit={handleSendMessage} className="space-y-6">
          {/* Step 1: Mode & Target Selector */}
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">1</div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('Select Message Mode & Audience')}</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mode: Broadcast */}
              <button
                type="button"
                onClick={() => setMessageType('broadcast')}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
                  messageType === 'broadcast'
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01]'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-xl ${messageType === 'broadcast' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Megaphone size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-800">{t('Company Announcement (Broadcast)')}</h5>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {t('Send official notice to all staff or a selected department.')}
                  </p>
                </div>
              </button>

              {/* Mode: Personal Direct Message */}
              <button
                type="button"
                onClick={() => {
                  setMessageType('personal');
                  if (!personalEmployeeId && recipientsData.employees.length > 0) {
                    setPersonalEmployeeId(recipientsData.employees[0].id.toString());
                  }
                }}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-4 ${
                  messageType === 'personal'
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10 scale-[1.01]'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`p-3 rounded-xl ${messageType === 'personal' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <User size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-800">{t('Direct Personal Message')}</h5>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {t('Send private 1-to-1 alert or notice to an individual employee.')}
                  </p>
                </div>
              </button>
            </div>

            {/* If Broadcast: Filter Audience */}
            {messageType === 'broadcast' ? (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">{t('Audience Scope:')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetAudience('all')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                      targetAudience === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t('All Staff')} ({recipientsData.employees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAudience('department')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                      targetAudience === 'department'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t('By Department')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAudience('selected')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                      targetAudience === 'selected'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t('Select Specific Staff')} ({selectedEmployeeIds.length})
                  </button>
                </div>

                {targetAudience === 'department' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Select Department')}</label>
                    <select
                      value={targetDepartment}
                      onChange={(e) => setTargetDepartment(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                    >
                      {recipientsData.departments.map(dept => (
                        <option key={dept} value={dept}>
                          {dept} ({recipientsData.employees.filter(e => e.department === dept).length} {t('members')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetAudience === 'selected' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          placeholder={t('Search employee by name, ID, department...')}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="text-xs font-bold text-primary hover:underline self-end sm:self-auto cursor-pointer"
                      >
                        {filteredEmployees.every(e => selectedEmployeeIds.includes(e.id)) ? t('Deselect All') : t('Select All Filtered')}
                      </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 p-2">
                      {filteredEmployees.map(emp => {
                        const isSelected = selectedEmployeeIds.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => handleToggleSelectEmployee(emp.id)}
                            className={`p-2 rounded-lg flex items-center justify-between text-xs font-bold cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected ? 'bg-primary border-primary text-white' : 'border-slate-300'
                              }`}>
                                {isSelected && <Check size={12} />}
                              </div>
                              <span>{emp.name}</span>
                              <span className="text-[10px] text-slate-400">({emp.department || 'General'})</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{emp.phone || emp.email || 'No contact'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* If Personal Message: Single Employee Dropdown */
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">{t('Select Recipient Employee:')}</label>
                {recipientsData.employees.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
                    ⚠️ {t('No active employees found in your company. Please ensure employees have status set to "active".')}
                  </div>
                ) : (
                  <select
                    value={personalEmployeeId}
                    onChange={(e) => setPersonalEmployeeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {recipientsData.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.role ? `(${emp.role})` : ''} - {emp.department || 'General'} {emp.phone ? `• 📞 ${emp.phone}` : ''} {emp.email ? `• ✉️ ${emp.email}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Target Summary Banner */}
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs font-bold text-indigo-900">
              <span className="flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                {t('Selected Targets:')} <strong>{targetList.length} {t('Employees')}</strong>
              </span>
              <span className="text-[10px] bg-white px-2.5 py-0.5 rounded-full text-indigo-600 border border-indigo-200 uppercase tracking-wider">
                {messageType === 'broadcast' ? t('Broadcast') : t('Personal')}
              </span>
            </div>
          </div>

          {/* Step 2: Channel & Priority */}
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">2</div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('Choose Delivery Channels & Priority')}</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Delivery Channels */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">{t('Dispatch Channels:')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannels('both')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      channels === 'both'
                        ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🌐 {t('Both Channels')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannels('whatsapp')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      channels === 'whatsapp'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💬 {t('WhatsApp Only')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannels('email')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      channels === 'email'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ✉️ {t('Email Only')}
                  </button>
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">{t('Priority Level:')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('normal')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      priority === 'normal'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    📢 {t('Normal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('important')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      priority === 'important'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ⚠️ {t('Important')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('urgent')}
                    className={`py-3 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                      priority === 'urgent'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🚨 {t('Urgent')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Message Content */}
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center">3</div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('Compose Message Content')}</h4>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Subject / Announcement Title')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('e.g. Office Closed on Monday / Q3 Performance Review')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Message Body')}</label>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{t('Insert tags:')}</span>
                    <button
                      type="button"
                      onClick={() => insertVariable('{name}')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px] cursor-pointer"
                    >
                      {'{name}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{company}')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px] cursor-pointer"
                    >
                      {'{company}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{department}')}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-mono text-[10px] cursor-pointer"
                    >
                      {'{department}'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows="6"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={t('Type your official announcement or personal note here... Supports multi-line and emojis.')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>

              {/* Preview Snippet */}
              {messageText && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <Eye size={14} /> {t('Live Preview Example (for first employee):')}
                  </div>
                  <div className="text-xs font-mono bg-white p-3 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-line leading-relaxed">
                    {messageText
                      .replace(/{name}/g, targetList[0]?.name || 'John Doe')
                      .replace(/{company}/g, 'Our Company')
                      .replace(/{department}/g, targetList[0]?.department || 'General')}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 font-medium">
                {t('Dispatches will be logged in Company Audit Records automatically.')}
              </p>
              <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sending ? <Zap size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{sending ? t('Transmitting...') : `${t('Dispatch Message to')} ${targetList.length} ${t('Staff')}`}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* History SubTab */}
      {activeSubTab === 'history' && (
        <div className="card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-base font-black text-slate-800">{t('Recent Announcement & Message Records')}</h4>
              <p className="text-xs text-slate-400 font-medium">{t('Audit log of previous company broadcasts and direct messages.')}</p>
            </div>
            <button
              type="button"
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="btn-secondary flex items-center gap-2 text-xs cursor-pointer"
            >
              <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
              {t('Refresh')}
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-12 text-center text-sm font-bold text-slate-400">
              {t('Loading transmission history...')}
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
              <Megaphone size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-500">{t('No announcements or messages recorded yet.')}</p>
              <p className="text-[11px] text-slate-400">{t('Sent broadcasts will appear here automatically with delivery stats.')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">{t('Date & Time')}</th>
                    <th className="p-3.5">{t('Type')}</th>
                    <th className="p-3.5">{t('Subject / Title')}</th>
                    <th className="p-3.5">{t('Target / Recipients')}</th>
                    <th className="p-3.5">{t('Channels')}</th>
                    <th className="p-3.5">{t('Delivery Stats')}</th>
                    <th className="p-3.5">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-500 font-medium whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          item.message_type === 'broadcast'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {item.message_type === 'broadcast' ? t('Broadcast') : t('Personal')}
                        </span>
                      </td>
                      <td className="p-3.5 font-black text-slate-800 max-w-xs truncate">
                        {item.subject}
                      </td>
                      <td className="p-3.5 text-slate-600 font-bold">
                        {item.target_audience === 'all'
                          ? `${t('All Staff')} (${item.total_recipients})`
                          : (item.target_department ? `${item.target_department} (${item.total_recipients})` : item.target_employee_name)}
                      </td>
                      <td className="p-3.5">
                        <span className="text-[11px] font-black uppercase text-slate-600">
                          {item.channels === 'both' ? '🌐 WA + Email' : (item.channels === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email')}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          {(item.channels === 'email' || item.channels === 'both') && (
                            <span className="text-sky-600">
                              ✉️ {item.email_sent_count}/{item.total_recipients}
                            </span>
                          )}
                          {(item.channels === 'whatsapp' || item.channels === 'both') && (
                            <span className="text-emerald-600">
                              💬 {item.whatsapp_sent_count}/{item.total_recipients}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryItem(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          {t('View')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Details Modal */}
      <AnimatePresence>
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-800">{selectedHistoryItem.subject}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary/10 text-primary">
                  {selectedHistoryItem.message_type}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-slate-500 font-bold">
                  <div>{t('Sender:')} <span className="text-slate-800">{selectedHistoryItem.sender_name}</span></div>
                  <div>{t('Date:')} <span className="text-slate-800">{new Date(selectedHistoryItem.created_at).toLocaleString()}</span></div>
                  <div>{t('Target:')} <span className="text-slate-800">{selectedHistoryItem.target_employee_name || selectedHistoryItem.target_audience}</span></div>
                  <div>{t('Priority:')} <span className="text-slate-800 uppercase">{selectedHistoryItem.priority}</span></div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('Message Content')}</label>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                    {selectedHistoryItem.message_text}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryItem(null)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  {t('Close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BroadcastMessaging;
