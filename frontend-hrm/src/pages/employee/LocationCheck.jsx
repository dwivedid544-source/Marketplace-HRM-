import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  CheckCircle,
  Home,
  Building,
  RefreshCw,
  Compass,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';

const LocationCheck = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [branch, setBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentCoords, setCurrentCoords] = useState({ latitude: -26.2041, longitude: 28.0473 }); // default HQ
  const [simulationMode, setSimulationMode] = useState('live');
  const [distance, setDistance] = useState(0); // in meters
  const [insideArea, setInsideArea] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Haversine formula to calculate distance in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchAssignedBranch = async () => {
    try {
      setLoading(true);
      const res = await api.get('/geofences/assigned');
      setBranch(res.data);
      triggerLiveLocation(res.data);
    } catch (err) {
      console.error('Error fetching assigned branch:', err);
      setErrorMsg('Failed to load branch assignment details.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedBranch();
  }, []);

  const triggerLiveLocation = (targetBranch = branch) => {
    if (!targetBranch) {
      setErrorMsg('No branch assigned to your profile.');
      setLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    setGpsLoading(true);
    setErrorMsg('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentCoords({ latitude: lat, longitude: lng });
        const dist = calculateDistance(lat, lng, targetBranch.latitude, targetBranch.longitude);
        setDistance(dist);
        setInsideArea(dist <= targetBranch.radius);
        setGpsLoading(false);
        setLoading(false);
      },
      (error) => {
        console.error('GPS error:', error);
        setErrorMsg('GPS Permission Denied or unavailable. Please enable Location Services in your browser.');
        setInsideArea(false);
        setGpsLoading(false);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('Location Verification')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Check checking-in alignment and coordinate distance clearance')}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={18} />
          <p className="text-[11px] text-amber-700 font-bold uppercase tracking-wide">{errorMsg}</p>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-20 bg-white border border-slate-100">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Querying assigned coordinates...')}</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          
          {/* Status Details Card */}
          <div className="space-y-6">
            
            {/* Alignment Checker Screen Card */}
            <div className={`card border-2 bg-white ${
              insideArea 
                ? 'border-emerald-500/20 shadow-emerald-500/5' 
                : 'border-rose-500/20 shadow-rose-500/5'
            }`}>
              
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('Verification Status')}</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                  branch?.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {branch?.name} ({t(branch?.status)})
                </span>
              </div>

              {/* Status Graphic */}
              <div className="flex flex-col items-center justify-center text-center py-6">
                
                {insideArea ? (
                  <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
                    <CheckCircle size={40} className="animate-bounce" style={{ animationDuration: '3s' }} />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-rose-50 border border-rose-100 text-rose-500 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10">
                    <AlertTriangle size={40} className="animate-pulse" />
                  </div>
                )}

                <h2 className={`text-2xl font-black tracking-tight uppercase ${
                  insideArea ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {insideArea ? t('Inside Allowed Area') : t('Outside Allowed Area')}
                </h2>
                
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 max-w-sm">
                  {insideArea 
                    ? t('Clearance granted. Geofence checks succeeded.') 
                    : `${t('Clock-in blocked.')} ${t('You must be within')} ${branch?.radius}m`}
                </p>

                {insideArea && (
                  <button
                    onClick={() => navigate('/employee/face-attendance', { state: { verified: true } })}
                    className="mt-6 group relative inline-flex items-center justify-center px-8 py-3.5 font-bold text-white transition-all duration-300 bg-emerald-500 rounded-2xl hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:-translate-y-1 overflow-hidden"
                  >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                    <ArrowRight className="mr-3" size={20} />
                    <span className="uppercase tracking-widest text-[11px]">{t('Proceed to Smart Attendance')}</span>
                  </button>
                )}
              </div>

              {/* Distance grid */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Radial Clearance Limit')}</span>
                  <p className="text-[13px] font-black text-slate-800 mt-0.5">{branch?.radius} {t('Meters')}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">{t('Your Current Distance')}</span>
                  <p className={`text-[13px] font-black mt-0.5 ${
                    insideArea ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {distance < 1 
                      ? `0.00 ${t('Meters')}` 
                      : distance >= 1000 
                        ? `${(distance / 1000).toFixed(2)} Km` 
                        : `${distance.toFixed(1)} ${t('Meters')}`}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationCheck;
