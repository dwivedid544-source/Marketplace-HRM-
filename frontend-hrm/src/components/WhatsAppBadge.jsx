import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteInfo } from '../context/SiteInfoContext';

// Only show on the Landing Page ('/')
const LANDING_PATH = '/';

const WhatsAppBadge = () => {
  const { siteInfo } = useSiteInfo();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isPulsing, setIsPulsing] = useState(true);

  // Only render on landing page ('/')
  if (location.pathname !== LANDING_PATH) return null;

  // Don't render if no WhatsApp number is configured
  if (!siteInfo?.whatsapp_number) return null;

  // Clean the number — remove spaces, dashes, and ensure it starts with country code
  const cleanNumber = siteInfo.whatsapp_number.replace(/[\s\-()]/g, '');
  const whatsappUrl = `https://wa.me/${cleanNumber.replace('+', '')}`;

  const companyName = siteInfo.company_name || siteInfo.platform_name || 'us';

  return (
    <>
      <style>{`
        @keyframes wa-pulse {
          0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
          70% { box-shadow: 0 0 0 15px rgba(37, 211, 102, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
        }
        @keyframes wa-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .wa-badge {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 0;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .wa-badge:hover {
          transform: scale(1.05);
        }
        .wa-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
          position: relative;
        }
        .wa-btn.pulsing {
          animation: wa-pulse 2s infinite;
        }
        .wa-btn:hover {
          box-shadow: 0 6px 28px rgba(37, 211, 102, 0.55), 0 4px 12px rgba(0,0,0,0.15);
          background: linear-gradient(135deg, #2be871 0%, #1aad8a 100%);
        }
        .wa-btn svg {
          transition: transform 0.3s ease;
        }
        .wa-btn:hover svg {
          animation: wa-bounce 0.6s ease;
        }
        .wa-tooltip {
          position: absolute;
          right: 70px;
          bottom: 10px;
          background: white;
          color: #1e293b;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
          opacity: 0;
          transform: translateX(10px) scale(0.95);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
          border: 1px solid #f1f5f9;
        }
        .wa-tooltip.visible {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
        .wa-tooltip::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%) rotate(45deg);
          width: 12px;
          height: 12px;
          background: white;
          border-right: 1px solid #f1f5f9;
          border-bottom: 1px solid #f1f5f9;
        }
        .wa-tooltip .wa-label {
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 2px;
        }
        .wa-tooltip .wa-text {
          color: #25D366;
          font-weight: 800;
        }
        @media (max-width: 640px) {
          .wa-badge {
            bottom: 20px;
            right: 20px;
          }
          .wa-btn {
            width: 52px;
            height: 52px;
          }
          .wa-tooltip {
            display: none;
          }
        }
      `}</style>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-badge"
        onMouseEnter={() => { setIsHovered(true); setIsPulsing(false); }}
        onMouseLeave={() => { setIsHovered(false); }}
        title={`Chat with ${companyName} on WhatsApp`}
      >
        <div className={`wa-tooltip ${isHovered ? 'visible' : ''}`}>
          <div className="wa-label">Chat with us</div>
          <div className="wa-text">on WhatsApp</div>
        </div>
        <div className={`wa-btn ${isPulsing ? 'pulsing' : ''}`} style={{ background: 'none', boxShadow: '0 4px 20px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.1)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="60" height="60">
            <circle cx="256" cy="256" r="256" fill="#25D366"/>
            <path fill="white" d="M362.4 149.2C339.2 125.9 308.4 113 275.8 113c-67.1 0-121.7 54.6-121.7 121.7 0 21.4 5.6 42.4 16.2 60.8l-17.2 62.9 64.4-16.9c17.8 9.7 37.8 14.8 58.2 14.8h.1c67.1 0 121.7-54.6 121.8-121.7.1-32.5-12.6-63.1-35.2-86.4zM275.9 335.1c-18.2 0-36-4.9-51.5-14.1l-3.7-2.2-38.3 10 10.2-37.4-2.4-3.8c-10.1-16.1-15.5-34.7-15.5-53.8.1-55.8 45.5-101.2 101.3-101.2 27 0 52.4 10.6 71.5 29.7 19.1 19.2 29.6 44.6 29.6 71.7-.1 55.9-45.5 101.1-101.2 101.1zm55.5-75.8c-3-1.5-18-8.9-20.8-9.9-2.8-1-4.8-1.5-6.8 1.5s-7.8 9.9-9.6 11.9-3.5 2.2-6.5.8c-3-1.5-12.7-4.7-24.2-14.9-8.9-8-15-17.8-16.7-20.8-1.8-3-.2-4.6 1.3-6.1 1.4-1.4 3-3.5 4.5-5.3 1.5-1.8 2-3 3-5 1-2 .5-3.8-.3-5.3-.8-1.5-6.8-16.4-9.3-22.5-2.5-5.9-5-5.1-6.8-5.2-1.8-.1-3.8-.1-5.8-.1-2 0-5.3.8-8 3.8-2.8 3-10.5 10.3-10.5 25.1s10.8 29.1 12.3 31.1c1.5 2 21.2 32.4 51.4 45.4 7.2 3.1 12.8 5 17.2 6.4 7.2 2.3 13.8 2 19 1.2 5.8-.9 18-7.3 20.5-14.4 2.5-7.1 2.5-13.1 1.8-14.4-.8-1.2-2.8-2-5.8-3.5z"/>
          </svg>
        </div>
      </a>
    </>
  );
};

export default WhatsAppBadge;
