import React, { useState, useEffect } from 'react';
import api from '../../utils/axios';
import { Package, Plus, Trash2, Edit, CheckCircle2, Layers } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';

const STANDARD_FEATURES = [
  'AI Face Recognition Attendance', 'Kiosk Mode Support', 'Live Geo-Fencing & Tracking', 
  'Automated Payroll Management', 'Smart Leave Scheduling', 'Overtime & Claims Engine'
];

const Plans = () => {
  const { showAlert, showConfirm } = useUI();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', price: '', duration: 'monthly', employee_limit: '20', description: '', buttonText: 'Get Started', features: [...STANDARD_FEATURES], isPopular: false
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = () => {
    setLoading(true);
    api.get('/plans')
      .then(res => setPlans(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
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
      message: 'Are you sure you want to delete this pricing plan?',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2.5">
            <Package className="text-primary w-6 h-6" /> Pricing Plans
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Configure SaaS subscription pricing tiers, feature limits & popular badges
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              price: '',
              duration: 'monthly',
              employee_limit: '20',
              description: '',
              buttonText: 'Get Started',
              features: [...STANDARD_FEATURES],
              isPopular: false
            });
            setShowModal(true);
          }}
          className="btn-primary px-5 py-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 cursor-pointer"
        >
          <Plus size={16} /> Create Plan
        </button>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">No Pricing Plans Created</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">Click the button below to create your first SaaS subscription tier.</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary px-6 py-2.5 text-xs font-bold rounded-xl"
          >
            Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map(p => (
            <div key={p.id} className={`p-6 bg-white rounded-3xl shadow-sm border relative flex flex-col justify-between transition-all hover:shadow-md ${p.isPopular ? 'border-primary/50 shadow-primary/10' : 'border-slate-100'}`}>
              {p.isPopular === 1 && (
                <div className="absolute -top-3 left-6 bg-gradient-to-r from-primary to-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full shadow-md shadow-primary/20">
                  Most Popular
                </div>
              )}
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-slate-800 text-xl tracking-tight">{p.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Max {p.employee_limit ? `${p.employee_limit} Employees` : 'Unlimited'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    <button onClick={() => editPlan(p)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-white rounded-lg transition-colors cursor-pointer" title="Edit Plan">
                      <Edit size={15} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-colors cursor-pointer" title="Delete Plan">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">₹{p.price}</span>
                    <span className="text-slate-400 font-bold text-xs">
                      {p.duration === 'weekly' ? '/week' : p.duration === 'monthly' ? '/month' : p.duration === 'quarterly' ? '/3 months' : p.duration === 'half-yearly' ? '/6 months' : p.duration === 'annually' ? '/year' : (p.duration?.startsWith('/') ? p.duration : `/${p.duration}`)}
                    </span>
                  </div>
                  {p.description && <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">{p.description}</p>}
                </div>

                <div className="space-y-2.5 mb-6">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Plan Features:</span>
                  {(() => {
                    let fList = [];
                    if (p.features) {
                      fList = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
                    }
                    return fList.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="w-full py-2.5 bg-slate-50 text-center rounded-xl text-xs font-black text-slate-600 uppercase tracking-widest border border-slate-200">
                {p.buttonText || 'Active Tier'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-[95vw] sm:w-[480px] lg:w-[35vw] max-w-[520px] overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 my-auto">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editingId ? 'Edit Pricing Plan' : 'Create Pricing Plan'}</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Define features, billing cycle and price</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors cursor-pointer">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Starter Plan, Pro Plan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Price (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="999"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Billing Cycle</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (3 Months)</option>
                    <option value="half-yearly">Half Yearly (6 Months)</option>
                    <option value="annually">Annually (1 Year)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Employee Limit</label>
                  <input
                    type="number"
                    placeholder="50 (0 for unlimited)"
                    value={formData.employee_limit}
                    onChange={(e) => setFormData({ ...formData, employee_limit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Button Label</label>
                  <input
                    type="text"
                    placeholder="Get Started"
                    value={formData.buttonText}
                    onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">Short Description</label>
                <textarea
                  placeholder="e.g. Best suited for growing teams and startups"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              {/* Features List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Features Included</label>
                  <button type="button" onClick={handleAddFeature} className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
                    <Plus size={12} /> Add Feature
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                  {(formData.features || []).map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={feat}
                        onChange={(e) => handleFeatureChange(idx, e.target.value)}
                        placeholder={`Feature #${idx + 1}`}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <label htmlFor="isPopular" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Mark as "Most Popular" / Recommended Tier
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/20 transition-all"
              >
                Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Plans;
