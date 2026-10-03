import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Building, 
  Delete,
  XCircle,
  HelpCircle,
  ScanFace,
  Grid3x3,
  Maximize,
  Minimize,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FaceScanner from '../../components/face/FaceScanner';

const KioskMode = () => {
  const [settings, setSettings] = useState({ kiosk_name: 'Reception Tablet A', branch: 'Johannesburg HQ', status: 'Active' });
  const [time, setTime] = useState(new Date());
  
  // Flow states: 1 = Enter ID, 2 = Verify Employee, 3 = Success Screen
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [verifiedEmployee, setVerifiedEmployee] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [todayHoliday, setTodayHoliday] = useState(null);
  const [inputMode, setInputMode] = useState('pin'); // 'pin' or 'face'
  const [resetKey, setResetKey] = useState(0);
  const [punchStatus, setPunchStatus] = useState(null); // null | 'needs_checkin' | 'needs_checkout' | 'done'

  // Fullscreen sync
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Time ticking clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Kiosk settings from API
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/kiosk/settings');
      if (response.data) {
        setSettings(response.data);
      }
      
      const hRes = await api.get('/attendance/holidays');
      const todayStr = new Date().toISOString().split('T')[0];
      const holiday = hRes.data.find(h => h.holiday_date && new Date(h.holiday_date).toISOString().split('T')[0] === todayStr);
      
      if (holiday) {
        setTodayHoliday(holiday.holiday_name);
      }
    } catch (err) {
      console.error('Error fetching kiosk settings/holidays:', err);
    }
  };

  // Keyboard keypad inputs helper
  const handleKeypadPress = (val) => {
    setErrorMsg('');
    if (val === 'clear') {
      setEmployeeId('');
    } else if (val === 'backspace') {
      setEmployeeId(prev => prev.slice(0, -1));
    } else {
      if (employeeId.length < 10) {
        setEmployeeId(prev => prev + val);
      }
    }
  };

  // Step 1: Verify employee ID
  const handleVerify = async () => {
    if (!employeeId.trim()) {
      setErrorMsg('Please enter an employee ID.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      
      // We search local employees database. We can query GET /employees and search client-side
      const response = await api.get('/employees');
      const employees = response.data || [];
      
      // Match by custom_id (1001), machine_id, ID (EMP001), or exact email prefix
      const emp = employees.find(e => 
        e.id === employeeId.trim() || 
        e.custom_id === employeeId.trim() ||
        (e.name && e.name.toLowerCase() === employeeId.trim().toLowerCase())
      );

      if (!emp) {
        setErrorMsg('Employee ID not found. Please try again.');
        return;
      }

      if (emp.status !== 'active') {
        setErrorMsg('This employee profile is currently inactive.');
        return;
      }

      setVerifiedEmployee(emp);

      // Check today's attendance status for this employee
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        const attRes = await api.get('/attendance');
        const todayRecord = attRes.data.find(a => 
          (a.employee_id === emp.id || a.employee_id === emp.custom_id) && 
          a.date && a.date.substring(0, 10) === todayDate
        );

        if (!todayRecord || !todayRecord.in_time) {
          setPunchStatus('needs_checkin');
        } else if (todayRecord.in_time && !todayRecord.out_time) {
          setPunchStatus('needs_checkout');
        } else {
          setPunchStatus('done');
        }
      } catch (attErr) {
        console.error('Could not check attendance status:', attErr);
        setPunchStatus('needs_checkin'); // fallback
      }

      setStep(2);
    } catch (err) {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Register Punch Action
  const handlePunch = async (actionType) => {
    // actionType is either "Punch In" or "Punch Out"
    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const response = await api.post('/kiosk/punch', {
        employeeId: verifiedEmployee.custom_id || verifiedEmployee.id,
        type: actionType
      }, {
        headers: { 'x-kiosk-api-key': import.meta.env.VITE_KIOSK_API_KEY }
      });

      if (response.data && response.data.success) {
        setSuccessData({
          employee: response.data.employee,
          log: response.data.log
        });
        setStep(3);
        
        // Auto reset to step 1 after 4 seconds
        setTimeout(() => {
          handleReset();
        }, 4000);
      } else {
        if (response.data.message === 'Already punched out for today.') {
          setStep(4);
        } else {
          setErrorMsg(response.data.message || 'Unable to register attendance.');
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message;
      if (errorMessage === 'Already punched out for today.') {
        setStep(4);
      } else {
        setErrorMsg('Failed to process. Please check settings.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setEmployeeId('');
    setVerifiedEmployee(null);
    setSuccessData(null);
    setErrorMsg('');
    setPunchStatus(null);
    setResetKey(prev => prev + 1);
  };

  const handleFacePunch = async (descriptorArray, livenessData) => {
    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const response = await api.post('/kiosk/face-punch', {
        descriptor: descriptorArray,
        livenessPassed: livenessData.livenessPassed,
        livenessScore: livenessData.livenessScore
      });

      if (response.data && response.data.success) {
        setSuccessData({
          employee: response.data.employee,
          log: response.data.log
        });
        setStep(3);
        // Removed auto-timeout so it stays on the success screen until manually closed.
      } else {
        if (response.data.message === 'Already punched out for today.') {
          setStep(4);
        } else {
          setErrorMsg(response.data.message || 'Face matching failed.');
          setStep(1);
        }
        setResetKey(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message;
      if (errorMessage === 'Already punched out for today.') {
        setStep(4);
      } else {
        setErrorMsg(errorMessage || 'Server error. Please try again.');
        setStep(1);
      }
      setResetKey(prev => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatClockTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatClockDate = (date) => {
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // If today is a holiday, block attendance
  if (todayHoliday) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-fuchsia-500/10 blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="max-w-md w-full text-center space-y-6 z-10">
          <div className="w-24 h-24 bg-gradient-to-tr from-fuchsia-600 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-fuchsia-500/20 border-4 border-slate-950">
            <Calendar size={48} className="text-white" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400">Holiday Today</h1>
            <p className="text-xl font-bold text-white leading-tight">{todayHoliday}</p>
          </div>
          <p className="text-sm font-semibold text-slate-400 leading-relaxed bg-white/5 p-5 rounded-2xl border border-white/5">
            Attendance marking is suspended for today due to a public holiday. Enjoy your day off!
          </p>
          <div className="pt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center justify-center gap-2">
              <Clock size={12} /> {formatClockTime(time)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If kiosk settings is disabled/inactive
  if (settings.status === 'Inactive') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-rose-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="max-w-md w-full text-center space-y-6 z-10">
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <XCircle size={40} className="animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight">Terminal Suspended</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Status: Inactive</p>
          </div>
          <p className="text-sm font-semibold text-slate-400 leading-relaxed bg-white/5 p-5 rounded-2xl border border-white/5">
            This tablet kiosk terminal (<span className="text-white font-bold">{settings.kiosk_name}</span>) has been set to inactive by the administration. Please activate it in the admin panel to resume attendance services.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 md:p-6 relative overflow-hidden font-sans select-none">
      
      {/* Dynamic Glow Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>

      {/* Header bar */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-2 z-10 border-b border-white/5 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Building size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-xs font-black tracking-tight uppercase leading-none">{settings.kiosk_name}</h2>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 flex items-center gap-1">
              <Building size={8} /> {settings.branch}
            </p>
          </div>
        </div>

        <div className="text-center sm:text-right">
          <h1 className="text-xl md:text-2xl font-black font-mono tracking-tight text-white/95 leading-none">
            {formatClockTime(time)}
          </h1>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
            {formatClockDate(time)}
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-2 z-10 overflow-hidden">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Input ID */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-0.5">
                    <h3 className="text-lg font-black uppercase tracking-wide">
                      {inputMode === 'pin' ? 'Enter Employee ID' : 'Face Recognition'}
                    </h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {inputMode === 'pin' ? 'Use your employee code or terminal ID' : 'Center your face in the frame'}
                    </p>
                  </div>
                  <button
                    onClick={() => setInputMode(inputMode === 'pin' ? 'face' : 'pin')}
                    className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest"
                  >
                    {inputMode === 'pin' ? <ScanFace size={14} /> : <Grid3x3 size={14} />}
                    {inputMode === 'pin' ? 'Use Face' : 'Use PIN'}
                  </button>
                </div>

                {inputMode === 'face' ? (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col items-center">
                      <FaceScanner key={resetKey} onFaceDetected={handleFacePunch} mode="attendance" />
                    </div>
                    {/* Error Box for Face Scan */}
                    {errorMsg && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 text-rose-400 w-full shadow-lg shadow-rose-500/10"
                      >
                        <AlertCircle size={36} className="shrink-0 animate-pulse" />
                        <p className="text-sm font-black uppercase tracking-widest text-center leading-tight">{errorMsg}</p>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Display Screen */}
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-3.5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">EMPLOYEE ID</span>
                    {employeeId && (
                      <button 
                        onClick={() => handleKeypadPress('clear')}
                        className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="h-10 flex items-center justify-center mt-1">
                    {employeeId ? (
                      <span className="text-3xl font-black tracking-widest font-mono text-white">
                        {employeeId}
                      </span>
                    ) : (
                      <span className="text-xl font-bold text-slate-600 animate-pulse uppercase tracking-wider">
                        Enter ID Code
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Box */}
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center justify-center gap-3 text-rose-400"
                  >
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest">{errorMsg}</p>
                  </motion.div>
                )}

                {/* Numeric Touch Keypad */}
                <div className="grid grid-cols-3 gap-2 bg-white/5 border border-white/5 p-3 rounded-2xl backdrop-blur-xl">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeypadPress(num.toString())}
                      className="h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-lg font-black font-mono shadow-md flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  
                  {/* Backspace */}
                  <button
                    onClick={() => handleKeypadPress('backspace')}
                    className="h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-rose-400 flex items-center justify-center font-bold"
                  >
                    <Delete size={18} />
                  </button>

                  {/* Zero */}
                  <button
                    onClick={() => handleKeypadPress('0')}
                    className="h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all text-lg font-black font-mono flex items-center justify-center"
                  >
                    0
                  </button>

                  {/* Proceed */}
                  <button
                    onClick={handleVerify}
                    disabled={isSubmitting}
                    className="h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/25 flex items-center justify-center"
                  >
                    {isSubmitting ? '...' : 'Next'}
                  </button>
                </div>

                {/* Info Tip */}
                <div className="flex items-start gap-2 bg-white/5 border border-white/5 p-2 rounded-xl max-w-sm mx-auto mt-4">
                  <HelpCircle size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                  <p className="text-[8px] font-bold tracking-tight text-slate-400 uppercase leading-normal">
                    Demo Tip: Enter <span className="text-white font-black">1001</span> (John Doe) or <span className="text-white font-black">1002</span> (Alice Smith) to check in/out.
                  </p>
                </div>
                </>
                )}
              </motion.div>
            )}

            {/* Step 2: Verify & Option Selection */}
            {step === 2 && verifiedEmployee && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="text-center space-y-0.5">
                  <h3 className="text-lg font-black uppercase tracking-wide">Confirm Attendance</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Verify employee details and select punch option
                  </p>
                </div>

                {/* Profile Card */}
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2">
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">
                      ID: {verifiedEmployee.custom_id}
                    </span>
                  </div>

                  <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 overflow-hidden mx-auto shadow-md">
                    {verifiedEmployee.photo ? (
                      <img src={verifiedEmployee.photo} alt={verifiedEmployee.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                        <User size={24} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-lg font-black tracking-tight text-white">{verifiedEmployee.name}</h4>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      ID {verifiedEmployee.custom_id}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 gap-3">
                  {punchStatus === 'needs_checkin' && (
                    <button
                      onClick={() => handlePunch('Punch In')}
                      disabled={isSubmitting}
                      className="h-20 md:h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 transition-all shadow-xl shadow-emerald-600/15 flex flex-col items-center justify-center gap-1.5 border border-emerald-500/10"
                    >
                      <CheckCircle2 size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Check In</span>
                    </button>
                  )}

                  {punchStatus === 'needs_checkout' && (
                    <button
                      onClick={() => handlePunch('Punch Out')}
                      disabled={isSubmitting}
                      className="h-20 md:h-24 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 active:scale-95 transition-all shadow-xl shadow-orange-600/15 flex flex-col items-center justify-center gap-1.5 border border-orange-500/10"
                    >
                      <XCircle size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Check Out</span>
                    </button>
                  )}

                  {punchStatus === 'done' && (
                    <div className="h-20 md:h-24 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1.5">
                      <CheckCircle2 size={24} className="text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Already Checked In & Out Today</span>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                <button
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <ArrowLeft size={12} />
                  Cancel & Go Back
                </button>
              </motion.div>
            )}

            {/* Step 3: Success Screen */}
            {step === 3 && successData && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4"
              >
                {/* Visual success checkmark ring */}
                <div className="relative w-20 h-20 mx-auto">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                    className="absolute inset-0 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                  ></motion.div>
                  <div className="absolute inset-1.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/20 border border-emerald-500/20">
                    <CheckCircle2 size={32} className="text-white" />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-xl font-black uppercase tracking-tight text-emerald-400">Attendance Logged</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Your request was recorded successfully
                  </p>
                </div>

                {/* Log Result details card */}
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3 max-w-sm mx-auto text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3">
                    <span className={`px-4 py-1.5 rounded-lg text-[12px] font-black tracking-widest uppercase ${
                      successData.log.action === 'Punch In' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                    }`}>
                      {successData.log.action === 'Punch In' ? 'Checked In' : 'Checked Out'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="border-b border-white/5 pb-2.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Employee</p>
                      <h4 className="text-base font-black text-white mt-1 leading-none">{successData.employee.name}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-none">ID {successData.employee.custom_id}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Recorded Time</p>
                        <p className="text-xs font-black font-mono text-white mt-1 leading-none">{successData.log.time}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Rating</p>
                        <p className={`text-[10px] font-black uppercase tracking-wide mt-1 leading-none ${successData.log.status === 'Late' ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                          {successData.log.status}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">
                        Device: <span className="text-white font-black">{successData.log.device}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleReset}
                  className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Back to Scanner
                </button>
              </motion.div>
            )}

            {/* Step 4: Already Punched Out Screen */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4"
              >
                <div className="relative w-20 h-20 mx-auto">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.1, opacity: 1 }}
                    transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                    className="absolute inset-0 rounded-full bg-amber-500/10 border border-amber-500/20"
                  ></motion.div>
                  <div className="absolute inset-1.5 bg-gradient-to-tr from-amber-600 to-orange-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-600/20 border border-amber-500/20">
                    <AlertCircle size={32} className="text-white" />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-xl font-black uppercase tracking-tight text-amber-400">Already Punched Out</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                    You have already completed your punch out for today.
                  </p>
                </div>

                <button
                  onClick={handleReset}
                  className="w-full mt-6 py-3 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-lg active:scale-95 border border-white/10"
                >
                  <ArrowLeft size={14} />
                  Back to PIN or Face
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="text-center z-10 pt-3 border-t border-white/5 shrink-0">
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-500 flex items-center justify-center gap-1.5 leading-none">
          HRM Software Pro System • Tablet Attendance Terminal • Secure Kiosk Mode Active
        </p>
      </footer>

    </div>
  );
};

export default KioskMode;
