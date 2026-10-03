import React, { useState } from 'react';
import { Save, Globe, Bell, Building2, Mail, Clock, DollarSign, BellRing, BellOff, MessageSquare, AlertTriangle, CheckCircle2, CreditCard, Calendar, Share2, Shield, Phone, MapPin, Image, Link2, FileText, Upload, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/axios';
import { useSettings } from '../../context/SettingsContext';
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES, SUPPORTED_LANGUAGES, getCountryByCode } from '../../config/countryConfig';

const Toggle = ({ checked, onChange, id }) => (
  <button
    id={id}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
      checked ? 'bg-primary' : 'bg-slate-200'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
);

const InputField = ({ label, value, onChange, type = 'text', placeholder = '', icon, required = false }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
      {label} {required && '*'}
    </label>
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-slate-400 placeholder:font-medium ${icon ? 'pl-9' : ''}`}
      />
    </div>
  </div>
);

const TextAreaField = ({ label, value, onChange, placeholder = '', rows = 3 }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
      {label}
    </label>
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-slate-400 placeholder:font-medium resize-none"
    />
  </div>
);

const Settings = () => {
  const { setLocalization } = useSettings();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);

  // General Settings State
  const [general, setGeneral] = useState({
    platform_name: 'HR Pilot Pro',
    powered_by: 'Kiaan Technology',
    support_email: 'support@hrpilotpro.com',
    country: 'India',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    date_format: 'DD/MM/YYYY',
    language: 'English',
  });

  // Company Info State
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '',
    company_logo: '',
    company_address: '',
    contact_number: '',
    about_us: '',
    whatsapp_number: '',
    company_website: 'https://kiaantechnology.com/',
  });

  // Social Media State
  const [social, setSocial] = useState({
    social_linkedin: '',
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    social_youtube: '',
  });

  // Legal State
  const [legal, setLegal] = useState({
    privacy_policy: '',
    terms_conditions: '',
    copyright_text: '',
  });

  const [notifications, setNotifications] = useState({
    emailNewCompany: true,
    emailCompanyRequest: true,
    emailPlanRenewalRequest: true,
    emailNewEnquiry: true,
    systemNewLogin: true,
    systemCompanyExpiry: true,
    systemExpiry3Day: true,
    systemExpiry1Day: true,
    systemLowStorage: false,
    digestFrequency: 'daily',
  });

  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={15} /> },
    { id: 'company', label: 'Company Info', icon: <Building2 size={15} /> },
    { id: 'social', label: 'Social Media', icon: <Share2 size={15} /> },
    { id: 'legal', label: 'Legal', icon: <Shield size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  ];

  React.useEffect(() => {
    api.get('/settings/global')
      .then(res => {
        if (res.data && Object.keys(res.data).length > 0) {
          setGeneral({
            platform_name: res.data.platform_name || 'HRM Software Pro',
            powered_by: res.data.powered_by || 'Kiaan Technology',
            support_email: res.data.support_email || 'support@hrmsoftware.com',
            country: res.data.country || 'India',
            timezone: res.data.timezone || 'Asia/Kolkata',
            currency: res.data.currency || 'INR',
            date_format: res.data.date_format || 'DD/MM/YYYY',
            language: res.data.language || 'English',
          });
          setCompanyInfo({
            company_name: res.data.company_name || '',
            company_logo: res.data.company_logo || '',
            company_address: res.data.company_address || '',
            contact_number: res.data.contact_number || '',
            about_us: res.data.about_us || '',
            whatsapp_number: res.data.whatsapp_number || '',
            company_website: res.data.company_website || 'https://kiaantechnology.com/',
          });
          setSocial({
            social_linkedin: res.data.social_linkedin || '',
            social_facebook: res.data.social_facebook || '',
            social_instagram: res.data.social_instagram || '',
            social_twitter: res.data.social_twitter || '',
            social_youtube: res.data.social_youtube || '',
          });
          setLegal({
            privacy_policy: res.data.privacy_policy || '',
            terms_conditions: res.data.terms_conditions || '',
            copyright_text: res.data.copyright_text || '',
          });
          if (res.data.notifications) {
              setNotifications(res.data.notifications);
          }
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    try {
      await api.put('/settings/global', { ...general, ...companyInfo, ...social, ...legal, notifications });
      
      // Instantly update the Context to make it "live" across the app
      setLocalization(prev => ({
        ...prev,
        country: general.country || 'India',
        currency: general.currency || 'INR',
        language: general.language || 'English',
        timezone: general.timezone || 'Asia/Kolkata',
        dateFormat: general.date_format || 'DD/MM/YYYY'
      }));

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyInfo({ ...companyInfo, company_logo: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            Platform Settings
          </h1>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
            Configure global platform preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-sm transition-all duration-300 ${
            saved
              ? 'bg-green-500 text-white shadow-green-200'
              : 'btn-primary shadow-primary/20'
          }`}
        >
          {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Tab Sidebar */}
        <div className="w-full lg:w-52 shrink-0">
          <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-2 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-[11px] font-black uppercase tracking-widest ${
                  activeTab === tab.id
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >

              {/* ─── GENERAL TAB ─── */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  {/* Platform & Branding Identity */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                        <Globe size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Platform & Branding Names
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Separate settings for Website Title and Powered By banner
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InputField
                        label="Platform / Website Title (Navbar & Logo Name)"
                        value={general.platform_name}
                        onChange={v => setGeneral({...general, platform_name: v})}
                        placeholder="HRM Software Pro"
                        icon={<Globe size={14} />}
                      />
                      <InputField
                        label="Powered By Attribution (Top Marquee Banner)"
                        value={general.powered_by}
                        onChange={v => setGeneral({...general, powered_by: v})}
                        placeholder="Kiaan Technology"
                        icon={<Building2 size={14} />}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3 ml-1">
                      💡 "Platform Title" will be shown next to the logo on top header, while "Powered By" will appear in the top scrolling marquee ("POWERED BY {general.powered_by || 'KIAAN TECHNOLOGY'}").
                    </p>
                  </div>

                  {/* Localization */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-500 flex items-center justify-center">
                        <Clock size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Country, Currency & Localization
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Set global platform country, base currency, language and time formatting
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Country Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Primary Operating Country
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer"
                          value={general.country || 'India'}
                          onChange={e => {
                            const selectedCountry = e.target.value;
                            const countryObj = getCountryByCode(selectedCountry);
                            setGeneral(prev => ({
                              ...prev,
                              country: selectedCountry,
                              currency: countryObj ? countryObj.currency : prev.currency,
                              language: countryObj ? countryObj.defaultLanguage : prev.language,
                              timezone: countryObj ? countryObj.defaultTimezone : prev.timezone
                            }));
                          }}
                        >
                          {SUPPORTED_COUNTRIES.map(c => (
                            <option key={c.code} value={c.name}>
                              {c.flag} {c.name} ({c.code}) - {c.currency} ({c.currencySymbol})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Currency Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Default Currency
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer"
                          value={general.currency}
                          onChange={e => setGeneral({ ...general, currency: e.target.value })}
                        >
                          {SUPPORTED_CURRENCIES.map(curr => (
                            <option key={curr.code} value={curr.code}>
                              {curr.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Language Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Default Platform Language
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer"
                          value={general.language}
                          onChange={e => setGeneral({ ...general, language: e.target.value })}
                        >
                          {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.name}>
                              {lang.name} ({lang.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Timezone Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Default Timezone
                        </label>
                        <div className="relative">
                          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select
                            className="input-field w-full pl-9 cursor-pointer"
                            value={general.timezone}
                            onChange={e => setGeneral({ ...general, timezone: e.target.value })}
                          >
                            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30) - 🇮🇳 India</option>
                            <option value="America/New_York">America/New_York (EST) - 🇺🇸 USA</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PST) - 🇺🇸 USA</option>
                            <option value="Europe/London">Europe/London (GMT) - 🇬🇧 UK</option>
                            <option value="Asia/Dubai">Asia/Dubai (GST +4:00) - 🇦🇪 UAE</option>
                            <option value="Europe/Berlin">Europe/Berlin (CET +1:00) - 🇩🇪 Germany</option>
                            <option value="Europe/Madrid">Europe/Madrid (CET +1:00) - 🇪🇸 Spain</option>
                          </select>
                        </div>
                      </div>

                      {/* Date Format */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Date Format
                        </label>
                        <select 
                          value={general.date_format}
                          onChange={e => setGeneral({...general, date_format: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all cursor-pointer"
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY (UK, India, UAE, Spain, Germany)</option>
                          <option value="MM/DD/YYYY">MM/DD/YYYY (USA)</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO International)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* ─── COMPANY INFO TAB ─── */}
              {activeTab === 'company' && (
                <div className="space-y-4">
                  {/* Company Identity */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                        <Building2 size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Company Identity
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Displayed on website footer and landing page
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InputField
                        label="Company Name"
                        value={companyInfo.company_name}
                        onChange={v => setCompanyInfo({...companyInfo, company_name: v})}
                        placeholder="ABC Technologies"
                        icon={<Building2 size={14} />}
                      />
                      <InputField
                        label="Support Email"
                        type="email"
                        value={general.support_email}
                        onChange={v => setGeneral({...general, support_email: v})}
                        placeholder="support@company.com"
                        icon={<Mail size={14} />}
                      />
                      <InputField
                        label="Contact Number"
                        value={companyInfo.contact_number}
                        onChange={v => setCompanyInfo({...companyInfo, contact_number: v})}
                        placeholder="+91 9876543210"
                        icon={<Phone size={14} />}
                      />
                      <InputField
                        label="Company Address"
                        value={companyInfo.company_address}
                        onChange={v => setCompanyInfo({...companyInfo, company_address: v})}
                        placeholder="123 Main St, Mumbai, Maharashtra, India"
                        icon={<MapPin size={14} />}
                      />
                      <InputField
                        label="WhatsApp Number"
                        value={companyInfo.whatsapp_number}
                        onChange={v => setCompanyInfo({...companyInfo, whatsapp_number: v})}
                        placeholder="+91 9876543210"
                        icon={<MessageCircle size={14} />}
                      />
                      <InputField
                        label="Official Company Website URL"
                        value={companyInfo.company_website}
                        onChange={v => setCompanyInfo({...companyInfo, company_website: v})}
                        placeholder="https://kiaantechnology.com"
                        icon={<Globe size={14} />}
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3 ml-1">
                      Website URL will appear with a Globe icon in the website footer alongside Instagram & WhatsApp
                    </p>
                  </div>

                  {/* Company Logo */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-500 flex items-center justify-center">
                        <Image size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Company Logo
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Recommended: 200x60px, Max 2MB (PNG, JPG, SVG)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {/* Logo Preview */}
                      <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {companyInfo.company_logo ? (
                          <img src={companyInfo.company_logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <div className="text-center">
                            <Image size={24} className="text-slate-300 mx-auto" />
                            <p className="text-[9px] font-bold text-slate-400 mt-1">No Logo</p>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-indigo-100 transition-colors border border-indigo-100 w-fit">
                          <Upload size={14} />
                          Upload Logo
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>
                        {companyInfo.company_logo && (
                          <button
                            onClick={() => setCompanyInfo({...companyInfo, company_logo: ''})}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* About Us */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                        <FileText size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          About Us
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Short description for footer and landing page
                        </p>
                      </div>
                    </div>
                    <TextAreaField
                      label="Company Description"
                      value={companyInfo.about_us}
                      onChange={v => setCompanyInfo({...companyInfo, about_us: v})}
                      placeholder="Automating attendance, payroll, and HR management for modern businesses worldwide..."
                      rows={4}
                    />
                  </div>
                </div>
              )}



              {/* ─── SOCIAL MEDIA TAB ─── */}
              {activeTab === 'social' && (
                <div className="space-y-4">
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Share2 size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Social Media Links
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Displayed as icons in the website footer
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <InputField
                        label="Official Company Website URL (Globe Icon in Footer)"
                        value={companyInfo.company_website}
                        onChange={v => setCompanyInfo({...companyInfo, company_website: v})}
                        placeholder="https://kiaantechnology.com"
                        icon={<Globe size={14} />}
                      />
                      <InputField
                        label="LinkedIn"
                        value={social.social_linkedin}
                        onChange={v => setSocial({...social, social_linkedin: v})}
                        placeholder="https://linkedin.com/company/your-company"
                        icon={<Link2 size={14} />}
                      />
                      <InputField
                        label="Facebook"
                        value={social.social_facebook}
                        onChange={v => setSocial({...social, social_facebook: v})}
                        placeholder="https://facebook.com/your-company"
                        icon={<Link2 size={14} />}
                      />
                      <InputField
                        label="Instagram"
                        value={social.social_instagram}
                        onChange={v => setSocial({...social, social_instagram: v})}
                        placeholder="https://instagram.com/your-company"
                        icon={<Link2 size={14} />}
                      />
                      <InputField
                        label="X (Twitter)"
                        value={social.social_twitter}
                        onChange={v => setSocial({...social, social_twitter: v})}
                        placeholder="https://x.com/your-company"
                        icon={<Link2 size={14} />}
                      />
                      <InputField
                        label="YouTube"
                        value={social.social_youtube}
                        onChange={v => setSocial({...social, social_youtube: v})}
                        placeholder="https://youtube.com/@your-company"
                        icon={<Link2 size={14} />}
                      />
                    </div>
                  </div>
                </div>
              )}



              {/* ─── LEGAL TAB ─── */}
              {activeTab === 'legal' && (
                <div className="space-y-4">
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                        <Shield size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Legal Documents
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Privacy policy, terms, and copyright
                        </p>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <InputField
                        label="Copyright Text"
                        value={legal.copyright_text}
                        onChange={v => setLegal({...legal, copyright_text: v})}
                        placeholder="© 2026 ABC Technologies. All rights reserved."
                      />
                      <TextAreaField
                        label="Privacy Policy"
                        value={legal.privacy_policy}
                        onChange={v => setLegal({...legal, privacy_policy: v})}
                        placeholder="Enter your privacy policy text here..."
                        rows={8}
                      />
                      <TextAreaField
                        label="Terms & Conditions"
                        value={legal.terms_conditions}
                        onChange={v => setLegal({...legal, terms_conditions: v})}
                        placeholder="Enter your terms & conditions text here..."
                        rows={8}
                      />
                    </div>
                  </div>
                </div>
              )}



              {/* ─── NOTIFICATIONS TAB ─── */}
              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  {/* Email Notifications */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                        <Bell size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          Platform Notifications
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Alerts shown in your dashboard
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[
                        { key: 'emailNewCompany', label: 'New Company Registered', desc: 'When a new company is added manually by SuperAdmin' },
                        { key: 'emailCompanyRequest', label: 'Company Request Received', desc: 'When a potential client registers from the Landing Page' },
                        { key: 'emailPlanRenewalRequest', label: 'Plan Renewal Request', desc: 'When an existing company requests to renew or upgrade their plan' },
                        { key: 'emailNewEnquiry', label: 'New Enquiry Received', desc: 'When a user submits a contact support enquiry' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                              {item.label}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                          <Toggle
                            id={`toggle-${item.key}`}
                            checked={notifications[item.key]}
                            onChange={val => setNotifications({ ...notifications, [item.key]: val })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Alerts */}
                  <div className="card bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                        <AlertTriangle size={14} />
                      </div>
                      <div>
                        <h3 className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                          System Alerts
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                          Critical system-level events
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[
                        { key: 'systemCompanyExpiry', label: 'Subscription Expiry (7 Days)', desc: 'Alert 7 days before a company subscription expires' },
                        { key: 'systemExpiry3Day', label: 'Subscription Expiry (3 Days)', desc: 'Alert 3 days before a company subscription expires' },
                        { key: 'systemExpiry1Day', label: 'Subscription Expiry (1 Day)', desc: 'Final warning 1 day before a company subscription expires' },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                              {item.label}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                          <Toggle
                            id={`toggle-${item.key}`}
                            checked={notifications[item.key]}
                            onChange={val => setNotifications({ ...notifications, [item.key]: val })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>


                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Settings;
