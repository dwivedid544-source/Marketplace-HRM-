import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Camera, CheckCircle, AlertCircle, Fingerprint, LogOut, Clock, CalendarCheck, MapPin, UserX, RefreshCw, ArrowLeft } from 'lucide-react';
import faceService from '../../services/faceService';
import FaceScanner from '../../components/face/FaceScanner';
import { preloadFaceModels } from '../../hooks/useFaceModels';
import { useSettings } from '../../context/SettingsContext';

const FaceAttendance = () => {
    const { t } = useSettings();
    const navigate = useNavigate();
    const [attendanceState, setAttendanceState] = useState('loading'); // loading, not_checked_in, checked_in, checked_out, face_not_registered
    const [adminName, setAdminName] = useState('Admin');
    const [isScanning, setIsScanning] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [scanMode, setScanMode] = useState('check-in'); // check-in or check-out
    const [status, setStatus] = useState({ type: '', message: '' });
    const [timeInfo, setTimeInfo] = useState(null);
    const [wizardStep, setWizardStep] = useState(0); // 0 = idle, 1 = Face, 2 = Location, 3 = Success
    const location = useLocation();

    // Prevent direct access if not verified through LocationCheck
    if (!location.state?.verified) {
        return <Navigate to="/employee/location-check" replace />;
    }

    // Fetch initial status on mount
    const fetchStatus = async () => {
        try {
            const data = await faceService.getTodayStatus();
            setAttendanceState(data.status);
            if (data.adminName) setAdminName(data.adminName);
            
            if (data.status === 'face_not_registered' || data.isFaceRegistered === false) {
                // Do NOT open camera if face is not registered
                setIsScanning(false);
                setAttendanceState('face_not_registered');
            } else if (data.status === 'not_checked_in') {
                // Auto-start camera for check-in!
                setScanMode('check-in');
                setIsScanning(true);
            } else if (data.status === 'checked_in') {
                setTimeInfo(data.in_time);
            } else if (data.status === 'checked_out') {
                setTimeInfo(data.out_time);
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to fetch attendance status.' });
            setAttendanceState('error');
        }
    };

    useEffect(() => {
        fetchStatus();
        preloadFaceModels(); // Preload instantly in background
    }, []);

    const handleFaceDetected = async (descriptorArray, livenessData) => {
        setIsScanning(false);
        setIsVerifying(true);
        setStatus({ type: '', message: '' });
        
        try {
            // Step 1: Face Verification
            setWizardStep(1);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Step 2: Location Verification
            setWizardStep(2);
            
            const getPosition = () => {
                return new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    });
                });
            };

            let lat = null;
            let lng = null;

            try {
                const position = await getPosition();
                lat = position.coords.latitude;
                lng = position.coords.longitude;
            } catch (err) {
                setStatus({ type: 'error', message: 'Location permission is required for attendance. Please enable GPS and try again.' });
                setIsVerifying(false);
                setWizardStep(0);
                return;
            }
            
            // Step 3: Clock In
            let result;
            if (scanMode === 'check-in') {
                result = await faceService.checkIn(descriptorArray, livenessData, lat, lng);
            } else {
                result = await faceService.checkOut(descriptorArray, livenessData, lat, lng);
            }

            if (result.success) {
                setWizardStep(3);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                setStatus({ type: 'success', message: result.message });
                setTimeout(() => {
                    setStatus({ type: '', message: '' });
                    fetchStatus();
                    setIsVerifying(false);
                    setWizardStep(0);
                }, 2000);
            } else {
                setStatus({ type: 'error', message: result.message });
                setIsVerifying(false);
                setWizardStep(0);
            }
        } catch (error) {
            setStatus({ type: 'error', message: error.response?.data?.message || 'Verification failed.' });
            setIsVerifying(false);
            setWizardStep(0);
        }
    };

    const handleManualCheckOutStart = () => {
        setStatus({ type: '', message: '' });
        setScanMode('check-out');
        setIsScanning(true);
    };

    const handleRetry = () => {
        setStatus({ type: '', message: '' });
        setIsScanning(true);
    };

    if (attendanceState === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto min-h-[80vh] flex flex-col items-center justify-center">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-4">
                    <Fingerprint size={40} />
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('Smart Attendance')}</h1>
                <p className="text-slate-500 max-w-md mx-auto">
                    {t('Verify your identity instantly. Just look at the camera.')}
                </p>
            </div>

            <div className="w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 p-8 sm:p-12 overflow-hidden relative">
                
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-indigo-500 to-purple-500"></div>
                
                {/* Dashboard / Status Display (when not scanning and no immediate result message) */}
                {!isScanning && !status.message && !isVerifying && (
                    <div className="flex flex-col items-center justify-center py-4">
                        
                        {attendanceState === 'checked_in' && (
                            <div className="text-center">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Clock size={48} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('Attendance Marked Successfully ✅')}</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-8">
                                    You checked in today at {new Date(timeInfo).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Welcome Back!
                                </p>
                                
                                <button
                                    onClick={handleManualCheckOutStart}
                                    className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-rose-500 rounded-2xl hover:shadow-[0_0_40px_rgba(244,63,94,0.4)] hover:-translate-y-1 overflow-hidden"
                                >
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                    <LogOut className="mr-3" size={24} />
                                    <span>{t('Scan to Check-Out')}</span>
                                </button>
                            </div>
                        )}

                        {attendanceState === 'checked_out' && (
                            <div className="text-center">
                                <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CalendarCheck size={48} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t('Check-Out Completed Successfully ✅')}</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-8">
                                    You checked out today at {new Date(timeInfo).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Have a Great Day!
                                </p>
                            </div>
                        )}
                        
                        {attendanceState === 'face_not_registered' && (
                            <div className="text-center py-6 max-w-lg mx-auto">
                                <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/10 border border-amber-200/60 dark:border-amber-700/50">
                                    <UserX size={48} className="animate-pulse" />
                                </div>
                                <span className="px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3 inline-block">
                                    {t('Registration Required')}
                                </span>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
                                    {t('Face Not Registered')}
                                </h2>
                                <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200/80 dark:border-slate-600 mb-8 text-center">
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                        First register your face by <span className="text-primary font-black">({adminName})</span> before you can scan your face for attendance.
                                    </p>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                    <button
                                        onClick={() => fetchStatus()}
                                        className="w-full sm:w-auto px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={14} /> {t('Refresh Status')}
                                    </button>
                                    <button
                                        onClick={() => navigate('/employee')}
                                        className="w-full sm:w-auto px-6 py-3 bg-primary text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft size={14} /> {t('Back to Dashboard')}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {attendanceState === 'not_checked_in' && (
                            <button
                                onClick={() => setIsScanning(true)}
                                className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-white transition-all duration-300 bg-primary rounded-2xl focus:outline-none hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:-translate-y-1 overflow-hidden"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                                <Camera className="mr-3" size={28} />
                                <span className="text-xl">{t('Start Check-In Scan')}</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Scanner View */}
                {isScanning && (
                    <div className="w-full flex flex-col items-center py-4 animate-in fade-in duration-500">
                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-widest">
                                {scanMode === 'check-in' ? t('Check-In Scan') : t('Check-Out Scan')}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">{t('Center your face to auto-capture.')}</p>
                        </div>
                        <FaceScanner onFaceDetected={handleFaceDetected} mode="attendance" />
                        
                        {/* Only show cancel if they manually initiated check-out or re-initiated check-in */}
                        <button 
                            onClick={() => {
                                setIsScanning(false);
                                if (attendanceState === 'not_checked_in') {
                                    // If they cancel check-in, just stay on the screen so they can click start again
                                }
                            }}
                            className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                        >
                            {t('Cancel Verification')}
                        </button>
                    </div>
                )}

                {isVerifying && !status.message && (
                    <div className="w-full flex flex-col items-center py-6 animate-in fade-in duration-500 space-y-6">
                        <div className="mb-4 text-center">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-widest">
                                {t('Verification Wizard')}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{t('Please wait while the system completes security checks')}</p>
                        </div>
                        
                        <div className="w-full max-w-md space-y-4">
                            {/* Step 1: Face Verification */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                wizardStep >= 1 ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/40 border-slate-100'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${
                                        wizardStep > 1 ? 'bg-emerald-50 text-emerald-600' :
                                        wizardStep === 1 ? 'bg-indigo-50 text-indigo-600 animate-pulse' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <Fingerprint size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">{t('Step 1: Face Verification')}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {wizardStep > 1 ? t('Identity Verified') :
                                             wizardStep === 1 ? 'Comparing Face Descriptor Map...' : 'Awaiting Face Match'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {wizardStep > 1 ? <CheckCircle size={18} className="text-emerald-500" /> :
                                     wizardStep === 1 ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> :
                                     <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>}
                                </div>
                            </div>

                            {/* Step 2: Location Verification */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                wizardStep >= 2 ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/40 border-slate-100'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${
                                        wizardStep > 2 ? 'bg-emerald-50 text-emerald-600' :
                                        wizardStep === 2 ? 'bg-indigo-50 text-indigo-600 animate-pulse' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">{t('Step 2: Location Verification')}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {wizardStep > 2 ? t('Geofence Boundaries Cleared') :
                                             wizardStep === 2 ? 'Verifying coordinates range...' : 'Awaiting Coordinate Match'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {wizardStep > 2 ? <CheckCircle size={18} className="text-emerald-500" /> :
                                     wizardStep === 2 ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> :
                                     <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>}
                                </div>
                            </div>

                            {/* Step 3: Attendance Success */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                wizardStep >= 3 ? 'bg-indigo-50/20 border-indigo-100' : 'bg-slate-50/40 border-slate-100'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl shrink-0 ${
                                        wizardStep === 3 ? 'bg-emerald-50 text-emerald-600 animate-pulse' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white">{t('Step 3: Attendance Success')}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                            {wizardStep === 3 ? t('Clock-In Logged Successfully!') : 'Awaiting Final Verification'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {wizardStep === 3 ? <CheckCircle size={18} className="text-emerald-500" /> :
                                     <div className="h-1.5 w-1.5 rounded-full bg-slate-300"></div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Result Message View */}
                {status.message && !isScanning && (
                    <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-500">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 border-4 ${
                            status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]' :
                            status.type === 'error' ? 'bg-red-50 border-red-200 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]' :
                            'bg-blue-50 border-blue-200 text-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)]'
                        }`}>
                            {status.type === 'success' ? <CheckCircle size={64} /> : 
                             status.type === 'error' ? <AlertCircle size={64} /> : 
                             <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>}
                        </div>
                        <h2 className={`text-3xl font-black mb-3 ${
                            status.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 
                            status.type === 'error' ? 'text-red-600 dark:text-red-400' :
                            'text-blue-600 dark:text-blue-400'
                        }`}>
                            {status.type === 'success' ? t('Success!') : 
                             status.type === 'error' ? t('Scan Failed') : 
                             'Verifying...'}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-center mb-10 text-lg font-medium">{status.message}</p>
                        
                        {status.type === 'error' && (
                            <button
                                onClick={handleRetry}
                                className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                            >
                                {t('Try Again')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FaceAttendance;
