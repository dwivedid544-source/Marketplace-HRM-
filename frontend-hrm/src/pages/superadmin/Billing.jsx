import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { CreditCard, Calendar, CheckCircle2, Clock, Plus, Trash2, Edit } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';

const STANDARD_FEATURES = [
  'AI Face Recognition Attendance', 'Kiosk Mode Support', 'Live Geo-Fencing & Tracking', 
  'Automated Payroll Management', 'Smart Leave Scheduling', 'Overtime & Claims Engine'
];

const Billing = () => {
  const { showAlert, showConfirm } = useUI();
  const { formatCurrency, formatDate } = useSettings();
  const [activeTab, setActiveTab] = useState('plans');
  const [invoices, setInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', price: '', duration: 'monthly', employee_limit: '20', description: '', buttonText: 'Get Started', features: [...STANDARD_FEATURES], isPopular: false
  });
  const [editingId, setEditingId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ company_id: '', plan_name: '', amount: '', billing_cycle: 'monthly' });

  useEffect(() => {
    fetchInvoices();
    fetchPlans();
    fetchCompanies();
  }, []);

  const fetchInvoices = () => {
    api.get('/superadmin/billing/invoices').then(res => setInvoices(res.data)).catch(console.error);
  };

  const fetchPlans = () => {
    api.get('/plans').then(res => setPlans(res.data)).catch(console.error);
  };

  const fetchCompanies = () => {
    api.get('/superadmin/companies').then(res => setCompanies(res.data)).catch(console.error);
  };

  const handleRecordPayment = async () => {
    try {
      await api.post('/superadmin/billing/record-payment', paymentData);
      setShowPaymentModal(false);
      setPaymentData({ company_id: '', plan_name: '', amount: '', billing_cycle: 'monthly' });
      showAlert('Payment recorded successfully!', 'success');
      fetchInvoices();
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.error || 'Failed to record payment', 'error');
    }
  };

  const handleSavePlan = async () => {
    try {
      const cleanedFeatures = (formData.features || []).map(f => f.trim()).filter(Boolean);
      const data = {
        name: formData.name,
        price: formData.price,
        duration: formData.duration,
        employee_limit: parseInt(formData.employee_limit) || 0,
        description: formData.description,
        buttonText: formData.buttonText || 'Get Started',
        features: cleanedFeatures,
        isPopular: formData.isPopular
      };

      if (editingId) {
        await api.put(`/plan/${editingId}`, data);
      } else {
        await api.post('/plan', data);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', price: '', duration: 'monthly', employee_limit: '20', description: '', buttonText: 'Get Started', features: [...STANDARD_FEATURES], isPopular: false });
      showAlert('Plan saved successfully', 'success');
      fetchPlans();
    } catch (err) {
      console.error(err);
      showAlert('Error saving plan', 'error');
    }
  };

  const editPlan = (p) => {
    let parsedFeatures = [];
    if (p.features) {
      if (Array.isArray(p.features)) parsedFeatures = p.features;
      else {
        try { parsedFeatures = JSON.parse(p.features); } catch(e) {}
      }
    }

    setFormData({
      name: p.name || '',
      price: p.price || '',
      duration: p.duration || 'monthly',
      employee_limit: p.employee_limit !== undefined && p.employee_limit !== null ? String(p.employee_limit) : '20',
      description: p.description || '',
      buttonText: p.buttonText || 'Get Started',
      features: parsedFeatures.length > 0 ? parsedFeatures : [...STANDARD_FEATURES],
      isPopular: !!p.isPopular
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const handleFeatureChange = (index, value) => {
    const updated = [...(formData.features || [])];
    updated[index] = value;
    setFormData({ ...formData, features: updated });
  };

  const handleAddFeature = () => {
    setFormData({ ...formData, features: [...(formData.features || []), ''] });
  };

  const handleRemoveFeature = (index) => {
    const updated = (formData.features || []).filter((_, i) => i !== index);
    setFormData({ ...formData, features: updated });
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Plan',
      message: 'Are you sure you want to delete this plan?',
      confirmText: 'Delete',
      type: 'danger'
    });

    if (confirmed) {
      try {
        await api.delete(`/plan/${id}`);
        showAlert('Plan deleted successfully', 'success');
        fetchPlans();
      } catch (err) {
        console.error(err);
        showAlert('Error deleting plan', 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Plan & Billing</h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Manage Pricing Plans and Active Subscriptions</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('plans')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'plans' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Plans</button>
          <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'billing' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Billing</button>
        </div>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Pricing Plans</h2>
            <button onClick={() => { setEditingId(null); setFormData({ name: '', price: '', duration: 'monthly', employee_limit: '20', description: '', buttonText: 'Get Started', features: [...STANDARD_FEATURES], isPopular: false }); setShowModal(true); }} className="btn-primary px-4 py-2 flex items-center gap-2 text-xs">
              <Plus size={14} /> Create Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map(p => (
              <div key={p.id} className={`p-6 bg-white rounded-2xl shadow-sm border relative ${p.isPopular ? 'border-primary/50 shadow-primary/10' : 'border-slate-100'}`}>
                {p.isPopular === 1 && <div className="absolute -top-3 left-4 bg-primary text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Popular</div>}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-slate-800 text-lg">{p.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => editPlan(p)} className="text-slate-400 hover:text-primary"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-slate-800">{p.price}</span>
                  <span className="text-slate-400 font-bold text-sm">
                    {p.duration === 'weekly' ? '/week' : p.duration === 'monthly' ? '/month' : p.duration === 'quarterly' ? '/3 months' : p.duration === 'half-yearly' ? '/6 months' : p.duration === 'annually' ? '/year' : (p.duration?.startsWith('/') ? p.duration : `/${p.duration}`)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4 h-10">{p.description}</p>
                <div className="space-y-2 mb-4 h-32 overflow-y-auto">
                  {(() => {
                    let fList = [];
                    if (p.features) {
                      fList = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
                    }
                    return fList.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 size={12} className="text-emerald-500"/> {f}</div>
                    ));
                  })()}
                </div>
                <div className="w-full py-2 bg-slate-50 text-center rounded-xl text-xs font-black text-slate-500 uppercase tracking-widest border border-slate-100">{p.buttonText || 'Get Started'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Billing History</h2>
            <button onClick={() => setShowPaymentModal(true)} className="btn-primary px-4 py-2 flex items-center gap-2 text-xs">
              <Plus size={14} /> Record Payment
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
                <tr>
                  <th className="p-4 font-black text-[10px] uppercase tracking-widest">Company</th>
                  <th className="p-4 font-black text-[10px] uppercase tracking-widest">Plan Details</th>
                  <th className="p-4 font-black text-[10px] uppercase tracking-widest">Amount</th>
                  <th className="p-4 font-black text-[10px] uppercase tracking-widest">Billing Cycle</th>
                  <th className="p-4 font-black text-[10px] uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{inv.company_name || 'Unknown Company'}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100">{inv.plan_name}</span>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest flex items-center gap-1"><Calendar size={10} /> Expires: {inv.end_date ? formatDate(inv.end_date) : 'N/A'}</p>
                    </td>
                    <td className="p-4 font-black text-slate-700">₹{parseFloat(inv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{inv.billing_cycle || 'Monthly'}</td>
                    <td className="p-4">
                      <span className={`flex w-max items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${inv.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {inv.payment_status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {inv.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.3)] w-[500px] overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-[14px] font-black text-slate-800 tracking-tight">{editingId ? 'Edit Plan' : 'Create New Plan'}</h3>
              <button onClick={() => setShowModal(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200/50 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Plan Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm" placeholder="e.g. Pro Plan" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Price</label>
                  <input type="text" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm" placeholder="e.g. ₹499" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Duration</label>
                  <select value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm cursor-pointer">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-Yearly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Max Employee Limit (0 = Unlimited)</label>
                <input type="number" min="0" value={formData.employee_limit} onChange={e => setFormData({...formData, employee_limit: e.target.value.replace(/[^0-9]/g, '')})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm" placeholder="e.g. 20 (0 for Unlimited)" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm" placeholder="Short description..." />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Button Text</label>
                <input type="text" value={formData.buttonText} onChange={e => setFormData({...formData, buttonText: e.target.value})} className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none shadow-sm" placeholder="e.g. Get Started" />
              </div>

              {/* Editable Plan Features */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Plan Features (Bullet Points)</label>
                  <button type="button" onClick={handleAddFeature} className="text-[10px] font-black text-primary hover:text-primary-dark flex items-center gap-1 uppercase tracking-wider transition-colors">
                    <Plus size={13} /> Add Point
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {(formData.features || []).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-emerald-500 shrink-0"><CheckCircle2 size={14} /></span>
                      <input 
                        type="text" 
                        value={feature} 
                        onChange={(e) => handleFeatureChange(idx, e.target.value)} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                        placeholder="Enter feature..."
                      />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Remove Point"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-1 border-t border-slate-100">
                <input type="checkbox" checked={formData.isPopular} onChange={e => setFormData({...formData, isPopular: e.target.checked})} id="popular" className="w-3.5 h-3.5 text-primary rounded border-slate-300 focus:ring-primary/30 cursor-pointer" />
                <label htmlFor="popular" className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer select-none">Mark as Popular Plan</label>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2 rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 transition-colors">Cancel</button>
              <button onClick={handleSavePlan} className="btn-primary px-5 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md">Save Plan</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.3)] w-96 overflow-hidden flex flex-col max-h-[85vh] border border-slate-100">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-[14px] font-black text-slate-800 tracking-tight">Record Subscription Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200/50 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company</label>
                <select value={paymentData.company_id} onChange={e => setPaymentData({...paymentData, company_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none">
                  <option value="" disabled>Select Company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Plan</label>
                <select value={paymentData.plan_name} onChange={e => {
                  const plan = plans.find(p => p.name === e.target.value);
                  setPaymentData({...paymentData, plan_name: e.target.value, amount: plan ? plan.price.replace(/[^0-9.]/g, '') : ''});
                }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none">
                  <option value="" disabled>Choose Plan</option>
                  {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount Paid (₹)</label>
                  <input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none" placeholder="e.g. 500" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2 rounded-b-2xl">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 transition-colors">Cancel</button>
              <button onClick={handleRecordPayment} className="btn-primary px-5 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md">Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
