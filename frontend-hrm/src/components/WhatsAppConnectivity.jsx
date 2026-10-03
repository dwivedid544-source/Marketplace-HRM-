import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/axios';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  Send,
  ShieldCheck,
  Smartphone,
  Info,
  Clock,
  UserCheck,
  FileText,
  DollarSign,
  Bell,
  Check,
  XCircle,
  Copy,
  Key,
  ArrowLeft,
  Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WhatsAppConnectivity = () => {
  const { showAlert, showConfirm } = useUI();
  const { user } = useAuth();
  const { t } = useSettings();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [connectionMethod, setConnectionMethod] = useState('qr'); // 'qr' or 'code'
  const [pairingCode, setPairingCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [statusData, setStatusData] = useState({
    status: 'DISCONNECTED',
    phone_number: null,
    qr_code: null,
    pairing_code: null,
    connected_at: null,
    last_seen_at: null,
    last_error: null,
    notify_attendance: true,
    notify_leaves: true,
    notify_claims: true,
    notify_payroll: true,
    notify_admin_alerts: true
  });

  const [preferences, setPreferences] = useState({
    notify_attendance: true,
    notify_leaves: true,
    notify_claims: true,
    notify_payroll: true,
    notify_admin_alerts: true
  });

  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Test Message Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Fetch initial status and logs
  const fetchStatus = async () => {
    try {
      const res = await api.get('/settings/whatsapp');
      if (res.data) {
        setStatusData(prev => ({
          ...prev,
          ...res.data
        }));
        if (res.data.pairing_code) {
          setPairingCode(res.data.pairing_code);
        }
        setPreferences({
          notify_attendance: res.data.notify_attendance !== false,
          notify_leaves: res.data.notify_leaves !== false,
          notify_claims: res.data.notify_claims !== false,
          notify_payroll: res.data.notify_payroll !== false,
          notify_admin_alerts: res.data.notify_admin_alerts !== false
        });
        if (res.data.status === 'CONNECTED' && res.data.phone_number) {
          setPhoneNumber(res.data.phone_number);
        } else if (res.data.status === 'DISCONNECTED') {
          setPhoneNumber('');
        }
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get('/settings/whatsapp/logs?limit=50');
      setLogs(res.data || []);
    } catch (err) {
      console.error('Error fetching WhatsApp logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Setup Socket.IO & Polling Fallback
  useEffect(() => {
    fetchStatus();
    fetchLogs();

    const backendUrl = import.meta.env.VITE_API_URL || (window.location.protocol + '//' + window.location.hostname + ':5001');
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (user?.company_id) {
        socket.emit('join_company', user.company_id);
      }
    });

    socket.on('whatsapp:status', (data) => {
      if (!data.company_id || data.company_id === user?.company_id) {
        setStatusData(prev => ({
          ...prev,
          ...data,
          status: data.status || prev.status
        }));
        if (data.status === 'CONNECTED') {
          setConnecting(false);
          showAlert('🎉 WhatsApp Connected Successfully!', 'success');
          fetchLogs();
        } else if (data.status === 'ERROR') {
          setConnecting(false);
          if (data.last_error) {
            showAlert(data.last_error, 'error');
          }
        }
      }
    });

    socket.on('whatsapp:qr', (data) => {
      if (data.qr) {
        setStatusData(prev => ({
          ...prev,
          status: 'QR_READY',
          qr_code: data.qr
        }));
        setConnecting(false);
      }
    });

    socket.on('whatsapp:pairing_code', (data) => {
      if (data.code) {
        setPairingCode(data.code);
        setStatusData(prev => ({
          ...prev,
          status: 'QR_READY',
          pairing_code: data.code
        }));
        setConnecting(false);
      }
    });

    return () => {
      if (socket) socket.disconnect();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [user?.company_id]);

  // Polling fallback when connecting or waiting for scan
  useEffect(() => {
    if (statusData.status === 'CONNECTING' || statusData.status === 'QR_READY') {
      pollTimerRef.current = setInterval(() => {
        fetchStatus();
      }, 2000);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [statusData.status]);

  // Handle Connect
  const handleConnect = async (method = connectionMethod) => {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanNumber || cleanNumber.length < 8) {
      showAlert('Please enter a valid WhatsApp number with country code (e.g. +91 9876543210)', 'error');
      return;
    }

    try {
      setConnecting(true);
      const res = await api.post('/settings/whatsapp/connect', {
        phoneNumber: cleanNumber,
        usePairingCode: method === 'code'
      });

      if (res.data.success) {
        setStatusData(prev => ({
          ...prev,
          status: res.data.status || 'CONNECTING',
          phone_number: cleanNumber
        }));
        showAlert(
          method === 'code'
            ? 'Generating WhatsApp pairing code...'
            : 'Generating fresh QR Code. Please scan with WhatsApp...',
          'info'
        );
      } else {
        showAlert(res.data.message || 'Failed to start connection', 'error');
        setConnecting(false);
      }
    } catch (err) {
      setConnecting(false);
      const msg = err.response?.data?.message || 'Failed to connect to WhatsApp';
      showAlert(msg, 'error');
    }
  };

  // Handle Go Back / Change Number
  const handleGoBack = async () => {
    try {
      await api.post('/settings/whatsapp/disconnect');
    } catch (e) {}
    setStatusData(prev => ({
      ...prev,
      status: 'DISCONNECTED',
      phone_number: null,
      qr_code: null,
      pairing_code: null,
      last_error: null
    }));
    setPhoneNumber('');
    setPairingCode(null);
    setConnecting(false);
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    const confirmed = await showConfirm({
      title: 'Disconnect WhatsApp Session',
      message: 'Are you sure you want to disconnect this WhatsApp account? Automated notifications will be paused until reconnected.',
      confirmText: 'Yes, Disconnect',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setDisconnecting(true);
      const res = await api.post('/settings/whatsapp/disconnect');
      if (res.data.success) {
        setStatusData(prev => ({
          ...prev,
          status: 'DISCONNECTED',
          phone_number: null,
          qr_code: null,
          pairing_code: null,
          last_error: null
        }));
        setPhoneNumber('');
        setPairingCode(null);
        showAlert('WhatsApp disconnected successfully.', 'success');
        fetchLogs();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to disconnect WhatsApp', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  // Handle Save Preferences
  const handleSavePreferences = async () => {
    try {
      setIsSavingPrefs(true);
      await api.put('/settings/whatsapp/preferences', preferences);
      showAlert('Notification preferences saved successfully!', 'success');
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to save preferences', 'error');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Handle Send Test Message
  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone) {
      showAlert('Please enter a recipient WhatsApp number.', 'error');
      return;
    }

    try {
      setIsSendingTest(true);
      const res = await api.post('/settings/whatsapp/test', {
        recipientPhone: testPhone,
        message: testMessage || undefined
      });

      if (res.data.success) {
        showAlert('Test WhatsApp message sent successfully!', 'success');
        setShowTestModal(false);
        setTestPhone('');
        setTestMessage('');
        fetchLogs();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to send test message.', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showAlert('Pairing code copied to clipboard!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="card p-12 text-center flex flex-col items-center justify-center">
        <RefreshCw size={32} className="text-emerald-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Loading WhatsApp Integration...</p>
      </div>
    );
  }

  const isConnected = statusData.status === 'CONNECTED';
  const isQRReady = statusData.status === 'QR_READY' || (statusData.status === 'CONNECTING' && (statusData.qr_code || pairingCode));

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="card relative overflow-hidden bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-slate-50 border-emerald-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <MessageSquare size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{t('WhatsApp Connectivity')}</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    isConnected
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : isQRReady
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected
                        ? 'bg-emerald-500 animate-pulse'
                        : isQRReady
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-slate-400'
                    }`}
                  />
                  {isConnected ? t('Connected') : isQRReady ? t('Ready to Link') : t('Disconnected')}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {t('Link your official WhatsApp account to send real-time role-based alerts for attendance, leaves, claims, and payroll.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            {isConnected && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setTestPhone(statusData.phone_number || '');
                    setShowTestModal(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Send size={14} />
                  <span>{t('SEND TEST MESSAGE')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {disconnecting ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
                  <span>{t('DISCONNECT')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Connection Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR or Connected Status */}
        <div className="lg:col-span-7">
          <div className="card h-full flex flex-col justify-between">
            {isConnected ? (
              // Connected State
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-4 p-5 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-emerald-900">{t('WhatsApp Gateway Active')}</h4>
                    <p className="text-xs font-bold text-emerald-700">
                      {t('Messages are transmitting directly from your linked WhatsApp number.')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('SENDER NUMBER')}</span>
                    <p className="text-base font-black text-slate-800 mt-1 font-mono">
                      +{statusData.phone_number || phoneNumber || 'Configured'}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('CONNECTED SINCE')}</span>
                    <p className="text-xs font-bold text-slate-700 mt-1.5">
                      {statusData.connected_at ? new Date(statusData.connected_at).toLocaleString() : 'Active Session'}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-xs font-medium text-slate-600 leading-relaxed">
                    {t("Tenant Isolation Active: Notifications are securely isolated. Your staff only receive messages dispatched through your company's dedicated session.")}
                  </p>
                </div>
              </div>
            ) : isQRReady ? (
              // Ready to Link (QR Code or Pairing Code)
              <div className="text-center py-4 space-y-5">
                {/* Method Switcher */}
                <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionMethod('qr');
                      handleConnect('qr');
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      connectionMethod === 'qr'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <QrCode size={14} />
                    <span>Scan QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionMethod('code');
                      handleConnect('code');
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      connectionMethod === 'code'
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Key size={14} />
                    <span>8-Digit Code</span>
                  </button>
                </div>

                {connectionMethod === 'code' && pairingCode ? (
                  // Pairing Code Display
                  <div className="space-y-4 max-w-sm mx-auto">
                    <div className="p-6 bg-emerald-50/60 border-2 border-emerald-300 rounded-3xl space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                        Enter this code on your WhatsApp phone:
                      </span>
                      <div className="text-3xl font-black font-mono tracking-widest text-emerald-700 bg-white py-3 px-4 rounded-2xl shadow-inner border border-emerald-200 flex items-center justify-center gap-2">
                        <span>{pairingCode}</span>
                        <button
                          onClick={copyCodeToClipboard}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Copy Code"
                        >
                          {copiedCode ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      Open WhatsApp &rarr; <strong>Linked Devices</strong> &rarr; Tap <strong>Link with Phone Number</strong> &rarr; Enter code.
                    </p>
                  </div>
                ) : (
                  // QR Code Display
                  <div className="space-y-4">
                    <div className="max-w-xs mx-auto">
                      <div className="p-4 bg-white border-2 border-emerald-400 rounded-3xl shadow-xl inline-block relative">
                        {statusData.qr_code ? (
                          <img
                            src={statusData.qr_code}
                            alt="WhatsApp QR Code"
                            className="w-56 h-56 mx-auto object-contain rounded-2xl"
                          />
                        ) : (
                          <div className="w-56 h-56 flex flex-col items-center justify-center bg-slate-50 rounded-2xl">
                            <RefreshCw size={28} className="text-emerald-500 animate-spin mb-2" />
                            <span className="text-[11px] font-bold text-slate-400">Loading live QR...</span>
                          </div>
                        )}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                          Scan with WhatsApp
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-black text-slate-800">Scan QR Code from WhatsApp Mobile</h4>
                      <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
                        Open WhatsApp on your phone &rarr; <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong> &rarr; Scan this QR.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleGoBack}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Change Number / Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConnect(connectionMethod)}
                    disabled={connecting}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} className={connecting ? 'animate-spin' : ''} />
                    <span>Refresh {connectionMethod === 'code' ? 'Code' : 'QR'}</span>
                  </button>
                </div>
              </div>
            ) : (
              // Disconnected State / Phone Input
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConnect('qr');
                }}
                className="space-y-6 py-2"
              >
                <div>
                  <h4 className="text-base font-black text-slate-800">Connect Your WhatsApp Account</h4>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    Enter the WhatsApp phone number that will act as the automated message sender for your company.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    WhatsApp Phone Number (with Country Code)
                  </label>
                  <div className="relative">
                    <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400 ml-1">
                    Include country code (e.g. 91 for India, 1 for USA/Canada, 27 for South Africa).
                  </p>
                </div>

                {statusData.last_error && (
                  <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-rose-700">{statusData.last_error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionMethod('qr');
                      handleConnect('qr');
                    }}
                    disabled={connecting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {connecting && connectionMethod === 'qr' ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Generating QR...</span>
                      </>
                    ) : (
                      <>
                        <QrCode size={16} />
                        <span>Connect with QR</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConnectionMethod('code');
                      handleConnect('code');
                    }}
                    disabled={connecting}
                    className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {connecting && connectionMethod === 'code' ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <>
                        <Key size={16} />
                        <span>Use 8-Digit Code</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Quick Setup Instructions */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> End-to-End Encrypted Sessions
              </span>
              <span>Web / Multi-Device Gateway</span>
            </div>
          </div>
        </div>

        {/* Right Column: Notification Preferences */}
        <div className="lg:col-span-5">
          <div className="card h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800">{t('Notification Triggers')}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t('ROLE-BASED WHATSAPP DISPATCH')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Attendance */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <UserCheck size={18} className="text-emerald-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{t('Attendance Marking')}</h5>
                      <p className="text-[10px] font-medium text-slate-500">{t('Send punch confirmations to staff')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(prev => ({ ...prev, notify_attendance: !prev.notify_attendance }))}
                    className={`w-11 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                      preferences.notify_attendance ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div
                      animate={{ x: preferences.notify_attendance ? 20 : 0 }}
                      className="h-4 w-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Leaves */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-indigo-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{t('Leave Requests & Status')}</h5>
                      <p className="text-[10px] font-medium text-slate-500">{t('Approvals, rejections & admin alerts')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(prev => ({ ...prev, notify_leaves: !prev.notify_leaves }))}
                    className={`w-11 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                      preferences.notify_leaves ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div
                      animate={{ x: preferences.notify_leaves ? 20 : 0 }}
                      className="h-4 w-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Expense Claims */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <DollarSign size={18} className="text-amber-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{t('Expense Claims')}</h5>
                      <p className="text-[10px] font-medium text-slate-500">{t('Claim submissions & status changes')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(prev => ({ ...prev, notify_claims: !prev.notify_claims }))}
                    className={`w-11 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                      preferences.notify_claims ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div
                      animate={{ x: preferences.notify_claims ? 20 : 0 }}
                      className="h-4 w-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Payroll */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-cyan-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{t('Payroll Payslips')}</h5>
                      <p className="text-[10px] font-medium text-slate-500">{t('Notify employees on monthly salary release')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(prev => ({ ...prev, notify_payroll: !prev.notify_payroll }))}
                    className={`w-11 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                      preferences.notify_payroll ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div
                      animate={{ x: preferences.notify_payroll ? 20 : 0 }}
                      className="h-4 w-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Admin Alerts */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={18} className="text-rose-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{t('Admin System Alerts')}</h5>
                      <p className="text-[10px] font-medium text-slate-500">{t('Receive instant alerts on Admin WhatsApp')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreferences(prev => ({ ...prev, notify_admin_alerts: !prev.notify_admin_alerts }))}
                    className={`w-11 h-6 rounded-full relative transition-all p-1 shadow-inner cursor-pointer ${
                      preferences.notify_admin_alerts ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <motion.div
                      animate={{ x: preferences.notify_admin_alerts ? 20 : 0 }}
                      className="h-4 w-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingPrefs ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSavingPrefs ? t('Saving Preferences...') : t('SAVE NOTIFICATION RULES')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Message Delivery Logs */}
      <div className="card">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800">{t('WhatsApp Delivery Logs')}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t('Recent Outbound Transmissions')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
            <span>{t('Refresh')}</span>
          </button>
        </div>

        {logs.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <div 
              className="overflow-y-auto max-h-[260px] divide-y divide-slate-100"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#94a3b8 #f1f5f9'
              }}
            >
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-20 shadow-sm bg-slate-100">
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100">
                    <th className="py-3 px-3.5 bg-slate-100">Recipient</th>
                    <th className="py-3 px-3.5 bg-slate-100">Role</th>
                    <th className="py-3 px-3.5 bg-slate-100">Event</th>
                    <th className="py-3 px-3.5 bg-slate-100">Status</th>
                    <th className="py-3 px-3.5 bg-slate-100">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-slate-800">
                        <div>{log.recipient_name || 'Staff'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">+{log.recipient_phone}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">
                          {log.recipient_role || 'employee'}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-700">
                        {log.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : log.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 font-medium whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
            <Info size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No WhatsApp messages dispatched yet</p>
            <p className="text-[11px] text-slate-400 mt-1">Logs will appear here when attendance punches or alerts are triggered.</p>
          </div>
        )}
      </div>

      {/* Test Message Modal */}
      <AnimatePresence>
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Send size={18} />
                  </div>
                  <h4 className="text-base font-black text-slate-800">Send Test WhatsApp Message</h4>
                </div>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSendTestMessage} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Recipient Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Custom Message (Optional)
                  </label>
                  <textarea
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Leave blank for default connectivity test text..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowTestModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingTest ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Send Message</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhatsAppConnectivity;
