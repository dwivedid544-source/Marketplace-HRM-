import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Plus, Edit, Trash2, Eye, EyeOff, X, RefreshCw, Key, Ban, CheckCircle2, Building2, Sparkles, Crown, ShieldAlert, Search, Users, Phone, Mail, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../../context/UIContext';

const Companies = () => {
  const { showAlert, showConfirm } = useUI();
  const [companies, setCompanies] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewAmount, setRenewAmount] = useState('0');
  const [renewPlan, setRenewPlan] = useState('');
  const [renewCompany, setRenewCompany] = useState(null);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'view'
  const [showPassword, setShowPassword] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'trial', 'paid', 'active', 'suspended'
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    company_name: '',
    owner_name: '',
    email: '',
    phone: '',
    plan: '',
    employee_limit: '',
    status: 'active'
  });
  const [currentId, setCurrentId] = useState(null);
  
  // Password Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  useEffect(() => { 
    fetchCompanies(); 
    fetchPlans();
  }, []);
  
  const fetchCompanies = () => {
    api.get('/superadmin/companies').then(res => setCompanies(res.data)).catch(console.error);
  };

  const fetchPlans = () => {
    api.get('/plans').then(res => setAvailablePlans(res.data)).catch(console.error);
  };

  const getPlanName = (planIdentifier) => {
    if (!planIdentifier) return 'No Plan';
    const planObj = availablePlans.find(p => p.id === parseInt(planIdentifier) || p.name === planIdentifier);
    return planObj ? planObj.name : planIdentifier;
  };

  const isTrial = (c) => {
    const planName = (c.active_plan || c.plan || '').toLowerCase();
    const cycle = (c.plan_billing_cycle || '').toLowerCase();
    return planName.includes('trial') || planName.includes('free') || cycle === 'weekly' || !c.plan_amount || parseFloat(c.plan_amount) === 0;
  };

  const getDaysLeft = (c) => {
    // 1. If backend provides the exact plan_expiry date from subscriptions
    if (c.plan_expiry) {
      const expiry = new Date(c.plan_expiry);
      const today = new Date();
      const expiryMidnight = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const diffTime = expiryMidnight - todayMidnight;
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (days < 0) return 'Expired';
      if (days === 0) return 'Expires Today';
      if (days === 1) return '1 Day Left';
      return `${days} Days Left`;
    }

    // 2. Fallback calculation based on cycle & plan name
    const createdAt = new Date(c.plan_created_at || c.created_at);
    const cycle = (c.plan_billing_cycle || '').toLowerCase();
    const planName = (c.active_plan || c.plan || '').toLowerCase();

    let daysToAdd = 7;
    if (planName.includes('free') || planName.includes('trial') || cycle === 'weekly' || cycle.includes('7')) {
      daysToAdd = 7;
    } else if (cycle === 'quarterly' || cycle.includes('3 month')) {
      daysToAdd = 90;
    } else if (cycle === 'half-yearly' || cycle.includes('6 month')) {
      daysToAdd = 180;
    } else if (cycle === 'annually' || cycle === 'yearly' || cycle.includes('year')) {
      daysToAdd = 365;
    } else {
      daysToAdd = 30;
    }
    
    const createdMidnight = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endMidnight = new Date(createdMidnight.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    const diffTime = endMidnight - todayMidnight;
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires Today';
    if (days === 1) return '1 Day Left';
    return `${days} Days Left`;
  };

  const handleToggleStatus = async (company) => {
    const isCurrentlyActive = company.status === 'active';
    const newStatus = isCurrentlyActive ? 'suspended' : 'active';
    
    const confirmed = await showConfirm({
      title: isCurrentlyActive ? 'Suspend Company Account' : 'Reactivate Company Account',
      message: `Are you sure you want to ${isCurrentlyActive ? 'SUSPEND' : 'REACTIVATE'} "${company.company_name}"? ${
        isCurrentlyActive 
          ? 'This will immediately lock and block all dashboard access for this company and their employees.'
          : 'This will restore active dashboard access for this company.'
      }`,
      confirmText: isCurrentlyActive ? 'Suspend Company' : 'Reactivate',
      type: isCurrentlyActive ? 'danger' : 'info'
    });

    if (confirmed) {
      try {
        await api.patch(`/superadmin/company/${company.id}/status`, { status: newStatus });
        showAlert(`Company "${company.company_name}" ${newStatus === 'suspended' ? 'suspended' : 'reactivated'} successfully`, 'success');
        fetchCompanies();
      } catch (err) {
        console.error('Failed to update status:', err);
        showAlert(err.response?.data?.error || err.response?.data?.message || 'Failed to update company status', 'error');
      }
    }
  };

  // KPI Calculations
  const totalCount = companies.length;
  const trialCount = companies.filter(c => isTrial(c) && c.status === 'active').length;
  const paidCount = companies.filter(c => !isTrial(c) && c.status === 'active').length;
  const activeCount = companies.filter(c => c.status === 'active').length;
  const suspendedCount = companies.filter(c => c.status === 'suspended' || c.status === 'inactive').length;

  const filteredCompanies = companies.filter(c => {
    if (filterTab === 'trial' && !isTrial(c)) return false;
    if (filterTab === 'paid' && isTrial(c)) return false;
    if (filterTab === 'active' && c.status !== 'active') return false;
    if (filterTab === 'suspended' && c.status !== 'suspended' && c.status !== 'inactive') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = (c.company_name || '').toLowerCase().includes(q);
      const matchOwner = (c.owner_name || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchPlan = (c.active_plan || c.plan || '').toLowerCase().includes(q);
      return matchName || matchOwner || matchEmail || matchPhone || matchPlan;
    }
    return true;
  });

  const openModal = (mode, company = null) => {
    setModalMode(mode);
    if (company) {
      setCurrentId(company.id);
      setFormData({
        company_name: company.company_name,
        owner_name: company.owner_name,
        email: company.email,
        phone: company.phone,
        plan: company.active_plan || company.plan,
        employee_limit: company.employee_limit,
        status: company.status,
        admin_count: company.admin_count,
        employee_count: company.employee_count,
        total_users: company.total_users,
        password: ''
      });
    } else {
      setCurrentId(null);
      setFormData({
        company_name: '',
        owner_name: '',
        email: '',
        phone: '',
        plan: '',
        employee_limit: '',
        status: 'active',
        password: '',
        total_users: 0
      });
    }
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'add') {
        await api.post('/superadmin/company', formData);
      } else if (modalMode === 'edit') {
        await api.put(`/superadmin/company/${currentId}`, formData);
      }
      showAlert('Company settings saved successfully', 'success');
      fetchCompanies();
      closeModal();
    } catch (err) {
      console.error(err);
      showAlert('Error saving company', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Company',
      message: 'Are you sure you want to delete this company? All associated data and employees will be lost permanently.',
      confirmText: 'Delete Company',
      type: 'danger'
    });

    if (confirmed) {
      try {
        await api.delete(`/superadmin/company/${id}`);
        showAlert('Company deleted successfully', 'success');
        fetchCompanies();
      } catch (err) {
        console.error(err);
        showAlert('Error deleting company', 'error');
      }
    }
  };

  const handleResetPassword = async (company) => {
    const confirmed = await showConfirm({
      title: 'Reset Admin Password',
      message: `Are you sure you want to reset the password for ${company.company_name}'s admin (${company.owner_name})? A new password will be auto-generated.`,
      confirmText: 'Reset Password',
      type: 'warning'
    });

    if (confirmed) {
      try {
        setResetLoading(true);
        const res = await api.post(`/superadmin/company/${company.id}/reset-password`);
        if (res.data && res.data.tempPassword) {
          setGeneratedPassword(res.data.tempPassword);
          setResetModalOpen(true);
        } else {
          showAlert('Failed to generate new password', 'error');
        }
      } catch (err) {
        console.error(err);
        showAlert(err.response?.data?.message || 'Failed to reset password', 'error');
      } finally {
        setResetLoading(false);
      }
    }
  };

  const openRenewModal = (company) => {
    setRenewCompany(company);
    const currentPlanName = getPlanName(company.active_plan || company.plan);
    setRenewPlan(currentPlanName);
    
    const matchedPlan = availablePlans.find(p => p.name === currentPlanName);
    if (matchedPlan) {
      setRenewAmount(matchedPlan.price);
    } else {
      setRenewAmount('0');
    }
    setIsRenewModalOpen(true);
  };

  const handleRenewPlanChange = (e) => {
    const selectedPlanName = e.target.value;
    setRenewPlan(selectedPlanName);
    const plan = availablePlans.find(p => p.name === selectedPlanName);
    if (plan) {
      setRenewAmount(plan.price);
    }
  };

  const closeRenewModal = () => {
    setIsRenewModalOpen(false);
    setRenewCompany(null);
  };

  const submitManualRenew = async (e) => {
    e.preventDefault();
    if (!renewCompany) return;
    
    try {
      await api.post('/superadmin/billing/record-payment', {
        company_id: renewCompany.id,
        plan_name: renewPlan,
        amount: parseFloat(renewAmount) || 0
      });
      showAlert('Subscription renewed successfully', 'success');
      fetchCompanies();
      closeRenewModal();
    } catch (err) {
      console.error(err);
      showAlert('Error renewing subscription', 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'plan') {
      const selectedPlan = availablePlans.find(p => p.name === value);
      let newLimit = formData.employee_limit;
      if (selectedPlan) {
        try {
          const feats = typeof selectedPlan.features === 'string' ? JSON.parse(selectedPlan.features) : selectedPlan.features;
          if (feats && feats.length > 0) {
            const match = feats[0].match(/\d+/);
            if (match) newLimit = parseInt(match[0], 10);
          }
        } catch(err) {}
      }
      setFormData({ ...formData, [name]: value, employee_limit: newLimit });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  return (
    <div className="space-y-5 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Companies & Subscriptions</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            Manage client businesses, Free Trials & Dashboard access
          </p>
        </div>
        <button onClick={() => openModal('add')} className="btn-primary flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2.5 shadow-sm">
          <Plus size={16}/> Add Company
        </button>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Companies */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Clients</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalCount}</h3>
          </div>
        </div>

        {/* Free Trials */}
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50/40 rounded-2xl p-4 border border-violet-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-violet-200">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest leading-none">Free Trials</p>
              <span className="px-1.5 py-0.2 bg-violet-200/60 text-violet-800 text-[8px] font-black rounded-full uppercase">7-Day</span>
            </div>
            <h3 className="text-2xl font-black text-violet-900 mt-1">{trialCount}</h3>
          </div>
        </div>

        {/* Paid Subscriptions */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50/40 rounded-2xl p-4 border border-blue-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
            <Crown size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest leading-none">Paid Subscriptions</p>
            <h3 className="text-2xl font-black text-blue-900 mt-1">{paidCount}</h3>
          </div>
        </div>

        {/* Suspended / Inactive */}
        <div className="bg-gradient-to-br from-rose-50 to-pink-50/40 rounded-2xl p-4 border border-rose-100 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-200">
            <Ban size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest leading-none">Suspended / Blocked</p>
            <h3 className="text-2xl font-black text-rose-900 mt-1">{suspendedCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { id: 'all', label: `All (${totalCount})`, icon: <Building2 size={13} /> },
            { id: 'trial', label: `🎁 Free Trial (${trialCount})`, icon: null },
            { id: 'paid', label: `👑 Paid (${paidCount})`, icon: null },
            { id: 'active', label: `⚡ Active (${activeCount})`, icon: null },
            { id: 'suspended', label: `🚫 Suspended (${suspendedCount})`, icon: null },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                filterTab === t.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, owner, email..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Companies Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Company & Owner</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Contact</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Subscription Plan</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest">Status</th>
                <th className="p-4 font-black text-[10px] uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCompanies.map(c => {
                const companyIsTrial = isTrial(c);
                const isSuspended = c.status === 'suspended' || c.status === 'inactive';

                return (
                  <tr key={c.id} className={`hover:bg-slate-50/80 transition-colors ${isSuspended ? 'bg-rose-50/30' : ''}`}>
                    {/* Name & Owner */}
                    <td className="p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 text-[13px]">{c.company_name}</span>
                          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">ID #{c.id}</span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                          <Users size={11} className="text-slate-400" /> {c.owner_name}
                        </p>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-4 text-xs font-semibold text-slate-600">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="font-mono text-[11px]">{c.email}</span>
                        </div>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px]">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Plan & Expiry */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        {companyIsTrial ? (
                          <span className="px-2.5 py-0.5 bg-violet-100 text-violet-800 rounded-lg text-[9px] font-black uppercase tracking-wider border border-violet-200 flex items-center gap-1">
                            <Sparkles size={10} className="text-violet-600" /> Free Trial (7 Days)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-wider border border-indigo-200 flex items-center gap-1">
                            <Crown size={10} className="text-amber-500" /> {getPlanName(c.active_plan || c.plan)}
                          </span>
                        )}

                        {(c.plan_created_at || c.created_at) && (
                          <span className={`text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1 ${
                            getDaysLeft(c) === 'Expired' ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            <Clock size={10} /> {getDaysLeft(c)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-xs inline-flex items-center gap-1 ${
                        c.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : c.status === 'suspended'
                          ? 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {c.status}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="p-4">
                      <div className="flex gap-1.5 justify-center items-center">
                        {/* Suspend / Reactivate Button */}
                        <button
                          onClick={() => handleToggleStatus(c)}
                          className={`p-1.5 rounded-lg transition-all border ${
                            c.status === 'active'
                              ? 'text-rose-500 hover:text-white hover:bg-rose-600 border-rose-200 hover:border-rose-600 bg-rose-50/50'
                              : 'text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-200 hover:border-emerald-600 bg-emerald-50/50'
                          }`}
                          title={c.status === 'active' ? 'Suspend Company (Block Dashboard Access)' : 'Reactivate / Unsuspend Company'}
                        >
                          {c.status === 'active' ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                        </button>

                        {/* Manual Renew */}
                        <button onClick={() => openRenewModal(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Manual Renew / Record Payment">
                          <RefreshCw size={15}/>
                        </button>

                        {/* View Details */}
                        <button onClick={() => openModal('view', c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100" title="View Details">
                          <Eye size={15}/>
                        </button>

                        {/* Reset Password */}
                        <button onClick={() => handleResetPassword(c)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100" title="Reset Admin Password" disabled={resetLoading}>
                          <Key size={15} className={resetLoading ? 'animate-spin' : ''} />
                        </button>

                        {/* Edit Company */}
                        <button onClick={() => openModal('edit', c)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100" title="Edit Company">
                          <Edit size={15}/>
                        </button>

                        {/* Delete Company */}
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100" title="Delete Company">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400">
                    <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">No companies found</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Try changing your search term or filter tab</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Result Modal */}
      <AnimatePresence>
        {resetModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={() => setResetModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col pointer-events-auto overflow-hidden">
                <div className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <Key size={32} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Password Reset Successful</h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium">Please share this new password with the Admin securely.</p>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mt-4 relative group">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">New Password</p>
                    <p className="text-3xl font-mono text-slate-800 font-black tracking-wider break-all">{generatedPassword}</p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        showAlert('Password copied to clipboard!', 'success');
                      }}
                      className="absolute top-2 right-2 p-2 bg-white text-slate-400 hover:text-primary rounded-lg border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setResetModalOpen(false)} className="btn-primary px-6 py-2">Done</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Renew Modal */}
      <AnimatePresence>
        {isRenewModalOpen && renewCompany && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={closeRenewModal} />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl w-full shadow-2xl flex flex-col pointer-events-auto" style={{ maxWidth: '450px' }}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">Renew Subscription</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manual Payment Record</p>
                  </div>
                  <button onClick={closeRenewModal} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><X size={20}/></button>
                </div>

                <form onSubmit={submitManualRenew} className="flex flex-col">
                  <div className="p-6 space-y-5">
                    <p className="text-xs text-slate-600 font-medium">
                      Record manual payment and renew subscription for <strong className="text-slate-800 font-black">{renewCompany.company_name}</strong>.
                    </p>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Plan *</label>
                        <select
                          required
                          value={renewPlan}
                          onChange={handleRenewPlanChange}
                          className="input-field w-full cursor-pointer"
                        >
                          <option value="" disabled>Select Plan</option>
                          {availablePlans.map(p => (
                            <option key={p.id} value={p.name}>{p.name} - ₹{p.price.replace(/[^0-9.]/g, '') || p.price}/{p.duration}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount Received *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            required
                            value={renewAmount}
                            onChange={(e) => setRenewAmount(e.target.value)}
                            className="input-field w-full pl-8"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                    <button type="button" onClick={closeRenewModal} className="px-5 py-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-200 rounded-xl transition-colors uppercase tracking-widest">Cancel</button>
                    <button type="submit" className="btn-primary px-6 py-2.5 text-[11px] font-black uppercase tracking-widest shadow-md hover:shadow-lg">
                      Confirm Renewal
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40" onClick={closeModal} />
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-2xl w-full shadow-2xl flex flex-col max-h-[90vh] pointer-events-auto" style={{ maxWidth: '600px' }}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                  <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                    {modalMode === 'add' ? 'Add New Company' : modalMode === 'edit' ? 'Edit Company' : 'Company Details'}
                  </h2>
                  <button onClick={closeModal} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                  {modalMode === 'view' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Name</p>
                        <p className="font-bold text-slate-800">{formData.company_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Owner Name</p>
                        <p className="font-bold text-slate-800">{formData.owner_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                        <p className="font-bold text-slate-800">{formData.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                        <p className="font-bold text-slate-800">{formData.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subscription Plan</p>
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">{formData.plan}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${formData.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{formData.status}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee Limit</p>
                        <p className="font-bold text-slate-800">{formData.employee_limit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Users Created</p>
                        <p className="font-bold text-slate-800">{formData.total_users || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Admin Count</p>
                        <p className="font-bold text-slate-800">{formData.admin_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Staff Count</p>
                        <p className="font-bold text-slate-800">{formData.employee_count || 0}</p>
                      </div>
                    </div>
                  ) : (
                    <form id="companyForm" onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Company Name *</label>
                          <input required type="text" name="company_name" value={formData.company_name} onChange={handleChange} className="input-field w-full" placeholder="Enter company name" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Owner Name *</label>
                          <input required type="text" name="owner_name" value={formData.owner_name} onChange={handleChange} className="input-field w-full" placeholder="Enter owner name" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email *</label>
                          <input required type="email" name="email" value={formData.email} onChange={handleChange} className="input-field w-full" placeholder="contact@company.com" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone</label>
                          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="input-field w-full" placeholder="+1 234 567 8900" />
                        </div>
                        {modalMode === 'add' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              Admin Password *
                            </label>
                            <div className="relative">
                              <input 
                                required
                                type={showPassword ? "text" : "password"} 
                                name="password" 
                                value={formData.password || ''} 
                                onChange={handleChange} 
                                className="input-field w-full pr-10" 
                                placeholder="••••••••" 
                              />
                              <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Subscription Plan *</label>
                          <select required name="plan" value={formData.plan} onChange={handleChange} className={`input-field w-full ${modalMode === 'edit' ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'cursor-pointer'}`} disabled={modalMode === 'edit'}>
                            <option value="" disabled>Select Plan</option>
                            {availablePlans.length === 0 && <option value="Basic" disabled>Loading plans...</option>}
                            {availablePlans.map(p => {
                              let empCountText = 'Custom';
                              try {
                                const feats = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
                                if (feats && feats.length > 0) empCountText = feats[0];
                              } catch(e) {}
                              return <option key={p.id} value={p.name}>{p.name} ({empCountText})</option>;
                            })}
                          </select>
                          {modalMode === 'edit' && <p className="text-[10px] text-amber-600 font-bold mt-1 ml-1">Use the "Renew" button from the table to change plans.</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Employee Limit</label>
                          <input type="number" name="employee_limit" value={formData.employee_limit} onChange={handleChange} className="input-field w-full" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Status</label>
                          <select name="status" value={formData.status} onChange={handleChange} className="input-field w-full cursor-pointer">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
                
                {modalMode !== 'view' && (
                  <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                    <button type="button" onClick={closeModal} className="px-5 py-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-200 rounded-xl transition-colors uppercase tracking-widest">Cancel</button>
                    <button type="submit" form="companyForm" className="btn-primary px-6 py-2.5 text-[11px] font-black uppercase tracking-widest shadow-md hover:shadow-lg">
                      {modalMode === 'add' ? 'Create Company' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Companies;
