import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SiteInfoContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const SiteInfoProvider = ({ children }) => {
  const [siteInfo, setSiteInfo] = useState({
    platform_name: 'HR Pilot Pro',
    powered_by: 'Kiaan Technology',
    support_email: '',
    company_name: 'HR Pilot Pro',
    company_logo: '/logo.png',
    company_address: '',
    contact_number: '',
    about_us: '',
    social_linkedin: '',
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    social_youtube: '',
    privacy_policy: '',
    terms_conditions: '',
    copyright_text: '',
    whatsapp_number: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchSiteInfo = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public/site-info`);
      if (res.data && Object.keys(res.data).length > 0) {
        setSiteInfo(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Failed to fetch site info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteInfo();
  }, []);

  return (
    <SiteInfoContext.Provider value={{ siteInfo, loading, refreshSiteInfo: fetchSiteInfo }}>
      {children}
    </SiteInfoContext.Provider>
  );
};

export const useSiteInfo = () => {
  const context = useContext(SiteInfoContext);
  if (!context) {
    // Return defaults if used outside provider (e.g., tests)
    return { siteInfo: { platform_name: 'HRM Software' }, loading: false, refreshSiteInfo: () => {} };
  }
  return context;
};
