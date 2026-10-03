import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteInfo } from '../../context/SiteInfoContext';
import ContentModal from './ContentModal';

const Navbar = () => {
  const { siteInfo } = useSiteInfo();
  const productTitle = siteInfo.platform_name || 'HRM Software Pro';
  const poweredBy = siteInfo.powered_by || siteInfo.company_name || 'Kiaan Technology';
  const logoLetter = productTitle.charAt(0).toUpperCase();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: '' });

  const openModal = (e, title, content) => {
    e.preventDefault();
    setModalConfig({ isOpen: true, title, content });
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: '/#features' },
    { name: 'Pricing', href: '/#pricing' },
    { name: 'Testimonials', href: '/#testimonials' },
    { name: 'FAQ', href: '/#faq' },
  ];

  const handleScrollToSection = (e, href) => {
    if (href === '/' || href === '') {
      e.preventDefault();
      if (window.location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/';
      }
      setIsMobileMenuOpen(false);
      return;
    }

    if (href.startsWith('/#')) {
      e.preventDefault();
      if (window.location.pathname !== '/') {
        window.location.href = href;
        return;
      }
      const targetId = href.replace('/#', '');
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-500 ${
        isScrolled
          ? 'bg-slate-900/95 backdrop-blur-xl shadow-glass'
          : 'bg-transparent'
      }`}
    >
    <div className="w-full bg-primary/10 border-b border-primary/20 py-1.5 overflow-hidden flex items-center">
      <motion.div 
        animate={{ x: ["-100vw", "0vw"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex whitespace-nowrap min-w-[200vw]"
      >
        <p className="text-[11px] font-semibold text-primary-light uppercase tracking-widest w-full flex justify-around">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <a key={i} href="#" className="hover:text-white transition-colors inline-flex items-center gap-3 px-8">
              <Sparkles size={12} className="text-secondary" />
              Powered by {poweredBy}
              <Sparkles size={12} className="text-secondary" />
            </a>
          ))}
        </p>
      </motion.div>
    </div>
    <nav
      className={`w-full transition-all duration-500 ${
        isScrolled ? 'py-2.5 sm:py-3 border-b border-white/10' : 'py-3 sm:py-4 md:py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" onClick={(e) => handleScrollToSection(e, '/')} className="flex items-center gap-3 group">
              {siteInfo.company_logo ? (
                <div className="h-11 w-11 sm:h-12 sm:w-12 bg-white rounded-2xl p-1 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-white/40 group-hover:scale-105 group-hover:shadow-cyan-400/40 transition-all duration-300 shrink-0">
                  <img src={siteInfo.company_logo} alt={productTitle} className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/50 blur-md rounded-xl group-hover:bg-primary/80 transition-all duration-300"></div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-heading font-bold text-xl relative z-10 border border-white/20 group-hover:scale-105 transition-transform duration-300">
                    {logoLetter}
                  </div>
                </div>
              )}
              {(() => {
                const parts = productTitle.trim().split(' ');
                if (parts.length > 1) {
                  const mainPart = parts.slice(0, -1).join(' ');
                  const lastWord = parts[parts.length - 1];
                  return (
                    <span className="font-heading font-extrabold text-2xl sm:text-[1.65rem] tracking-tight flex items-center gap-2 select-none">
                      <span className="text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)] group-hover:text-slate-100 transition-colors">
                        {mainPart}
                      </span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-teal-300 to-cyan-400 drop-shadow-[0_2px_15px_rgba(56,189,248,0.45)] group-hover:from-cyan-300 group-hover:to-teal-200 transition-all">
                        {lastWord}
                      </span>
                    </span>
                  );
                }
                return (
                  <span className="font-heading font-extrabold text-2xl sm:text-[1.65rem] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-primary-light drop-shadow-[0_2px_15px_rgba(56,189,248,0.35)] select-none">
                    {productTitle}
                  </span>
                );
              })()}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 bg-white/5 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md">
            {navLinks.map((link) => (
              link.name === 'Privacy Policy' ? (
                <button
                  key={link.name}
                  onClick={(e) => openModal(e, 'Privacy Policy', siteInfo.privacy_policy)}
                  className="font-sans font-medium text-sm text-slate-300 hover:text-white transition-colors relative group bg-transparent border-none cursor-pointer"
                >
                  {link.name}
                  <span className="absolute -bottom-2 left-1/2 w-0 h-1 bg-primary rounded-t-full transition-all duration-300 group-hover:w-full group-hover:left-0 shadow-[0_0_10px_rgba(37,99,235,0.8)]"></span>
                </button>
              ) : (
                <a
                  key={link.name}
                  href={link.href.startsWith('/#') ? link.href.replace('/', '') : link.href}
                  onClick={(e) => handleScrollToSection(e, link.href)}
                  className="font-sans font-medium text-sm text-slate-300 hover:text-white transition-colors relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-2 left-1/2 w-0 h-1 bg-primary rounded-t-full transition-all duration-300 group-hover:w-full group-hover:left-0 shadow-[0_0_10px_rgba(37,99,235,0.8)]"></span>
                </a>
              )
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <Link 
              to="/login" 
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all shadow-glass"
            >
              Login
            </Link>
            <a 
              href="#pricing" 
              onClick={(e) => handleScrollToSection(e, '/#pricing')}
              className="btn-premium py-2.5 px-6 text-sm flex items-center gap-1.5 group cursor-pointer"
            >
              <span>Get Started</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-300 hover:text-white bg-white/5 p-2 rounded-lg border border-white/10 transition-colors focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-full left-0 right-0 bg-navy-dark/95 backdrop-blur-xl border-b border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-6 space-y-2">
              {navLinks.map((link) => (
                link.name === 'Privacy Policy' ? (
                  <button
                    key={link.name}
                    onClick={(e) => openModal(e, 'Privacy Policy', siteInfo.privacy_policy)}
                    className="block w-full text-left px-4 py-3 rounded-xl text-base font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    {link.name}
                  </button>
                ) : (
                  <a
                    key={link.name}
                    href={link.href.startsWith('/#') ? link.href.replace('/', '') : link.href}
                    className="block px-4 py-3 rounded-xl text-base font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    onClick={(e) => handleScrollToSection(e, link.href)}
                  >
                    {link.name}
                  </a>
                )
              ))}
              <div className="pt-6 mt-4 border-t border-white/10 flex flex-col gap-3 px-2">
                <Link
                  to="/login"
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/15 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </Link>
                <a
                  href="#pricing"
                  className="w-full btn-premium py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  onClick={(e) => handleScrollToSection(e, '/#pricing')}
                >
                  <Sparkles size={16} />
                  Get Started (View Plans)
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ContentModal 
        isOpen={modalConfig.isOpen} 
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} 
        title={modalConfig.title} 
        content={modalConfig.content} 
      />
    </nav>
    </header>
  );
};

export default Navbar;
