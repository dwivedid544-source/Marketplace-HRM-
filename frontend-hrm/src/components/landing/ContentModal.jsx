import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, ShieldCheck, FileText, PhoneCall, Sparkles } from 'lucide-react';
import { useSiteInfo } from '../../context/SiteInfoContext';

const ContentModal = ({ isOpen, onClose, title, content }) => {
  const { siteInfo } = useSiteInfo();
  const displayName = siteInfo.company_name || siteInfo.platform_name || 'HRM Software';

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine icon based on title
  const getIcon = () => {
    const t = (title || '').toLowerCase();
    if (t.includes('privacy')) return <ShieldCheck size={24} className="text-primary-light" />;
    if (t.includes('terms')) return <FileText size={24} className="text-secondary" />;
    if (t.includes('contact')) return <PhoneCall size={24} className="text-green-400" />;
    return <Info size={24} className="text-primary" />;
  };

  const modalNode = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-6">
        {/* Animated backdrop with deep blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
          onClick={onClose}
        ></motion.div>

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-[95%] md:w-[60%] max-w-2xl relative z-10 flex flex-col max-h-[85vh] rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(37,99,235,0.4)] border border-white/10 bg-[#0f172a] backdrop-blur-2xl mx-auto"
        >
          {/* Decorative glowing orbs in the background of the modal */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-[80px]"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/20 rounded-full blur-[80px]"></div>
          </div>

          {/* Top Gradient Highlight Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent z-20"></div>

          {/* Header */}
          <div className="px-6 py-5 md:px-8 md:py-6 border-b border-white/10 flex justify-between items-center relative z-20 bg-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                {getIcon()}
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 font-heading tracking-tight">
                  {title}
                </h2>
                <p className="text-slate-400 text-xs md:text-sm font-medium flex items-center gap-1.5 mt-0.5">
                  <Sparkles size={12} className="text-secondary" /> {displayName} Platform Information
                </p>
              </div>
            </div>
            
            {/* Premium Close Button */}
            <button
              onClick={onClose}
              className="group relative p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-rose-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
              <X size={20} className="text-slate-400 group-hover:text-white relative z-10 transition-colors group-hover:rotate-90 duration-300" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 md:p-8 overflow-y-auto relative z-20 custom-scrollbar scroll-smooth">
            {content ? (
              <div 
                className="prose prose-invert prose-lg max-w-none text-slate-300 whitespace-pre-wrap font-sans leading-relaxed
                           prose-headings:text-white prose-headings:font-bold prose-headings:font-heading
                           prose-a:text-primary-light prose-a:no-underline hover:prose-a:text-primary transition-colors
                           prose-strong:text-white prose-strong:font-bold
                           prose-ul:list-disc prose-ul:ml-4 prose-ol:list-decimal prose-ol:ml-4"
                dangerouslySetInnerHTML={{ __html: content }} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <FileText size={32} className="text-slate-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-heading">No Information Available</h3>
                <p className="text-slate-400 text-center max-w-sm">This section hasn't been updated yet. Please check back later or contact support.</p>
              </div>
            )}
          </div>
          
          {/* Bottom Fade/Gradient for better scroll aesthetics */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0f172a] to-transparent pointer-events-none z-30"></div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalNode, document.body);
};

export default ContentModal;
