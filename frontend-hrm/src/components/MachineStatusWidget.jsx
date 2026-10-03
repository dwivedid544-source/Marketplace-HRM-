import React, { useState, useEffect } from 'react';
import { Fingerprint, Wifi, WifiOff, RefreshCw, Server, AlertCircle } from 'lucide-react';
import api from '../utils/axios';

// Mock socket.io client to simulate biometric punches in real-time on the frontend UI template
const ioMock = () => {
  const listeners = {};
  const socket = {
    on: (event, callback) => {
      listeners[event] = callback;
    },
    disconnect: () => {
      clearInterval(interval);
    }
  };

  // Simulate machine connecting successfully after a short delay
  setTimeout(() => {
    if (listeners['connect']) listeners['connect']();
    if (listeners['machine:connected']) {
      listeners['machine:connected']({ ip: '192.168.1.150' });
    }
  }, 1000);

  // Periodically generate mock live punches to animate the dashboard
  const interval = setInterval(() => {
    if (listeners['attendance:new'] && Math.random() > 0.4) {
      const randomEmpId = Math.floor(Math.random() * 4) + 1;
      const type = Math.random() > 0.5 ? 'Check-In' : 'Check-Out';
      listeners['attendance:new']({
        employee_id: randomEmpId,
        punch_time: new Date().toISOString(),
        type: type
      });
    }
  }, 10000);

  return socket;
};

const MachineStatusWidget = () => {
  const [machineState, setMachineState] = useState({
    connected: false,
    ip: '',
    lastSync: null,
    loading: true,
    error: null
  });

  const [livePunches, setLivePunches] = useState([]);

  useEffect(() => {
    checkStatus();

    const socket = ioMock();

    socket.on('connect', () => {
      console.log('Connected to Biometric Socket (Mock)');
    });

    socket.on('machine:connected', (data) => {
      setMachineState(prev => ({ ...prev, connected: true, ip: data.ip, loading: false, error: null }));
    });

    socket.on('machine:disconnected', (data) => {
      setMachineState(prev => ({ ...prev, connected: false, error: data.reason }));
    });

    socket.on('machine:error', (data) => {
      setMachineState(prev => ({ ...prev, error: data.error }));
    });

    socket.on('attendance:new', (record) => {
      setMachineState(prev => ({ ...prev, lastSync: record.punch_time }));
      setLivePunches(prev => [record, ...prev].slice(0, 5));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const checkStatus = async () => {
    try {
      setMachineState(prev => ({ ...prev, loading: true }));
      const { data } = await api.get('/machine/status');
      setMachineState(prev => ({ 
        ...prev, 
        connected: data.connected, 
        ip: data.info?.ip || '',
        loading: false 
      }));
    } catch (error) {
      setMachineState(prev => ({ ...prev, connected: false, loading: false }));
    }
  };

  const handleManualSync = async () => {
    try {
      setMachineState(prev => ({ ...prev, loading: true }));
      await api.post('/machine/sync', {});
      await checkStatus();
    } catch (error) {
      setMachineState(prev => ({ ...prev, loading: false, error: 'Sync failed' }));
    }
  };

  return (
    <div className="card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col">
      {/* Decorative Background */}
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 transition-colors duration-1000 ${machineState.connected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${machineState.connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
              <Fingerprint size={16} />
            </div>
            <div>
              <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest leading-none">Biometric Sync</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Real-time Gateway</p>
            </div>
          </div>
          <button 
            onClick={handleManualSync} 
            disabled={!machineState.connected || machineState.loading}
            className={`p-2 rounded-lg transition-all ${machineState.connected ? 'hover:bg-slate-50 text-slate-400 hover:text-indigo-600' : 'opacity-30 cursor-not-allowed text-slate-300'}`}
            title="Manual Sync"
          >
            <RefreshCw size={14} className={machineState.loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5 bg-slate-50/50 p-4 rounded-xl border border-slate-50">
          <div className={`relative flex items-center justify-center w-12 h-12 rounded-full ${machineState.connected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            {machineState.connected ? <Server size={20} /> : <WifiOff size={20} />}
            {machineState.connected && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
            )}
          </div>
          <div>
            <h4 className={`text-[14px] font-black uppercase tracking-tight ${machineState.connected ? 'text-emerald-700' : 'text-slate-600'}`}>
              {machineState.loading ? 'Connecting...' : (machineState.connected ? 'System Online' : 'System Offline')}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              {machineState.connected ? (
                <>
                  <Wifi size={10} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-500 font-mono">{machineState.ip || '192.168.x.x'}</span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase">Awaiting Configuration</span>
              )}
            </div>
          </div>
        </div>

        {!machineState.connected && !machineState.loading && (
          <div className="flex items-start gap-2 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
              Add <span className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-slate-800 border border-amber-100">MACHINE_IP</span> to backend <span className="font-mono bg-white px-1 py-0.5 rounded shadow-sm text-slate-800 border border-amber-100">.env</span> file to automatically activate biometric syncing.
            </p>
          </div>
        )}

        {machineState.connected && (
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Punches</span>
              {machineState.lastSync && (
                <span className="text-[9px] font-bold text-slate-400">
                  Last: {new Date(machineState.lastSync).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {livePunches.length > 0 ? (
                livePunches.map((punch, idx) => (
                  <div key={idx} className="group flex justify-between items-center bg-white border border-slate-100 hover:border-indigo-100 p-2.5 rounded-xl transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${punch.type === 'Check-In' ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight block leading-none mb-1">
                          Emp #{punch.employee_id}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 block leading-none">
                          {new Date(punch.punch_time).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${punch.type === 'Check-In' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {punch.type}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Listening for punches...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineStatusWidget;
