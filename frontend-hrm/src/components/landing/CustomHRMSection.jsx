import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sliders, Globe, Palette, Sparkles, Bot, Zap, 
  ArrowRight, CheckCircle2, User, Building2, Mail, Phone, MessageSquare
} from 'lucide-react';
import { useSiteInfo } from '../../context/SiteInfoContext';

const WhatsAppIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

const CustomHRMSection = () => {
  const { siteInfo } = useSiteInfo();
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    message: ''
  });

  const features = [
    {
      icon: <Sliders className="w-5 h-5 text-primary-light" />,
      title: "SaaS Customization",
      desc: "Custom modules, workflows, reports, and business rules."
    },
    {
      icon: <Globe className="w-5 h-5 text-cyan-400" />,
      title: "Personal Domain",
      desc: "Use HRM software on your own company domain."
    },
    {
      icon: <Palette className="w-5 h-5 text-pink-400" />,
      title: "Personal Branding",
      desc: "Your logo, colors, and branded employee experience."
    },
    {
      icon: <Bot className="w-5 h-5 text-emerald-400" />,
      title: "AI & Automation",
      desc: "Smart automation and AI-powered HR improvements."
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.company || !formData.email || !formData.phone || !formData.message) {
      return;
    }

    // Determine WhatsApp number from site settings or default fallback
    const rawNumber = siteInfo.whatsapp_number || siteInfo.contact_number || '+919876543210';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');

    const message = `Hello Kiaan Technology Team,

I am interested in a Custom HRM Solution.

Name:
${formData.name}

Company:
${formData.company}

Email:
${formData.email}

Phone:
${formData.phone}

Requirement:
${formData.message}

Please contact me regarding the custom plan.

Thank you.`;

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <section id="custom-solution" className="py-16 relative overflow-hidden z-20">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl bg-navy-dark/70 border border-white/10 backdrop-blur-xl p-8 sm:p-10 lg:p-12 shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden"
        >
          {/* Subtle Corner Glows */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-primary/15 via-transparent to-transparent rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-emerald-500/15 via-transparent to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
            
            {/* Left Column: Heading, Description & 4 Highlight Cards */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary-light text-xs font-bold uppercase tracking-wider mb-4">
                  <Sparkles size={13} className="text-primary-light animate-pulse" />
                  Custom Enterprise Solution
                </div>
                <h3 className="text-3xl sm:text-4xl font-heading font-extrabold text-white leading-tight tracking-tight">
                  Build Your Custom HRM <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-teal-300 to-emerald-400">
                    Solution With Us
                  </span>
                </h3>
                <p className="text-slate-400 text-sm sm:text-base mt-3 leading-relaxed">
                  Need a customized HR platform for your business? We create solutions based on your workflow, branding, and business requirements.
                </p>
              </div>

              {/* 4 Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {features.map((feat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.05] transition-all duration-300 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform shrink-0">
                        {feat.icon}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-primary-light transition-colors">
                          {feat.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {feat.desc}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Column: Compact CTA Form */}
            <div className="lg:col-span-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="bg-navy-dark/95 border border-white/15 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden"
              >
                <div className="mb-5">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare size={18} className="text-emerald-400" />
                    Request Custom Plan
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Fill the quick form to discuss directly on WhatsApp with our engineering team.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Name */}
                    <div className="relative">
                      <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        required
                        placeholder="Your Name *"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>

                    {/* Company Name */}
                    <div className="relative">
                      <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text"
                        required
                        placeholder="Company Name *"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Email */}
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="email"
                        required
                        placeholder="Work Email *"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>

                    {/* Phone */}
                    <div className="relative">
                      <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="tel"
                        required
                        placeholder="Phone / WhatsApp *"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Requirement Message */}
                  <div>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Requirement Message (e.g. Custom biometric integration, payroll rules, white-label app) *"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2.5 group"
                  >
                    <WhatsAppIcon className="w-5 h-5 text-white fill-current" />
                    <span>Discuss Custom Plan</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>

                  <p className="text-[10px] text-center text-slate-400 pt-1">
                    ⚡ Instant WhatsApp redirect • Pre-filled requirement message
                  </p>
                </form>
              </motion.div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CustomHRMSection;
