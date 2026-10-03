import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  Sparkles,
  Fingerprint,
  RefreshCw,
  Eye,
  X,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';

const KioskSettings = () => {
  const { t } = useSettings();
  const [stats, setStats] = useState({ checkInsToday: 0, checkOutsToday: 0 });
  const [checkInLogs, setCheckInLogs] = useState([]);
  const [checkOutLogs, setCheckOutLogs] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'checkIn' | 'checkOut' | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const today = new Date(now.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
      
      const attendanceRes = await api.get('/attendance', { params: { date: today } });
      const todayLogs = attendanceRes.data || [];
      
      const checkIns = todayLogs.filter(log => log.in_time);
      const checkOuts = todayLogs.filter(log => log.out_time);
      
      setStats({
        checkInsToday: checkIns.length,
        checkOutsToday: checkOuts.length
      });
      setCheckInLogs(checkIns);
      setCheckOutLogs(checkOuts);

    } catch (err) {
      console.error('Error fetching kiosk stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchKiosk = () => {
    window.open('/kiosk', '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-6"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">{t('Initializing Kiosk Core...')}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex items-center justify-center p-6 bg-slate-50/50 rounded-[3rem] overflow-hidden relative">
      <button 
        onClick={fetchInitialData}
        className="absolute top-8 right-8 z-20 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/50 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-white transition-all hover:scale-105 hover:shadow-md"
      >
        <RefreshCw size={14} />
        {t('Refresh')}
      </button>
      
      {/* Aesthetic Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10"
      >
        
        {/* Left Side: Launch Button */}
        <div className="flex justify-center md:justify-end">
          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLaunchKiosk}
            className="group relative w-64 h-64 md:w-80 md:h-80 rounded-[3rem] bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-1 shadow-2xl shadow-indigo-500/40 outline-none"
          >
            {/* Glowing ring on hover */}
            <div className="absolute inset-0 rounded-[3rem] bg-white opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-2xl"></div>
            
            {/* Outer animated light border */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-white/10 rounded-[3rem] opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="absolute inset-[2px] bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 rounded-[2.8rem] opacity-100"></div>

            {/* Inner Glass layer with corner lights */}
            <div className="relative h-full w-full bg-white/10 backdrop-blur-md rounded-[2.8rem] border border-white/40 shadow-[inset_0px_4px_20px_rgba(255,255,255,0.6),inset_0px_-4px_20px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center gap-4 overflow-hidden group-hover:bg-white/5 transition-colors duration-500">
              
              {/* Top left and bottom right explicit light flares */}
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/40 rounded-full blur-2xl"></div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cyan-300/40 rounded-full blur-2xl"></div>
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[100px] blur-2xl group-hover:bg-white/20 transition-colors"></div>
              
              <Sparkles className="absolute top-8 right-8 text-white/50 animate-pulse" size={24} />
              
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-500 shadow-inner">
                <Fingerprint size={48} className="text-white drop-shadow-md" />
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                  {t('Launch')}
                </span>
                <span className="text-[10px] md:text-xs font-bold text-indigo-100 uppercase tracking-[0.4em] flex items-center gap-1.5">
                  <ExternalLink size={12} /> {t('Kiosk Terminal')}
                </span>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Right Side: Stats Cards */}
        <div className="flex flex-col gap-6 justify-center">
          
          <motion.div 
            whileHover={{ x: 10 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 border border-white shadow-xl shadow-slate-200/50 flex items-center justify-between gap-6 group cursor-default"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter mb-1">
                  {stats.checkInsToday}
                </h3>
                <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.25em]">
                  {t("Today's Check-Ins")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('checkIn')}
              className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl transition-colors shadow-sm border border-emerald-100 hover:scale-105"
              title="View Check-Ins List"
            >
              <Eye size={24} />
            </button>
          </motion.div>

          <motion.div 
            whileHover={{ x: 10 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 border border-white shadow-xl shadow-slate-200/50 flex items-center justify-between gap-6 group cursor-default"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shadow-inner">
                <XCircle size={32} />
              </div>
              <div>
                <h3 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter mb-1">
                  {stats.checkOutsToday}
                </h3>
                <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.25em]">
                  {t("Today's Check-Outs")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('checkOut')}
              className="p-3 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-2xl transition-colors shadow-sm border border-orange-100 hover:scale-105"
              title="View Check-Outs List"
            >
              <Eye size={24} />
            </button>
          </motion.div>

        </div>

      </motion.div>

      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-2xl border border-white/50 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-[2.5rem] w-[90%] sm:w-[420px] mx-auto overflow-hidden flex flex-col max-h-[550px]"
            >
              <div className="p-6 border-b border-slate-100/50 flex items-center justify-between bg-gradient-to-br from-slate-50/50 to-white/50">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-2xl shadow-inner ${activeModal === 'checkIn' ? 'bg-emerald-100/50 text-emerald-600' : 'bg-orange-100/50 text-orange-600'}`}>
                    {activeModal === 'checkIn' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-widest">
                      {activeModal === 'checkIn' ? "Today's Check-Ins" : "Today's Check-Outs"}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                      Live Kiosk Data
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200/50"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/30">
                {(activeModal === 'checkIn' ? checkInLogs : checkOutLogs).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                    <Sparkles size={32} className="text-slate-300 mb-3" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">No records yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(activeModal === 'checkIn' ? checkInLogs : checkOutLogs).map((log, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="group flex items-center gap-4 p-3 rounded-[1.5rem] bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300"
                      >
                        <div className="w-12 h-12 rounded-[1rem] bg-slate-50 overflow-hidden border border-slate-100 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                          {log.photo ? (
                            <img src={log.photo} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-primary font-black bg-indigo-50/50">
                              {log.name?.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-black text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{log.name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {log.employee_id}</p>
                        </div>
                        <div className="shrink-0 text-right pr-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border ${activeModal === 'checkIn' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                            <Clock size={12} className={activeModal === 'checkIn' ? 'text-emerald-500' : 'text-orange-500'} />
                            {activeModal === 'checkIn' 
                              ? new Date(log.in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                              : new Date(log.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                            }
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KioskSettings;
