import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { Mail, RefreshCw, XCircle, CheckCircle2, AlertCircle, Clock, ArrowLeft } from 'lucide-react';

const EmailLogs = () => {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await api.get('/payroll/email-logs');
            setLogs(response.data);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleRetry = async () => {
        const failedLogs = logs.filter(l => l.status === 'failed' || l.status === 'cancelled');
        if (failedLogs.length === 0) return;

        try {
            await api.post('/payroll/retry-emails', { logIds: failedLogs.map(l => l.id) });
            fetchLogs(); // Refresh
        } catch (err) {
            console.error('Failed to retry', err);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/admin/payroll')}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-700"
                        title="Back to Payroll"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Email Delivery Logs</h1>
                        <p className="text-sm text-slate-500 font-medium">Track E-Payslip delivery status.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={fetchLogs} 
                        className="btn-secondary flex items-center gap-2"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                    <button 
                        onClick={handleRetry} 
                        disabled={!logs.some(l => l.status === 'failed' || l.status === 'cancelled')}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={16} /> Retry Failed
                    </button>
                </div>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Employee</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Email</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Payroll Cycle</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Status</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Sent/Failed Time</th>
                                <th className="p-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">Error</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-8 text-slate-400">Loading logs...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-8 text-slate-400">No email logs found.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-sm font-bold text-slate-800">{log.employee_name}</td>
                                        <td className="p-4 text-sm font-semibold text-slate-600">{log.employee_email}</td>
                                        <td className="p-4 text-sm font-semibold text-slate-600">
                                            {new Date(log.cycle_start).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            {log.status === 'sent' && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase flex items-center w-fit gap-1"><CheckCircle2 size={12}/> Sent</span>}
                                            {log.status === 'failed' && <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase flex items-center w-fit gap-1"><XCircle size={12}/> Failed</span>}
                                            {log.status === 'queued' && <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase flex items-center w-fit gap-1"><Clock size={12}/> Queued</span>}
                                            {log.status === 'processing' && <span className="px-2.5 py-1 bg-sky-50 text-sky-600 rounded-lg text-[10px] font-black uppercase flex items-center w-fit gap-1"><RefreshCw size={12} className="animate-spin" /> Processing</span>}
                                        </td>
                                        <td className="p-4 text-xs font-bold text-slate-500">
                                            {log.sent_time ? new Date(log.sent_time).toLocaleString() : '---'}
                                        </td>
                                        <td className="p-4 text-xs font-semibold text-rose-500 max-w-xs truncate" title={log.last_error}>
                                            {log.last_error || '---'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default EmailLogs;
