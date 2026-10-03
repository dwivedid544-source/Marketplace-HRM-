import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  Activity, 
  MapPin, 
  Wifi, 
  Cpu, 
  Clock, 
  ShieldCheck,
  Zap,
  CheckCircle2,
  X,
  History,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LiveMonitor = () => {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [punchHistory, setPunchHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveLogs();
    const interval = setInterval(fetchLiveLogs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchLiveLogs = async () => {
    try {
      const response = await api.get('/attendance', {
        params: { date: new Date().toISOString().split('T')[0] }
      });
      
      const events = [];
      response.data.forEach(log => {
        if (log.in_time) {
          const inDate = new Date(log.in_time);
          events.push({
            id: `${log.id}-in`,
            employee_id: log.employee_id,
            name: log.name,
            photo: log.photo,
            action: log.status === 'late' ? 'Late Entry' : 'Punch In',
            time: inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: inDate,
            device: log.marked_by ? 'Admin Portal' : 'Kiosk Terminal',
            method: log.marked_by ? 'Manual Entry' : 'Facial Recognition',
            status: log.status
          });
        }
        if (log.out_time) {
          const outDate = new Date(log.out_time);
          events.push({
            id: `${log.id}-out`,
            employee_id: log.employee_id,
            name: log.name,
            photo: log.photo,
            action: 'Punch Out',
            time: outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: outDate,
            device: log.marked_by ? 'Admin Portal' : 'Kiosk Terminal',
            method: log.marked_by ? 'Manual Entry' : 'Facial Recognition',
            status: 'present'
          });
        }
      });

      // Sort by punch time descending (latest first)
      const sorted = events.sort((a, b) => b.rawTime - a.rawTime);
      setActiveEmployees(sorted.slice(0, 10)); // Show latest 10
      setLoading(false);
    } catch (err) {
      console.error('Error fetching live logs:', err);
    }
  };

  const fetchHistory = async (empId) => {
    try {
      const response = await api.get('/attendance');
      const filtered = response.data.filter(log => log.employee_id === empId);
      
      const events = [];
      filtered.forEach(log => {
        if (log.in_time) {
          const inDate = new Date(log.in_time);
          events.push({
            action: log.status === 'late' ? 'Late Entry' : 'Punch In',
            date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: inDate,
            device: log.marked_by ? 'Admin Portal' : 'Kiosk Terminal'
          });
        }
        if (log.out_time) {
          const outDate = new Date(log.out_time);
          events.push({
            action: 'Punch Out',
            date: new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTime: outDate,
            device: log.marked_by ? 'Admin Portal' : 'Kiosk Terminal'
          });
        }
      });

      setPunchHistory(events.sort((a, b) => b.rawTime - a.rawTime));
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleViewHistory = (emp) => {
    setSelectedEmployee(emp);
    fetchHistory(emp.employee_id || emp.id);
    setShowHistoryModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary text-white rounded-2xl animate-pulse">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Live Monitor</h1>
            <p className="text-sm text-slate-500">Real-time biometric data stream from all devices.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Wifi size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Device Online</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl border border-slate-200">
            <Clock size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Sync: 2s ago</span>
          </div>
        </div>
      </div>

      {/* Real-time Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeEmployees.length > 0 ? activeEmployees.map((emp, i) => (
          <motion.div 
            key={emp.id || i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="card group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Live Indicator */}
            <div className="absolute top-0 right-0 p-3">
              <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-bold text-emerald-600 uppercase">LIVE</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border-2 border-white shadow-md flex items-center justify-center">
                  {emp.photo ? (
                    <img src={emp.photo} alt="user" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-black uppercase text-xl">
                      {emp.name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                  <ShieldCheck size={14} className="text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{emp.name}</h3>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">{emp.action}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400 flex items-center gap-2"><Clock size={14} /> Time</span>
                <span className="text-slate-700">{emp.time}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400 flex items-center gap-2"><MapPin size={14} /> Device</span>
                <span className="text-slate-700">{emp.device}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400 flex items-center gap-2"><Zap size={14} /> Method</span>
                <span className="text-slate-700">{emp.method}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-bold uppercase">Authorized</span>
              </div>
              <button 
                onClick={() => handleViewHistory(emp)}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                View History
              </button>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full py-20 text-center card bg-slate-50/50 border-dashed">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Activity size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No live data stream detected</p>
            <p className="text-xs font-bold text-slate-300 uppercase mt-1">Check device connectivity</p>
          </div>
        )}
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            ></motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 bg-white shrink-0">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <History size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">Punch History</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedEmployee.name} ({selectedEmployee.id})</p>
                    </div>
                  </div>
                  <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="space-y-6">
                  {punchHistory.length > 0 ? punchHistory.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 ${item.action === 'Punch In' ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50'}`}></div>
                        {i !== punchHistory.length - 1 && <div className="w-0.5 h-12 bg-slate-100"></div>}
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100 group-hover:border-primary/20 group-hover:bg-primary/5 transition-all">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${item.action === 'Punch In' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.action}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-800">{item.time}</h4>
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <MapPin size={10} /> {item.device}
                          </span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                      No punch history found for this user
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-white shrink-0">
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="w-full btn-primary py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveMonitor;
