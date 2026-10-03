import React, { useState, useEffect } from 'react';
import { Camera, Users, CheckCircle, AlertCircle, Lock, Unlock, ShieldCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import api from '../../utils/axios';
import faceService from '../../services/faceService';
import FaceScanner from '../../components/face/FaceScanner';
import { preloadFaceModels } from '../../hooks/useFaceModels';
import { useSettings } from '../../context/SettingsContext';

const FaceRegistration = () => {
    const { t } = useSettings();
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isScanning, setIsScanning] = useState(false);
    
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    
    // Parse URL parameter if redirected from Employees Edit page
    const queryParams = new URLSearchParams(window.location.search);
    const urlEmpId = queryParams.get('empId');

    useEffect(() => {
        fetchEmployees();
        preloadFaceModels(); // Start loading AI models in background
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            let empData = [];
            if (Array.isArray(res.data)) {
                empData = res.data;
            } else if (res.data && res.data.data) {
                empData = res.data.data;
            }
            setEmployees(empData);
            
            // Auto-select if empId was passed in URL
            if (urlEmpId) {
                const match = empData.find(e => e.id.toString() === urlEmpId);
                if (match) {
                    setSelectedEmployee(match.id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch employees', error);
        }
    };

    const currentEmp = employees.find(e => e.id.toString() === selectedEmployee.toString());

    const handleFaceDetected = async (descriptorArray) => {
        setIsScanning(false);
        try {
            const result = await faceService.registerFace(selectedEmployee, descriptorArray);
            setStatus({ type: 'success', message: 'Face registered and locked successfully!' });
            // Lock employee immediately in local state
            setEmployees(prev => prev.map(e => e.id.toString() === selectedEmployee.toString() ? { ...e, has_face_registered: 1 } : e));
        } catch (error) {
            setStatus({ type: 'error', message: error.response?.data?.message || 'Failed to register face.' });
        }
    };

    const handleConfirmUnlock = async () => {
        setShowUnlockModal(false);
        try {
            await faceService.deleteFace(selectedEmployee);
            setEmployees(prev => prev.map(e => e.id.toString() === selectedEmployee.toString() ? { ...e, has_face_registered: 0 } : e));
            setStatus({ type: '', message: '' });
            setIsScanning(true);
        } catch (err) {
            console.error('Failed to delete old face descriptor', err);
            setStatus({ type: '', message: '' });
            setIsScanning(true);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <div className="mb-6 sm:mb-8 flex items-center gap-3">
                <div className="p-2 sm:p-3 bg-primary/20 text-primary rounded-xl shrink-0">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-black leading-tight">{t('Face Registration')}</h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{t('Register and lock employee biometric face profiles')}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('Select Employee')}
                    </label>
                    <div className="relative w-full max-w-full overflow-hidden">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5 z-10" />
                        <select
                            value={selectedEmployee}
                            onChange={(e) => {
                                setSelectedEmployee(e.target.value);
                                setStatus({ type: '', message: '' });
                                setIsScanning(false);
                            }}
                            className="w-full max-w-full pl-9 sm:pl-10 pr-8 py-2.5 sm:py-3 text-sm sm:text-base bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-slate-800 dark:text-white appearance-none truncate"
                        >
                            <option value="">{t('-- Choose an Employee --')}</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.custom_id} - {emp.name} {emp.has_face_registered === 1 ? '🔒 [Locked / Registered]' : '⚠️ [Not Registered]'}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6">
                    {selectedEmployee ? (
                        <div className="flex flex-col items-center justify-center">
                            {!isScanning && !status.message ? (
                                currentEmp?.has_face_registered === 1 ? (
                                    /* Face Already Registered & Locked Screen */
                                    <div className="text-center py-6 max-w-md mx-auto animate-in fade-in zoom-in duration-300">
                                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/10 border border-emerald-200/60 dark:border-emerald-700/50">
                                            <Lock size={40} className="text-emerald-600" />
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3 inline-block">
                                            {t('Biometrics Locked & Active')}
                                        </span>
                                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                                            {t('Face Profile Locked 🔒')}
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
                                            {t('Biometric face profile is active and locked for')} <strong className="text-slate-800 dark:text-white">{currentEmp.name} ({currentEmp.custom_id})</strong>.
                                        </p>

                                        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl mb-8 text-left">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">{t('Attendance Enabled')}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {t('This employee can now use Smart Face Attendance and Tablet Kiosk mode to clock in/out without any issues.')}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => setShowUnlockModal(true)}
                                            className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                                        >
                                            <Unlock size={14} /> {t('Unlock & Re-Register Face')}
                                        </button>
                                    </div>
                                ) : (
                                    /* Not Registered -> Show Onboarding Instructions */
                                    <div className="text-center w-full">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-2xl mb-6 sm:mb-8 border border-slate-100 dark:border-slate-700 max-w-sm mx-auto">
                                            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white mb-2">{t('Onboarding Instructions')}</h3>
                                            <ul className="text-xs sm:text-sm text-slate-500 text-left space-y-2">
                                                <li className="flex gap-2"><span>✅</span> {t('Ensure proper lighting')}</li>
                                                <li className="flex gap-2"><span>✅</span> {t('Look straight at the camera')}</li>
                                                <li className="flex gap-2"><span>✅</span> {t('Center your face in the circle')}</li>
                                            </ul>
                                        </div>
                                        <button
                                            onClick={() => setIsScanning(true)}
                                            className="btn-primary py-3 sm:py-4 px-4 sm:px-10 text-sm sm:text-lg rounded-2xl font-bold shadow-xl shadow-primary/30 hover:scale-105 transition-all w-full sm:w-auto whitespace-nowrap"
                                        >
                                            {t('Start Enrollment Scan')}
                                        </button>
                                    </div>
                                )
                            ) : isScanning ? (
                                <div className="w-full flex flex-col items-center">
                                    <FaceScanner onFaceDetected={handleFaceDetected} mode="register" />
                                    <button 
                                        onClick={() => setIsScanning(false)} 
                                        className="mt-6 sm:mt-8 text-xs sm:text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                                    >
                                        {t('Cancel Scanning')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="text-center py-10 sm:py-16 px-4">
                            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                                <Users className="text-slate-300 w-8 h-8 sm:w-10 sm:h-10" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-700">{t('No Employee Selected')}</h3>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">{t('Please select an employee from the dropdown above to begin.')}</p>
                        </div>
                    )}

                    {status.message && !isScanning && (
                        <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in duration-500">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 border-4 ${
                                status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]' 
                                : 'bg-red-50 border-red-200 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]'
                            }`}>
                                {status.type === 'success' ? <CheckCircle size={64} /> : <AlertCircle size={64} />}
                            </div>
                            <h2 className={`text-3xl font-black mb-2 ${status.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {status.type === 'success' ? t('Enrollment Complete & Locked!') : t('Enrollment Failed')}
                            </h2>
                            <p className="text-slate-500 font-medium mb-8 text-lg">{status.message}</p>
                            
                            {status.type === 'success' ? (
                                <button 
                                    onClick={() => setStatus({ type: '', message: '' })}
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-600/20 text-sm uppercase tracking-wider"
                                >
                                    {t('View Locked Profile')}
                                </button>
                            ) : (
                                <button 
                                    onClick={() => { setStatus({type:'', message:''}); setIsScanning(true); }}
                                    className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                                >
                                    {t('Scan Again')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Custom 40% Width In-App Confirmation Modal */}
            {showUnlockModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-700 w-[92%] sm:w-[70%] md:w-[40%] max-w-lg text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200/60 dark:border-rose-800/40 shadow-lg shadow-rose-500/10">
                            <Unlock size={30} />
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                            {t('Unlock Biometric Face Profile?')}
                        </h3>
                        
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium leading-relaxed">
                            {t('Are you sure you want to unlock and re-register face biometrics for')} <strong className="text-slate-800 dark:text-white">{currentEmp?.name} ({currentEmp?.custom_id})</strong>?
                        </p>
                        
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowUnlockModal(false)}
                                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                {t('Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmUnlock}
                                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-600/20"
                            >
                                {t('Yes, Unlock')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FaceRegistration;
