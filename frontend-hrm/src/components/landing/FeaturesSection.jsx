import React from 'react';
import { motion } from 'framer-motion';
import { ScanFace, QrCode, MapPin, CalendarClock, UserCheck, ShieldAlert, Users, Calendar, Fingerprint, Lock, Banknote, ScrollText, PieChart, Download, ShieldCheck } from 'lucide-react';

const featureCategories = [
  {
    title: 'Attendance Management',
    description: 'Track attendance accurately with AI face recognition and GPS tracking.',
    icon: <CalendarClock size={28} className="text-primary-light" />,
    colorTheme: 'from-primary/20 to-primary/5',
    borderColor: 'border-primary/30',
    iconBg: 'bg-primary/20',
    features: [
      { name: 'AI Face Recognition', icon: ScanFace },
      { name: 'Kiosk Attendance Mode', icon: Fingerprint },
      { name: 'GPS Geofence Tracking', icon: MapPin },
      { name: 'Shift & Overtime Engine', icon: CalendarClock }
    ]
  },
  {
    title: 'HR & Employees',
    description: 'Centralized hub for employee records, leaves, and organization structures.',
    icon: <Users size={28} className="text-accent-light" />,
    colorTheme: 'from-accent/20 to-accent/5',
    borderColor: 'border-accent/30',
    iconBg: 'bg-accent/20',
    features: [
      { name: 'Employee Directory & Records', icon: UserCheck },
      { name: 'Leave Requests & Approvals', icon: Calendar },
      { name: 'Department Management', icon: Users },
      { name: 'Public Holiday Calendar', icon: Calendar }
    ]
  },
  {
    title: 'Payroll System',
    description: 'Automate monthly salary calculations and PDF payslips without errors.',
    icon: <Banknote size={28} className="text-success" />,
    colorTheme: 'from-success/20 to-success/5',
    borderColor: 'border-success/30',
    iconBg: 'bg-success/20',
    features: [
      { name: 'Automated Salary Calculation', icon: Banknote },
      { name: 'Allowances & Tax Deductions', icon: PieChart },
      { name: 'PDF Payslip Generator', icon: Download },
      { name: 'Salary Advance Tracking', icon: ScrollText }
    ]
  },
  {
    title: 'Security & Control',
    description: 'Enterprise-grade isolation and access controls for multi-tenant data.',
    icon: <Lock size={28} className="text-secondary" />,
    colorTheme: 'from-secondary/20 to-secondary/5',
    borderColor: 'border-secondary/30',
    iconBg: 'bg-secondary/20',
    features: [
      { name: 'Role-Based Access (Admin / Staff)', icon: ShieldAlert },
      { name: 'Multi-Tenant Company Isolation', icon: Lock },
      { name: 'Audit Trail & Activity Logs', icon: ScrollText },
      { name: 'Device Binding & SSL Security', icon: ShieldCheck }
    ]
  }
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[500px] bg-accent/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-primary-light font-semibold tracking-wide uppercase text-xs mb-5 backdrop-blur-md">
              Enterprise Capabilities
            </div>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-white mb-6 tracking-tight">
              Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-secondary">manage your workforce</span>
            </h3>
            <p className="text-lg md:text-xl text-slate-400">
              Powerful features designed to automate HR workflows, increase productivity, and keep your data secure with next-gen AI tech.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {featureCategories.map((category, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="glass-card-dark p-8 md:p-10 group"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.colorTheme} border ${category.borderColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-glass`}>
                  {category.icon}
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-white font-heading mb-1">{category.title}</h4>
                  <p className="text-sm text-slate-400">{category.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {category.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                    <div className={`w-10 h-10 rounded-lg ${category.iconBg} flex items-center justify-center shrink-0`}>
                      <feature.icon size={18} className="text-white opacity-80" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">{feature.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
