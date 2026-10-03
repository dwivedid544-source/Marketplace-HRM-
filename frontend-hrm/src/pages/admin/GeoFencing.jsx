import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  Building2,
  Users,
  CheckCircle,
  X,
  AlertCircle,
  Compass,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';

const GeoFencing = () => {
  const { showConfirm } = useUI();
  const { t } = useSettings();
  const [geofences, setGeofences] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState(null); // for custom map visual selection
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [currentId, setCurrentId] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '100',
    status: 'Active'
  });

  const [validationError, setValidationError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [gfRes, empRes] = await Promise.all([
        api.get('/geofences'),
        api.get('/employees')
      ]);
      setGeofences(gfRes.data);
      setEmployees(empRes.data);
      if (gfRes.data.length > 0) {
        setSelectedBranch(gfRes.data[0]);
      }
    } catch (err) {
      console.error('Error fetching geofencing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationError('');
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setFormData({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      radius: '100',
      status: 'Active'
    });
    setValidationError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (gf) => {
    setModalMode('edit');
    setCurrentId(gf.id);
    setFormData({
      name: gf.name,
      address: gf.address,
      latitude: gf.latitude.toString(),
      longitude: gf.longitude.toString(),
      radius: gf.radius.toString(),
      status: gf.status
    });
    setValidationError('');
    setShowModal(true);
  };

  const handleToggleStatus = async (gf) => {
    try {
      const newStatus = gf.status === 'Active' ? 'Inactive' : 'Active';
      await api.put(`/geofences/${gf.id}`, { ...gf, status: newStatus });
      setSuccessMsg(`Location status updated to ${newStatus}!`);
      fetchData();
    } catch (err) {
      console.error('Error toggling geofence status:', err);
    }
  };

  const handleDeleteGeofence = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Geofence',
      message: 'Are you sure you want to delete this geofenced location?',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.delete(`/geofences/${id}`);
      setSuccessMsg('Geofenced location deleted successfully!');
      fetchData();
    } catch (err) {
      console.error('Error deleting geofence:', err);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setValidationError('Geolocation is not supported by your browser.');
      return;
    }
    setValidationError('');

    // Add a temporary loading state text
    setFormData(prev => ({ ...prev, latitude: 'Locating...', longitude: 'Locating...' }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6).toString(),
          longitude: position.coords.longitude.toFixed(6).toString()
        }));
        setSuccessMsg('Coordinates auto-filled successfully!');
      },
      (error) => {
        console.error("Error getting location:", error);
        setFormData(prev => ({ ...prev, latitude: '', longitude: '' }));
        if (error.code === error.PERMISSION_DENIED) {
          setValidationError("Location access denied. Please enable GPS permissions.");
        } else {
          setValidationError("Could not determine location. Please enter manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSuccessMsg('');

    const { name, address, latitude, longitude, radius } = formData;
    if (!name.trim() || !address.trim() || !latitude || !longitude || !radius) {
      setValidationError('All form fields are required.');
      return;
    }

    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    const radVal = parseInt(radius);

    if (isNaN(latVal) || latVal < -90 || latVal > 90) {
      setValidationError('Latitude must be a valid number between -90 and 90.');
      return;
    }

    if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      setValidationError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    if (isNaN(radVal) || radVal < 10 || radVal > 10000) {
      setValidationError('Radius must be between 10 and 10,000 meters.');
      return;
    }

    try {
      if (modalMode === 'add') {
        await api.post('/geofences', formData);
        setSuccessMsg('New geofenced location registered!');
        setShowModal(false);
        fetchData();
      } else {
        await api.put(`/geofences/${currentId}`, formData);
        setSuccessMsg('Geofenced location details modified!');
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Error saving geofence:', err);
      setValidationError('Something went wrong. Please try again.');
    }
  };

  // Card summary calculations
  const stats = {
    total: geofences.length,
    active: geofences.filter(g => g.status === 'Active').length,
    assigned: employees.filter(e => {
      // Find branch status
      const branch = geofences.find(g => g.name === e.assigned_branch);
      return branch && branch.status === 'Active';
    }).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">{t('Geo-Fencing Setup')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Configure geographic coordinate parameters and allowed radial check-in zones')}
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          {t('Register Location')}
        </button>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-500" />
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-wide">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600"><X size={16} /></button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Locations */}
        <div className="card flex items-center gap-4 py-6 bg-white shadow-sm border border-slate-100">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Total Locations')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.total}</h3>
          </div>
        </div>

        {/* Active Locations */}
        <div className="card flex items-center gap-4 py-6 bg-white shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 shadow-sm shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Active Locations')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.active}</h3>
          </div>
        </div>

        {/* Employees Assigned */}
        <div className="card flex items-center gap-4 py-6 bg-white shadow-sm border border-slate-100">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600 shadow-sm shrink-0">
            <Users size={20} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{t('Employees Assigned')}</p>
            <h3 className="text-2xl font-black text-slate-800 leading-none mt-1">{loading ? '...' : stats.assigned}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Locations List Table */}
        <div className="card overflow-hidden !p-0 bg-white shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{t('Office Locations')}</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t('Geographic check-in boundaries and radial filters')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 pl-6 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Location Name')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Address')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Coordinates')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest text-center">{t('Allowed Radius')}</th>
                  <th className="py-4 font-black text-slate-400 text-[10px] uppercase tracking-widest">{t('Status')}</th>
                  <th className="py-4 pr-6 font-black text-slate-400 text-[10px] uppercase tracking-widest text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('Synchronizing Geofences...')}</p>
                      </div>
                    </td>
                  </tr>
                ) : geofences.length > 0 ? (
                  geofences.map((gf) => (
                    <tr
                      key={gf.id}
                      onClick={() => setSelectedBranch(gf)}
                      className={`group hover:bg-slate-50/40 transition-colors cursor-pointer ${selectedBranch?.id === gf.id ? 'bg-indigo-50/30' : ''
                        }`}
                    >
                      <td className="py-4 pl-6 font-black text-slate-800 text-[12px] uppercase tracking-tight">
                        {gf.name}
                      </td>
                      <td className="py-4 text-[11px] text-slate-600 font-bold max-w-[150px] truncate" title={gf.address}>
                        {gf.address}
                      </td>
                      <td className="py-4 text-[10px] text-slate-500 font-mono">
                        {Number(gf.latitude).toFixed(4)}, {Number(gf.longitude).toFixed(4)}
                      </td>
                      <td className="py-4 text-center">
                        <span className="text-[11px] font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {gf.radius}m
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-xl text-[9px] font-black uppercase inline-flex items-center gap-1 border ${gf.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${gf.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                          {t(gf.status)}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(gf)}
                            className={`p-2 rounded-xl transition-colors ${gf.status === 'Active'
                                ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                              }`}
                            title={gf.status === 'Active' ? 'Disable geofence' : 'Enable geofence'}
                          >
                            {gf.status === 'Active' ? <PowerOff size={14} /> : <Power size={14} />}
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(gf)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                            title="Edit coordinates"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteGeofence(gf.id)}
                            className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete location"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-20 text-center text-slate-400 text-xs font-bold">
                      {t('No Geofenced locations found. Register one above.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Location Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ maxWidth: '400px', width: '100%' }}
              className="bg-white rounded-[24px] p-6 shadow-2xl border border-slate-100 space-y-5 text-left mx-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-primary border border-slate-100 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wide leading-tight">
                      {modalMode === 'add' ? 'Register Geofence' : 'Edit Geofence'}
                    </h3>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Configure coordinates details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form content */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {validationError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2">
                    <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={14} />
                    <p className="text-[9px] text-rose-600 font-bold uppercase tracking-wide">{validationError}</p>
                  </div>
                )}

                {/* Location name */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Johannesburg HQ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Location Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="e.g. 128 Albertina Sisulu Rd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Coordinates Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest ml-1">Location Coordinates</label>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="text-[8px] flex items-center gap-1 font-black text-primary hover:text-primary-dark uppercase tracking-widest bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Auto-fill with your current GPS location"
                    >
                      <Navigation size={10} /> Get Current
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Latitude */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Latitude</label>
                      <input
                        type="text"
                        name="latitude"
                        value={formData.latitude}
                        onChange={handleInputChange}
                        placeholder="e.g. -26.2041"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold font-mono text-slate-700 focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    {/* Longitude */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Longitude</label>
                      <input
                        type="text"
                        name="longitude"
                        value={formData.longitude}
                        onChange={handleInputChange}
                        placeholder="e.g. 28.0473"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold font-mono text-slate-700 focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Radius allowed */}
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Radius (Meters)</label>
                  <input
                    type="number"
                    name="radius"
                    value={formData.radius}
                    onChange={handleInputChange}
                    placeholder="e.g. 100"
                    min="10"
                    max="10000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-1/2 py-2 border border-slate-200 rounded-xl text-center text-[9px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-dark shadow-md shadow-primary/20 transition-all"
                  >
                    {modalMode === 'add' ? 'Save' : 'Update'}
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

export default GeoFencing;
