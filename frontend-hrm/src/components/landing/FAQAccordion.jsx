import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Sparkles } from 'lucide-react';

const faqs = [
  {
    question: 'How easy is it to configure biometric attendance?',
    answer: 'It is highly straightforward. Once you register employee face profiles in the system, our smart edge recognition technology automatically syncs check-in/out logs directly with your dashboard.',
  },
  {
    question: 'Do I need technical skills to set up payroll?',
    answer: 'Not at all. Our system is designed with a user-friendly interface. You can set up payroll rules, tax deductions, and bonuses in a few clicks. Our support team is also available to help you with the initial configuration.',
  },
  {
    question: 'Is my company data secure?',
    answer: 'Yes, we take security very seriously. All data is encrypted both in transit and at rest using bank-grade AES-256 encryption. We also provide role-based access control and detailed activity logs.',
  },
  {
    question: 'Does the system support mobile devices?',
    answer: 'Absolutely. Employees can use our responsive mobile web app to mark attendance (via GPS or QR code), apply for leaves, and view their payslips on the go.',
  },
  {
    question: 'Can I upgrade or downgrade my plan later?',
    answer: 'Yes, you can change your subscription plan at any time from your billing dashboard. Changes will be pro-rated and reflected in your next billing cycle.',
  },
  {
    question: 'How does the 7-day Free Trial work?',
    answer: 'You receive instant access to all enterprise HRM modules for 7 days with zero upfront payment or credit card required. You can upgrade to a paid plan anytime without losing any configured data.',
  },
];

const FAQAccordion = () => {
  const [openIndices, setOpenIndices] = useState({ 0: true });

  const toggleIndex = (index) => {
    setOpenIndices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <section id="faq" className="pt-8 pb-14 relative overflow-hidden z-20">
      {/* Background subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-48 bg-primary/10 rounded-full blur-[110px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Compact Header */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary-light text-[11px] font-bold tracking-wider uppercase mb-2 backdrop-blur-md">
              <Sparkles size={11} className="text-primary-light" />
              GOT QUESTIONS?
            </div>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
              Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-secondary">Questions</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Everything you need to know about the platform, security, and billing.
            </p>
          </motion.div>
        </div>

        {/* 2-Column 50/50 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
          {faqs.map((faq, index) => {
            const isOpen = !!openIndices[index];
            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                className={`rounded-2xl border transition-all duration-300 backdrop-blur-md flex flex-col justify-between ${
                  isOpen 
                    ? 'bg-navy-dark/90 border-primary/40 shadow-[0_4px_20px_rgba(37,99,235,0.12)]' 
                    : 'bg-navy-dark/60 border-white/[0.08] hover:border-white/20 hover:bg-navy-dark/75'
                }`}
              >
                <button
                  className="w-full px-4 sm:px-5 py-3.5 text-left flex justify-between items-start focus:outline-none gap-3"
                  onClick={() => toggleIndex(index)}
                >
                  <span className={`font-semibold text-xs sm:text-sm transition-colors pt-0.5 leading-snug ${isOpen ? 'text-primary-light' : 'text-slate-200'}`}>
                    {faq.question}
                  </span>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isOpen 
                      ? 'bg-primary text-white shadow-sm rotate-180' 
                      : 'bg-white/10 text-slate-400'
                  }`}>
                    {isOpen ? <Minus size={12} /> : <Plus size={12} />}
                  </div>
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-4 sm:px-5 pb-4 text-slate-400 text-xs leading-relaxed border-t border-white/5 pt-2.5">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQAccordion;
