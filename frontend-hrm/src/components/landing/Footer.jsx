import React, { useState } from 'react';
import { Mail, Phone, MapPin, Globe, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteInfo } from '../../context/SiteInfoContext';
import ContentModal from './ContentModal';

const LinkedinIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>;
const FacebookIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>;
const InstagramIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>;
const TwitterIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>;
const YoutubeIcon = ({size=18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.501 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;

const Footer = () => {
  const { siteInfo } = useSiteInfo();
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', content: '' });

  const openModal = (title, content) => {
    setModalConfig({ isOpen: true, title, content });
  };

  const defaultAbout = "Kiaan Technology is a modern software development company delivering innovative, secure, and scalable digital solutions. We specialize in Web Development, Mobile Apps, Custom Software, CRM/ERP Systems, AI Automation, and Cloud Solutions. Our goal is simple — to help businesses grow faster with smart technology, powerful automation, and reliable digital products.";

  const displayName = siteInfo.company_name || siteInfo.platform_name || 'Kiaan Technology';
  const aboutText = siteInfo.about_us || defaultAbout;
  const address = siteInfo.company_address || 'Indore, India';
  const phone = siteInfo.contact_number || '+91 97521 00980';
  const email = siteInfo.support_email || 'support@kiaantechnology.com';
  const copyrightText = siteInfo.copyright_text || `© ${new Date().getFullYear()} ${displayName}. All rights reserved.`;
  const companyWebsite = siteInfo.company_website || 'https://kiaantechnology.com/';
  const whatsappUrl = siteInfo.whatsapp_number 
    ? `https://wa.me/${siteInfo.whatsapp_number.replace(/[^0-9]/g, '')}` 
    : 'https://wa.me/919752100980';

  // Build social links array dynamically with Company Website & WhatsApp
  const socialLinks = [
    { url: companyWebsite, icon: <Globe size={18} />, hoverColor: 'hover:bg-primary hover:border-primary', label: 'Official Website' },
    { url: siteInfo.social_instagram, icon: <InstagramIcon size={18} />, hoverColor: 'hover:bg-[#E4405F] hover:border-[#E4405F]', label: 'Instagram' },
    { url: whatsappUrl, icon: <MessageCircle size={18} />, hoverColor: 'hover:bg-[#25D366] hover:border-[#25D366]', label: 'WhatsApp' },
    { url: siteInfo.social_linkedin, icon: <LinkedinIcon size={18} />, hoverColor: 'hover:bg-[#0A66C2] hover:border-[#0A66C2]', label: 'LinkedIn' },
    { url: siteInfo.social_facebook, icon: <FacebookIcon size={18} />, hoverColor: 'hover:bg-[#1877F2] hover:border-[#1877F2]', label: 'Facebook' },
    { url: siteInfo.social_twitter, icon: <TwitterIcon size={18} />, hoverColor: 'hover:bg-[#1DA1F2] hover:border-[#1DA1F2]', label: 'X (Twitter)' },
    { url: siteInfo.social_youtube, icon: <YoutubeIcon size={18} />, hoverColor: 'hover:bg-[#FF0000] hover:border-[#FF0000]', label: 'YouTube' },
  ].filter(s => s.url);

  // Get first letter for logo fallback
  const logoLetter = displayName.charAt(0).toUpperCase();

  return (
    <footer className="bg-navy-dark pt-14 pb-6 border-t border-white/5 relative overflow-hidden z-20">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-32 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-10 mb-10">
          
          {/* Left Brand Column */}
          <div className="col-span-2 md:col-span-12 lg:col-span-5 pr-0 lg:pr-6">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              {siteInfo.company_logo ? (
                <>
                  <div className="h-11 w-11 bg-white rounded-xl p-1 flex items-center justify-center shadow-md border border-white/30 group-hover:scale-105 transition-transform shrink-0">
                    <img src={siteInfo.company_logo} alt={displayName} className="h-full w-full object-contain" />
                  </div>
                  <span className="font-heading font-extrabold text-2xl text-white group-hover:text-primary-light transition-colors">
                    {displayName}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-heading font-bold text-lg shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                    {logoLetter}
                  </div>
                  <span className="font-heading font-extrabold text-2xl text-white group-hover:text-primary-light transition-colors">
                    {displayName}
                  </span>
                </>
              )}
            </Link>
            
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-5 font-normal max-w-full">
              {aboutText}
            </p>

            {socialLinks.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {socialLinks.map((s, i) => (
                  <a 
                    key={i} 
                    href={s.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/5 hover:scale-105 ${s.hoverColor}`} 
                    title={s.label}
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Product Links */}
          <div className="col-span-1 md:col-span-4 lg:col-span-2 lg:pl-4">
            <h4 className="text-white font-bold mb-4 uppercase text-xs tracking-wider text-slate-200">Product</h4>
            <ul className="space-y-2.5">
              <li><a href="/#features" className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300">Features</a></li>
              <li><a href="/#pricing" className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300">Pricing</a></li>
              <li><a href="/#pricing" className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300">Custom Plan</a></li>
              <li><a href="/#testimonials" className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300">Testimonials</a></li>
              <li><a href="/#faq" className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300">FAQ</a></li>
            </ul>
          </div>

          {/* Company Links */}
          <div className="col-span-1 md:col-span-4 lg:col-span-2">
            <h4 className="text-white font-bold mb-4 uppercase text-xs tracking-wider text-slate-200">Company</h4>
            <ul className="space-y-2.5">
              <li><button onClick={() => openModal('About Us', aboutText)} className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300 bg-transparent border-none cursor-pointer p-0 text-left">About Us</button></li>
              <li><button onClick={() => openModal('Contact Support', `Support Email: ${email}\nContact Number: ${phone}\nAddress: ${address}`)} className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300 bg-transparent border-none cursor-pointer p-0 text-left">Contact Support</button></li>
              <li><button onClick={() => openModal('Privacy Policy', siteInfo.privacy_policy)} className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300 bg-transparent border-none cursor-pointer p-0 text-left">Privacy Policy</button></li>
              <li><button onClick={() => openModal('Terms & Conditions', siteInfo.terms_conditions)} className="text-slate-400 hover:text-primary-light transition-colors text-xs sm:text-sm flex items-center gap-2 hover:translate-x-1 duration-300 bg-transparent border-none cursor-pointer p-0 text-left">Terms & Conditions</button></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="col-span-2 md:col-span-4 lg:col-span-3">
            <h4 className="text-white font-bold mb-4 uppercase text-xs tracking-wider text-slate-200">Contact Info</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 group">
                <MapPin size={16} className="text-primary-light shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                <span className="text-slate-400 text-xs sm:text-sm">{address}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <Phone size={16} className="text-primary-light shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-slate-400 text-xs sm:text-sm">{phone}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <Mail size={16} className="text-primary-light shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-slate-400 text-xs sm:text-sm">{email}</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-6 border-t border-white/5 text-center flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-xs sm:text-sm">
            {copyrightText}
          </p>
          <p className="text-slate-500 text-xs sm:text-sm flex items-center gap-1.5">
            <span>Powered by</span>
            <a 
              href={companyWebsite} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary-light hover:text-white font-extrabold transition-colors underline decoration-primary/40 underline-offset-4 flex items-center gap-1"
            >
              <Globe size={13} />
              <span>{siteInfo.powered_by || 'Kiaan Technology'}</span>
            </a>
          </p>
        </div>
      </div>
      
      <ContentModal 
        isOpen={modalConfig.isOpen} 
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} 
        title={modalConfig.title} 
        content={modalConfig.content} 
      />
    </footer>
  );
};

export default Footer;
