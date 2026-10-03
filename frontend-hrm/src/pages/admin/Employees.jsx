import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import {
  Plus,
  Users,
  Search,
  Filter,
  MoreVertical,
  Download,
  Mail,
  Phone,
  Calendar,
  Shield,
  X,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  Briefcase,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Key,
  Building,
  TrendingUp,
  Image as ImageIcon,
  PenTool,
  Wallet,
  ShieldCheck,
  Crown,
  Sparkles,
  ArrowRight,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';

const Employees = () => {
  const navigate = useNavigate();
  const { showAlert } = useUI();
  const { currencySymbol, formatCurrency, convertAmount, t } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextIds, setNextIds] = useState({ custom_id: '', machine_id: '' });
  const [formTab, setFormTab] = useState('personal');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [limitModalData, setLimitModalData] = useState({ show: false, message: '' });
  const [planInfo, setPlanInfo] = useState(null);

  useEffect(() => {
    if (activeModal) {
      setFormTab('personal');
    }
  }, [activeModal]);

  const fetchPlanInfo = async () => {
    try {
      const res = await api.get('/settings/current-plan');
      if (res.data) {
        setPlanInfo(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch plan info:', err);
    }
  };

  const fetchNextIds = async (baseData = null) => {
    try {
      const response = await api.get('/employees/next-ids');
      const { nextCustomId, nextMachineId } = response.data;
      
      setNextIds({
        custom_id: nextCustomId,
        machine_id: nextMachineId
      });

      // Update form data - if baseData provided, use it to avoid race conditions
      setFormData(prev => ({
        ...(baseData || prev),
        custom_id: nextCustomId,
        machine_id: nextMachineId
      }));
    } catch (err) {
      console.error('Failed to fetch next IDs', err);
    }
  };

  // Signature States
  const sigPad = useRef(null);
  const [signatureType, setSignatureType] = useState('upload'); // 'draw' | 'upload'

  useEffect(() => {
    fetchEmployees();
    fetchNextIds();
    fetchPlanInfo();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees');
      setEmployees(response.data);
      setError(null);
      fetchPlanInfo();
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Failed to load employees. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(emp.custom_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const [formData, setFormData] = useState({
    machine_id: '',
    name: '',
    role: 'employee',
    email: '',
    phone: '',
    salary_rate: '',
    salary_type: 'hourly',
    password: '',
    joined_date: new Date().toISOString().split('T')[0],
    date_of_birth: '',
    photo: null,
    profileImage: null,
    uif_number: '',
    advance_balance: 0,
    signature: null,
    custom_id: '',
    status: 'active',
    is_uif_registered: true
  });

  const [previewImage, setPreviewImage] = useState(null);

  // Password Reset State
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) return alert('Only JPG, JPEG and PNG formats are allowed');
      setFormData(prev => ({ ...prev, profileImage: file }));
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, signature: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const saveDrawnSignature = () => {
    if (sigPad.current.isEmpty()) return;
    const base64 = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
    setFormData(prev => ({ ...prev, signature: base64 }));
    setSignatureType('upload');
  };

  const clearSignature = () => {
    sigPad.current?.clear();
    setFormData(prev => ({ ...prev, eSignature: null }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: null }));
    // Only allow numbers for Employee ID (custom_id)
    if (name === 'custom_id') {
      const val = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: val }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (isUpdate = false) => {
    // Validations
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Required';
    if (!formData.email?.trim()) errors.email = 'Required';
    if (!formData.phone?.trim()) errors.phone = 'Required';
    if (!isUpdate && !formData.password) errors.password = 'Required';
    if (!formData.custom_id) errors.custom_id = 'Required';
    if (!formData.date_of_birth) errors.date_of_birth = 'Required';
    if (parseFloat(formData.salary_rate || 0) <= 0) errors.salary_rate = 'Required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.salary_rate) setFormTab('payroll');
      else setFormTab('personal');
      return;
    }

    try {
      setLoading(true);
      // Auto-capture drawn signature if user forgot to click "Save Drawn"
      let finalSignature = formData.signature;
      if (!finalSignature && signatureType === 'draw' && sigPad.current) {
        try {
          // Check if it's the expected object and has the method
          const pad = sigPad.current;
          if (pad && typeof pad.isEmpty === 'function' && !pad.isEmpty()) {
            finalSignature = pad.toDataURL();
            console.log('✅ Signature captured automatically');
          }
        } catch (sigErr) {
          console.error('❌ Signature capture failed:', sigErr);
        }
      }

      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'profileImage' && formData[key]) {
          data.append('profileImage', formData[key]);
        } else if (key === 'signature') {
          if (finalSignature) data.append('signature', finalSignature);
        } else if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });

      console.log('🚀 Final Signature Size:', finalSignature ? finalSignature.length : 'EMPTY');

      if (isUpdate) {
        await api.put(`/employees/${selectedEmployee.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/employees', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        // Refresh next IDs after successful addition
        await fetchNextIds();
      }

      await fetchEmployees();
      setActiveModal(null);
      setPreviewImage(null);
      showAlert(isUpdate ? 'Employee updated successfully' : 'Employee registered successfully', 'success');
    } catch (err) {
      console.error('Submission failed:', err);
      const isPlanLimit = err.response?.status === 403 || 
                          err.response?.data?.message?.toLowerCase().includes('plan limit') ||
                          err.response?.data?.message?.toLowerCase().includes('upgrade your plan');
      if (isPlanLimit) {
        setLimitModalData({
          show: true,
          message: err.response?.data?.message || 'Plan limit reached. Your plan has reached its employee capacity limit.'
        });
      } else {
        const msg = err.response?.data?.message || 'Failed to save profile. Please check if IDs are unique.';
        showAlert(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await api.delete(`/employees/${selectedEmployee.id}`);
      await fetchEmployees();
      setActiveModal(null);
      showAlert('Employee deleted successfully', 'success');
    } catch (err) {
      showAlert(err.response?.data?.message || 'Delete failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setResetLoading(true);
      const res = await api.post(`/employees/${selectedEmployee.id}/reset-password`);
      if (res.data && res.data.tempPassword) {
        setGeneratedPassword(res.data.tempPassword);
        setActiveModal('resetPasswordResult');
      } else {
        showAlert('Failed to generate new password', 'error');
        setActiveModal(null);
      }
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.message || 'Failed to reset password', 'error');
      setActiveModal(null);
    } finally {
      setResetLoading(false);
    }
  };

  const totalEmployees = employees.length;
  const employeeLimit = planInfo?.employee_limit ? parseInt(planInfo.employee_limit) : 0;
  const isUnlimited = employeeLimit === 0;
  const isLimitReached = !isUnlimited && totalEmployees >= employeeLimit;
  const remainingSlots = isUnlimited ? 'Unlimited' : Math.max(0, employeeLimit - totalEmployees);
  const isNearLimit = !isUnlimited && remainingSlots > 0 && remainingSlots <= 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{t('Employee Directory')}</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            {t('Manage company employees and staff')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Plan Capacity & Employee Limit Badge */}
          {planInfo && (
            <div className={`px-3.5 py-1.5 rounded-2xl border flex items-center gap-2.5 transition-all shadow-xs ${
              isLimitReached 
                ? 'bg-rose-50/90 border-rose-200 text-rose-800' 
                : isNearLimit
                ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                isLimitReached 
                  ? 'bg-rose-500 text-white' 
                  : isNearLimit 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-primary/10 text-primary'
              }`}>
                <Users size={14} />
              </div>

              <div className="text-left leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-tight">
                    {isUnlimited 
                      ? `${totalEmployees} Employees` 
                      : `${totalEmployees} / ${employeeLimit} Employees`
                    }
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                    isLimitReached 
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse' 
                      : isNearLimit
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isLimitReached 
                      ? 'Limit Full' 
                      : isUnlimited 
                      ? 'Unlimited Plan' 
                      : `${remainingSlots} Left`
                    }
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Plan: <strong className="text-slate-600">{planInfo.plan_name || 'Active Plan'}</strong>
                </p>
              </div>

              {isLimitReached && (
                <button
                  onClick={() => navigate('/admin/settings?tab=subscription')}
                  className="ml-1 px-2.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  title="Upgrade Plan to add more employees"
                >
                  <span>Upgrade</span>
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => {
              const initialData = {
                machine_id: nextIds.machine_id || '', 
                name: '', role: 'employee',
                email: '', phone: '', salary_rate: '0', salary_type: 'hourly',
                password: '', joined_date: new Date().toISOString().split('T')[0],
                uif_number: '', advance_balance: 0, signature: null, 
                custom_id: '',
                status: 'active', profileImage: null,
                is_uif_registered: true, photo: null,
                contribution_applicable: false,
                employee_contribution_percentage: '',
                employer_contribution_percentage: ''
              };
              setFormData(initialData);
              setFormErrors({});
              setPreviewImage(null);
              setSignatureType('draw');
              setActiveModal('add');
              fetchNextIds(initialData);
            }}
            className="btn-primary flex items-center gap-1.5 px-4 py-2.5 rounded-2xl shadow-md shadow-primary/20 text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            <Plus size={16} /> {t('Add New Employee')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search by name, ID or email...')}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-10 py-2.5 text-[12px] font-bold"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-50/50">
              <tr className="text-left border-b border-slate-100">
                <th className="py-4 pl-4 font-black text-slate-400 text-[9px] uppercase tracking-widest w-12">{t('Sr No.')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Employee Info')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Role')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{t('Status')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Date Joined')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{t('Age')}</th>
                <th className="py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">{t('Earnings')}</th>
                <th className="py-4 text-right pr-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="8" className="py-20 text-center text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Fetching Data...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan="8" className="py-20 text-center text-xs font-black text-slate-400 uppercase tracking-widest">No records found</td></tr>
              ) : (
                filteredEmployees.map((emp, index) => (
                  <tr key={emp.id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 text-[10px] font-black text-slate-400">
                      {filteredEmployees.length - index}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shadow-sm shrink-0 flex items-center justify-center">
                          {emp.photo ? <img src={emp.photo} className="w-full h-full object-cover" /> : <Users size={20} className="text-slate-300" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-slate-800 leading-none">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[8px] font-black text-primary uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded border border-primary/10">
                              ID: {emp.custom_id}
                            </span>
                            {emp.contribution_applicable === 1 || emp.contribution_applicable === true || emp.contribution_applicable === '1' ? (
                              <span className="text-[7px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200/60 uppercase">Contrib Active</span>
                            ) : (
                              <span className="text-[7px] font-black bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 uppercase">Not Applicable</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${(emp.role || '').toLowerCase().includes('admin') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] font-bold text-slate-500 italic">
                      {emp.joined_date ? new Date(emp.joined_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                    </td>
                    <td className="py-3 text-center">
                      {emp.date_of_birth ? (() => {
                        const today = new Date();
                        const dob = new Date(emp.date_of_birth);
                        let age = today.getFullYear() - dob.getFullYear();
                        const m = today.getMonth() - dob.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
                        return (
                          <span className="text-[11px] font-black text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            {age} <span className="text-[8px] font-bold text-slate-400 uppercase">yrs</span>
                          </span>
                        );
                      })() : (
                        <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded border border-amber-100">N/A</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div>
                          <span className="text-[11px] font-black text-slate-700">{formatCurrency(emp.salary_rate)}</span>
                          <span className="text-[8px] font-black text-primary uppercase tracking-tighter ml-1">{emp.salary_type}</span>
                        </div>
                        {emp.contribution_applicable === 1 || emp.contribution_applicable === true || emp.contribution_applicable === '1' ? (
                          <button 
                            onClick={() => { setSelectedEmployee(emp); setActiveModal('contributionDetails'); }}
                            className="flex flex-col items-center bg-emerald-50 hover:bg-emerald-100/80 transition-colors px-2.5 py-1 rounded-xl border border-emerald-200/60 shadow-xs cursor-pointer group/contrib"
                            title="Click for Contribution Breakdown"
                          >
                            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest leading-none flex items-center gap-0.5">
                              Contributions ↗
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 mt-0.5">
                              {formatCurrency(emp.total_contribution_total || emp.total_cpf_total || (parseFloat(emp.total_employee_contribution || emp.total_cpf_employee || emp.total_uif_collected || 0) + parseFloat(emp.total_employer_contribution || emp.total_cpf_employer || 0)))}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[8px] font-black text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/60 uppercase tracking-wider">
                            Not Applicable
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { 
                          const curBal = parseFloat(emp.advance_balance || 0);
                          const defaultInst = emp.advance_installment !== null && emp.advance_installment !== undefined && emp.advance_installment !== ''
                            ? emp.advance_installment
                            : (curBal > 0 ? (curBal * 0.10).toFixed(2) : '');
                          setSelectedEmployee(emp); 
                          setActiveModal('advance'); 
                          setFormData({ ...emp, advance_type: 'issue', advance_amount: '', advance_installment: defaultInst }); 
                        }} className="p-2 text-slate-400 hover:text-indigo-500 transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100 flex items-center gap-1">
                          <Wallet size={14} />
                          <span className="text-[10px] font-black uppercase">Advance</span>
                        </button>
                        <button onClick={() => { setSelectedEmployee(emp); setFormData({ ...emp, contribution_applicable: emp.contribution_applicable === 1 || emp.contribution_applicable === true || emp.contribution_applicable === '1', employee_contribution_percentage: emp.employee_contribution_percentage ?? '', employer_contribution_percentage: emp.employer_contribution_percentage ?? '', signature: emp.signature || null, password: '', profileImage: null }); setPreviewImage(emp.photo); setSignatureType('upload'); setActiveModal('view'); }} className="p-2 text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100"><Eye size={16} /></button>
                        <button onClick={() => { setSelectedEmployee(emp); setFormData({ ...emp, contribution_applicable: emp.contribution_applicable === 1 || emp.contribution_applicable === true || emp.contribution_applicable === '1', employee_contribution_percentage: emp.employee_contribution_percentage ?? '', employer_contribution_percentage: emp.employer_contribution_percentage ?? '', signature: emp.signature || null, password: '', profileImage: null }); setPreviewImage(emp.photo); setSignatureType('upload'); setActiveModal('edit'); }} className="p-2 text-slate-400 hover:text-emerald-500 transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100"><Edit2 size={16} /></button>
                        <button onClick={() => { setSelectedEmployee(emp); setActiveModal('resetPasswordConfirm'); setGeneratedPassword(''); }} className="p-2 text-slate-400 hover:text-amber-500 transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100"><Key size={16} /></button>
                        <button onClick={() => { setSelectedEmployee(emp); setActiveModal('delete'); }} className="p-2 text-slate-400 hover:text-rose-500 transition-all rounded-xl hover:bg-white shadow-sm border border-transparent hover:border-slate-100"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(activeModal === 'view' || activeModal === 'edit' || activeModal === 'add') && (
          <Modal title={activeModal === 'view' ? 'Employee Profile' : activeModal === 'edit' ? 'Update Employee' : 'New Employee Registration'} onClose={() => setActiveModal(null)}>
            <div className="space-y-5">
              <div className="flex items-center gap-6 pb-4 border-b border-slate-100">
                <div className="flex-1">
                  <h2 className="text-lg font-black text-slate-800 leading-none">{formData.name || 'New Employee'}</h2>
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">Employee</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100 pb-1.5 gap-4">
                {[
                  { id: 'personal', label: 'Personal Info', hasError: formErrors.name || formErrors.email || formErrors.phone || formErrors.password || formErrors.custom_id || formErrors.date_of_birth },
                  { id: 'payroll', label: 'Compensation & Sign', hasError: formErrors.salary_rate }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFormTab(tab.id)}
                    className={`pb-1 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 relative ${
                      formTab === tab.id
                        ? 'border-primary text-primary'
                        : tab.hasError
                        ? 'border-rose-500 text-rose-500'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab.label}
                    {tab.hasError && <span className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                
                {/* ─── PERSONAL TAB ─── */}
                {formTab === 'personal' && (
                  <>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.name ? 'text-rose-500' : 'text-slate-400'}`}>Full Name</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">{formData.name}</p> : <input type="text" name="name" value={formData.name} onChange={handleInputChange} className={`input-field ${formErrors.name ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} placeholder="e.g. Rahul Sharma" />}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                      <div className="px-4 py-2.5 bg-slate-100/70 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 flex items-center justify-between">
                        <span>Employee</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                          Default
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.email ? 'text-rose-500' : 'text-slate-400'}`}>Email</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">{formData.email}</p> : <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={`input-field ${formErrors.email ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} />}
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.phone ? 'text-rose-500' : 'text-slate-400'}`}>Phone Number</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">{formData.phone}</p> : <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className={`input-field ${formErrors.phone ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} placeholder="e.g. +27 123 456 789" />}
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.password ? 'text-rose-500' : 'text-slate-400'}`}>Portal Password</label>
                      {activeModal === 'view' ? (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">••••••••</p>
                      ) : (
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            name="password" 
                            value={formData.password} 
                            onChange={handleInputChange} 
                            className={`input-field pr-12 ${formErrors.password ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} 
                            placeholder={activeModal === 'edit' ? "Leave empty to keep current" : "Enter password"} 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee ID</label>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm flex items-center gap-1">
                          ⚡ Auto-Generated
                        </span>
                      </div>
                      <p className="px-4 py-2.5 bg-slate-100/70 rounded-xl text-sm font-extrabold text-slate-700 cursor-not-allowed border border-slate-200/80 flex items-center justify-between shadow-inner">
                        <span>{formData.custom_id || 'Generating...'}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm flex items-center gap-1">
                          🔒 Locked
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Joining Date</label>
                      {activeModal === 'view' ? (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">
                          {formData.joined_date ? new Date(formData.joined_date).toLocaleDateString() : '---'}
                        </p>
                      ) : (
                        <input type="date" name="joined_date" value={formData.joined_date ? formData.joined_date.split('T')[0] : ''} onChange={handleInputChange} className="input-field" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.date_of_birth ? 'text-rose-500' : 'text-slate-400'}`}>Date of Birth *</label>
                      {activeModal === 'view' ? (
                        <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">
                          {formData.date_of_birth ? new Date(formData.date_of_birth).toLocaleDateString() : <span className="text-slate-400 text-xs">Not set</span>}
                        </p>
                      ) : (
                        <input type="date" name="date_of_birth" required value={formData.date_of_birth ? formData.date_of_birth.split('T')[0] : ''} onChange={handleInputChange} className={`input-field ${formErrors.date_of_birth ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} />
                      )}
                    </div>
                  </>
                )}

                {/* ─── PAYROLL TAB ─── */}
                {formTab === 'payroll' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salary Type</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold uppercase">{formData.salary_type}</p> : (
                        <select name="salary_type" value={formData.salary_type} onChange={handleInputChange} className="input-field">
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.salary_rate ? 'text-rose-500' : 'text-slate-400'}`}>Salary Rate ({currencySymbol})</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">{formData.salary_rate}</p> : <input type="number" name="salary_rate" value={formData.salary_rate} onChange={handleInputChange} className={`input-field ${formErrors.salary_rate ? '!border-rose-500 ring-1 ring-rose-500/20' : ''}`} />}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Advance Balance ({currencySymbol})</label>
                      {activeModal === 'view' ? <p className="px-4 py-2.5 bg-slate-50 rounded-xl text-sm font-bold">{currencySymbol}{formData.advance_balance}</p> : <input type="number" name="advance_balance" value={formData.advance_balance} onChange={handleInputChange} className="input-field" />}
                    </div>

                    {/* Employee Contribution & Deductions Override */}
                    <div className="sm:col-span-2 p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck size={16} className="text-emerald-600" /> Contribution Applicable
                          </label>
                          <p className="text-[11px] font-bold text-slate-500">
                            Apply retirement / PF / Social Security deductions for this employee.
                          </p>
                        </div>
                        {activeModal === 'view' ? (
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${formData.contribution_applicable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {formData.contribution_applicable ? 'Yes / Active' : 'No / Disabled'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, contribution_applicable: !prev.contribution_applicable }))}
                            className={`w-12 h-6 rounded-full relative transition-all p-1 shadow-sm ${formData.contribution_applicable ? 'bg-emerald-600' : 'bg-slate-300'}`}
                          >
                            <motion.div
                              animate={{ x: formData.contribution_applicable ? 24 : 0 }}
                              className="h-4 w-4 bg-white rounded-full shadow-sm"
                            />
                          </button>
                        )}
                      </div>

                      {formData.contribution_applicable && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              Employee Contribution (%)
                            </label>
                            {activeModal === 'view' ? (
                              <p className="px-3.5 py-2 bg-white rounded-xl text-sm font-black text-slate-800 border border-slate-100">
                                {formData.employee_contribution_percentage !== null && formData.employee_contribution_percentage !== '' ? `${formData.employee_contribution_percentage}%` : 'Company Default'}
                              </p>
                            ) : (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  name="employee_contribution_percentage"
                                  value={formData.employee_contribution_percentage ?? ''}
                                  onChange={handleInputChange}
                                  placeholder="Leave empty for Company Default"
                                  className="input-field pr-8 text-xs font-bold"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                              </div>
                            )}
                            <p className="text-[9px] font-bold text-slate-400 ml-1">Optional override (e.g. 10%)</p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              Employer Contribution (%)
                            </label>
                            {activeModal === 'view' ? (
                              <p className="px-3.5 py-2 bg-white rounded-xl text-sm font-black text-slate-800 border border-slate-100">
                                {formData.employer_contribution_percentage !== null && formData.employer_contribution_percentage !== '' ? `${formData.employer_contribution_percentage}%` : 'Company Default'}
                              </p>
                            ) : (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  name="employer_contribution_percentage"
                                  value={formData.employer_contribution_percentage ?? ''}
                                  onChange={handleInputChange}
                                  placeholder="Leave empty for Company Default"
                                  className="input-field pr-8 text-xs font-bold"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                              </div>
                            )}
                            <p className="text-[9px] font-bold text-slate-400 ml-1">Optional override (e.g. 10%)</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2 space-y-2 mt-4 pt-4 border-t border-slate-50">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><PenTool size={12} /> E-Signature</label>
                      {activeModal !== 'view' ? (
                        <div className="space-y-3">
                          <div className="flex gap-2 mb-2">
                            <button type="button" onClick={() => setSignatureType('draw')} className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${signatureType === 'draw' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>Draw</button>
                            <button type="button" onClick={() => setSignatureType('upload')} className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${signatureType === 'upload' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>Upload</button>
                          </div>
                          {signatureType === 'draw' ? (
                            <>
                              <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-white overflow-hidden"><SignatureCanvas ref={sigPad} canvasProps={{ className: 'w-full h-40' }} backgroundColor="white" /></div>
                              <div className="flex gap-2"><button type="button" onClick={clearSignature} className="btn-secondary py-1 px-3 text-[9px]">Clear</button><button type="button" onClick={saveDrawnSignature} className="btn-primary py-1 px-3 text-[9px]">Save Drawn</button></div>
                            </>
                          ) : (
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                              <div className="w-48 h-20 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">{formData.signature ? <img src={formData.signature} className="max-h-full object-contain" /> : <span className="text-[9px] font-black text-slate-300 uppercase">Empty</span>}</div>
                              <input type="file" id="sig-up" className="hidden" accept=".jpg,.jpeg,.png" onChange={handleSignatureUpload} /><label htmlFor="sig-up" className="btn-secondary py-2 px-4 cursor-pointer text-[10px]">Choose File</label>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-48 h-20 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">{formData.signature ? <img src={formData.signature} className="max-h-full object-contain" /> : <span className="text-[9px] font-black text-slate-300 uppercase">No Signature</span>}</div>
                      )}
                    </div>
                  </>
                )}

              </div>

              <div className="pt-6 flex justify-end gap-3 bg-white sticky bottom-0 border-t border-slate-50">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary px-6">Cancel</button>
                {activeModal !== 'view' && <button onClick={() => handleSubmit(activeModal === 'edit')} disabled={loading} className="btn-primary px-8 shadow-lg shadow-primary/20">{loading ? 'Saving...' : 'Save Profile'}</button>}
              </div>
            </div>
          </Modal>
        )}

        {activeModal === 'advance' && (
          <Modal title="Record Advance Payment" onClose={() => setActiveModal(null)} type="delete">
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                  {formData.advance_type === 'repay' ? 'Repay / Deduct Advance' : 'Issue Advance'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Employee: {selectedEmployee?.name}</p>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-slate-200 dark:bg-slate-700/60 p-1 rounded-2xl border border-slate-300 dark:border-slate-600">
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({ ...prev, advance_type: 'issue' }))} 
                  className={`flex-1 py-2.5 px-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${formData.advance_type !== 'repay' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >
                  ➕ Issue Advance (+)
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({ ...prev, advance_type: 'repay' }))} 
                  className={`flex-1 py-2.5 px-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${formData.advance_type === 'repay' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >
                  ➖ Repay / Deduct (-)
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {formData.advance_type === 'repay' ? 'Repayment Amount' : 'Advance Amount'} ({currencySymbol})
                    </label>
                    {selectedEmployee?.advance_balance > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const curBal = selectedEmployee.advance_balance;
                          setFormData(prev => ({ 
                            ...prev, 
                            advance_type: 'repay', 
                            advance_amount: curBal,
                            advance_installment: 0
                          }));
                        }}
                        className="text-[10px] font-black text-rose-500 hover:underline uppercase tracking-wider"
                      >
                        Clear Full Balance
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    className="input-field text-center text-xl font-black"
                    value={formData.advance_amount}
                    onChange={(e) => {
                      const newAmount = e.target.value;
                      const curBal = parseFloat(selectedEmployee?.advance_balance || 0);
                      const totalBal = formData.advance_type === 'repay' ? Math.max(0, curBal - (parseFloat(newAmount) || 0)) : curBal + (parseFloat(newAmount) || 0);
                      const default10Pct = totalBal > 0 ? (totalBal * 0.10).toFixed(2) : '0.00';
                      setFormData(prev => ({ 
                        ...prev, 
                        advance_amount: newAmount,
                        advance_installment: default10Pct
                      }));
                    }}
                    placeholder="0.00"
                  />
                  <p className="text-[9px] font-bold text-amber-600 text-center uppercase tracking-widest mt-2">
                    Current Balance: {currencySymbol}{selectedEmployee?.advance_balance || 0}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Deduct per cycle ({currencySymbol}) - Default 10%
                    </label>
                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100 uppercase">
                      10% Standard
                    </span>
                  </div>
                  <input
                    type="number"
                    className="input-field text-center text-xl font-black"
                    value={formData.advance_installment !== undefined ? formData.advance_installment : ''}
                    onChange={(e) => setFormData({ ...formData, advance_installment: e.target.value })}
                    placeholder={`e.g. ${(parseFloat(selectedEmployee?.advance_balance || 0) * 0.10).toFixed(2)}`}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
                    {[
                      { label: '10% (Fixed)', pct: 0.10 },
                      { label: '20%', pct: 0.20 },
                      { label: '25%', pct: 0.25 },
                      { label: '50%', pct: 0.50 },
                      { label: '100% (Full)', pct: 1.00 }
                    ].map(preset => {
                      const curBal = parseFloat(selectedEmployee?.advance_balance || 0);
                      const amount = parseFloat(formData.advance_amount || 0);
                      const totalBal = formData.advance_type === 'repay' ? Math.max(0, curBal - amount) : curBal + amount;
                      const val = (totalBal * preset.pct).toFixed(2);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, advance_installment: val }))}
                          className="text-[8px] font-black uppercase bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-1 rounded border border-slate-200 hover:border-indigo-200 transition-colors"
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setActiveModal(null)} className="flex-1 btn-secondary py-3">Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const curBal = parseFloat(selectedEmployee.advance_balance || 0);
                      const amount = parseFloat(formData.advance_amount || 0);
                      let newBalance = curBal;
                      
                      if (formData.advance_type === 'repay') {
                          newBalance = Math.max(0, curBal - amount);
                      } else {
                          newBalance = curBal + amount;
                      }
                      
                      let installment = null;
                      if (formData.advance_installment !== undefined && formData.advance_installment !== '') {
                          installment = parseFloat(formData.advance_installment);
                      } else if (selectedEmployee?.advance_installment !== undefined && formData.advance_installment === undefined) {
                          installment = selectedEmployee.advance_installment;
                      }

                      await api.put(`/employees/${selectedEmployee.id}`, { 
                          ...selectedEmployee, 
                          advance_balance: newBalance,
                          advance_installment: installment
                      });
                      await fetchEmployees();
                      setActiveModal(null);
                    } catch (err) {
                      alert('Failed to update advance');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className={`flex-1 btn-primary py-3 font-black text-xs uppercase tracking-wider ${formData.advance_type === 'repay' ? '!bg-rose-600 hover:!bg-rose-700 shadow-rose-600/20' : ''}`}
                >
                  {loading ? 'Processing...' : (formData.advance_type === 'repay' ? 'Confirm Repayment' : 'Confirm Payment')}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {activeModal === 'delete' && (
          <Modal title="Confirm Termination" onClose={() => setActiveModal(null)} type="delete">
            <div className="text-center py-6 space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce"><Trash2 size={32} /></div>
              <p className="text-sm font-bold text-slate-600">Delete <span className="text-slate-900 font-black">{selectedEmployee?.name}</span>? This is permanent.</p>
              <div className="flex gap-3">
                <button onClick={() => setActiveModal(null)} disabled={loading} className="flex-1 btn-secondary py-3 disabled:opacity-50">Cancel</button>
                <button onClick={handleDelete} disabled={loading} className="flex-1 bg-rose-500 text-white font-black py-3 rounded-2xl shadow-xl shadow-rose-500/20 uppercase text-[10px] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Deleting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Contribution Details Modal */}
        {activeModal === 'contributionDetails' && selectedEmployee && (
          <Modal title="Contribution & Deduction Details" onClose={() => setActiveModal(null)}>
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">{selectedEmployee.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    ID: {selectedEmployee.custom_id || selectedEmployee.id}
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="text-xs font-bold text-slate-600">Employee Contribution / Deduction</span>
                  <span className="text-sm font-black text-rose-600">
                    {currencySymbol}{parseFloat(selectedEmployee.total_employee_contribution || selectedEmployee.total_cpf_employee || selectedEmployee.total_uif_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                  <span className="text-xs font-bold text-slate-600">Employer Contribution</span>
                  <span className="text-sm font-black text-blue-600">
                    {currencySymbol}{parseFloat(selectedEmployee.total_employer_contribution || selectedEmployee.total_cpf_employer || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Total Accumulated Contribution</span>
                  <span className="text-base font-black text-emerald-600">
                    {currencySymbol}{parseFloat(selectedEmployee.total_contribution_total || selectedEmployee.total_cpf_total || (parseFloat(selectedEmployee.total_employee_contribution || selectedEmployee.total_cpf_employee || selectedEmployee.total_uif_collected || 0) + parseFloat(selectedEmployee.total_employer_contribution || selectedEmployee.total_cpf_employer || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-primary py-2.5 px-6">
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Reset Password Confirmation Modal */}
      <AnimatePresence>
        {activeModal === 'resetPasswordConfirm' && (
          <Modal title="Reset Password" onClose={() => setActiveModal(null)}>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-black text-amber-800">Are you sure?</h3>
                    <p className="text-xs text-amber-700 mt-1">
                      This will generate a new secure password for <strong>{selectedEmployee?.name}</strong>. The old password will immediately stop working.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setActiveModal(null)} className="btn-secondary">Cancel</button>
                <button onClick={handleResetPassword} disabled={resetLoading} className="btn-primary bg-amber-600 hover:bg-amber-700">
                  {resetLoading ? 'Generating...' : 'Yes, Generate Password'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Reset Password Result Modal */}
      <AnimatePresence>
        {activeModal === 'resetPasswordResult' && (
          <Modal title="Password Reset Successful" onClose={() => setActiveModal(null)}>
            <div className="space-y-4 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">New Password Generated</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Please copy this password and share it securely with <strong>{selectedEmployee?.name}</strong>.
                </p>
              </div>
              <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xl font-mono font-black text-slate-800 tracking-wider">{generatedPassword}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                  }}
                  className="px-3 py-1.5 bg-white text-[10px] font-black uppercase text-primary border border-slate-200 shadow-sm rounded-lg hover:bg-slate-50"
                >
                  Copy
                </button>
              </div>
              <button type="button" onClick={() => setActiveModal(null)} className="btn-primary w-full mt-4">Done</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Plan Limit Reached Premium Modal */}
      <AnimatePresence>
        {limitModalData.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative my-auto"
              style={{ width: '92%', maxWidth: '420px' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Accent Gradient Bar */}
              <div className="h-2 bg-gradient-to-r from-amber-400 via-primary to-purple-600"></div>

              {/* Close Button */}
              <button
                onClick={() => setLimitModalData({ show: false, message: '' })}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="p-6 sm:p-7 text-center space-y-3.5">
                {/* Glowing Crown Icon */}
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                  <Crown size={28} className="animate-pulse" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black uppercase tracking-wider mb-2">
                    <Sparkles size={11} /> Upgrade Required
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    Employee Limit Reached
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed px-1">
                    Please upgrade your plan to create more employees.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    onClick={() => {
                      setLimitModalData({ show: false, message: '' });
                      setActiveModal(null);
                      navigate('/admin/settings?tab=subscription');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary-dark hover:to-purple-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>👑 Upgrade Plan Now</span>
                    <ArrowRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setLimitModalData({ show: false, message: '' })}
                    className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Continue & Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Modal = ({ title, children, onClose, type = 'default' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="modal-overlay"
  >
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className={`modal-box ${type === 'delete' ? 'modal-sm' : 'w-full mx-4'}`}
      style={{ maxWidth: type === 'delete' ? '440px' : '640px' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h3>
        <button onClick={onClose} className="p-2 text-white bg-rose-500 hover:bg-rose-600 transition-colors rounded-xl shadow-sm">
          <X size={18} />
        </button>
      </div>
      <div className="modal-body custom-scrollbar">
        {children}
      </div>
    </motion.div>
  </motion.div>
);

export default Employees;
