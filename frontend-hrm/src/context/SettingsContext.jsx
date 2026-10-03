import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/axios';
import { 
  SUPPORTED_COUNTRIES, 
  SUPPORTED_CURRENCIES, 
  SUPPORTED_LANGUAGES, 
  CURRENCY_SYMBOLS, 
  getCountryByCode, 
  getCurrencyByCountry 
} from '../config/countryConfig';
import { translate, TRANSLATIONS } from '../config/translations';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Initialize with fallback defaults
  const [localization, setLocalization] = useState({
    country: 'India',
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    language: 'English',
  });

  const refreshSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get('/settings');
      if (res.data) {
        const countryObj = getCountryByCode(res.data.country || 'India') || SUPPORTED_COUNTRIES[0];
        setLocalization({
          country: res.data.country || countryObj.name,
          countryCode: countryObj.code,
          timezone: res.data.timezone || countryObj.defaultTimezone || 'Asia/Kolkata',
          currency: res.data.currency || countryObj.currency || 'INR',
          dateFormat: res.data.date_format || 'DD/MM/YYYY',
          language: res.data.language || countryObj.defaultLanguage || 'English',
        });
      }
    } catch (err) {
      // Fallback silently if /settings fails or unavailable
    }
  }, [user]);

  // Whenever the user logs in or updates profile, sync their settings
  useEffect(() => {
    if (user && user.localization) {
      const countryObj = getCountryByCode(user.localization.country || 'India') || SUPPORTED_COUNTRIES[0];
      setLocalization({
        country: user.localization.country || countryObj.name,
        countryCode: countryObj.code,
        timezone: user.localization.timezone || countryObj.defaultTimezone || 'Asia/Kolkata',
        currency: user.localization.currency || countryObj.currency || 'INR',
        dateFormat: user.localization.date_format || 'DD/MM/YYYY',
        language: user.localization.language || countryObj.defaultLanguage || 'English',
      });
    }
    refreshSettings();
  }, [user, refreshSettings]);

  // Live Exchange Rates State (USD Base from open.er-api.com)
  const FALLBACK_RATES = {
    USD: 1,
    INR: 96.06,
    AED: 3.67,
    EUR: 0.88,
    GBP: 0.76,
    CAD: 1.41,
    SGD: 1.28,
    AUD: 1.43,
    SAR: 3.75,
    QAR: 3.64,
    ZAR: 16.41
  };

  const [exchangeRates, setExchangeRates] = useState(() => {
    try {
      const cached = localStorage.getItem('hrm_live_rates');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.rates) return { ...FALLBACK_RATES, ...parsed.rates };
      }
    } catch (e) {}
    return FALLBACK_RATES;
  });
  const [ratesLoading, setRatesLoading] = useState(false);

  // Fetch Live Exchange Rates from open.er-api.com
  const fetchLiveRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          setExchangeRates(prev => ({ ...prev, ...data.rates }));
          localStorage.setItem('hrm_live_rates', JSON.stringify({
            rates: data.rates,
            timestamp: Date.now()
          }));
        }
      }
    } catch (err) {
      console.warn('Could not fetch live exchange rates, using cached/fallback:', err);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveRates();
  }, [fetchLiveRates]);

  // Translation helper function
  const t = useCallback((key, fallback) => {
    return translate(key, localization.language, fallback);
  }, [localization.language]);

  // Currency Converter: converts from base/source currency to target currency using USD-based rates
  const convertAmount = useCallback((amount, fromCurrency = 'INR', toCurrency = localization.currency) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return 0;
    
    const from = String(fromCurrency || 'INR').toUpperCase();
    const to = String(toCurrency || localization.currency || 'INR').toUpperCase();
    
    if (from === to) return num;

    const rFrom = exchangeRates[from] || (from === 'USD' ? 1 : (from === 'INR' ? 96.06 : 1));
    const rTo = exchangeRates[to] || (to === 'USD' ? 1 : (to === 'INR' ? 96.06 : 1));

    // Convert: (amount / rate_from_USD) * rate_to_USD
    const inUSD = num / rFrom;
    return inUSD * rTo;
  }, [exchangeRates, localization.currency]);

  // Currency Formatter Helper with auto-conversion option
  const formatCurrency = (amount, options = {}) => {
    const num = parseFloat(amount || 0);
    let fromCurrency = 'INR';
    let shouldConvert = true;
    let explicitDecimals = null;

    if (typeof options === 'string') {
      fromCurrency = options;
    } else if (typeof options === 'boolean') {
      shouldConvert = options;
    } else if (typeof options === 'object' && options !== null) {
      if (options.fromCurrency !== undefined) fromCurrency = options.fromCurrency;
      if (options.convert !== undefined) shouldConvert = options.convert;
      if (options.decimals !== undefined) explicitDecimals = options.decimals;
    }

    const targetCurrency = localization.currency || 'INR';
    const finalAmount = shouldConvert ? convertAmount(num, fromCurrency, targetCurrency) : num;

    const langLower = (localization.language || '').toLowerCase();
    const isSpanish = langLower.includes('span') || langLower.includes('español') || langLower === 'es';
    const isArabic = langLower.includes('arab') || langLower === 'ar';

    const currencyMap = {
      'INR': { locale: 'en-IN', currency: 'INR' },
      'USD': { locale: 'en-US', currency: 'USD' },
      'AED': { locale: isArabic ? 'ar-AE' : 'en-AE', currency: 'AED' },
      'EUR': { locale: isSpanish ? 'es-ES' : 'de-DE', currency: 'EUR' },
      'GBP': { locale: 'en-GB', currency: 'GBP' },
      'ZAR': { locale: 'en-ZA', currency: 'ZAR' },
      'SGD': { locale: 'en-SG', currency: 'SGD' }
    };
    
    const config = currencyMap[targetCurrency] || { locale: 'en-US', currency: targetCurrency };
    const decimals = explicitDecimals !== null 
      ? explicitDecimals 
      : (targetCurrency === 'INR' ? (finalAmount % 1 === 0 ? 0 : 2) : 2);

    try {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(finalAmount);
    } catch (e) {
      const sym = CURRENCY_SYMBOLS[targetCurrency] || '₹';
      return `${sym}${finalAmount.toFixed(decimals)}`;
    }
  };

  const currencySymbol = CURRENCY_SYMBOLS[localization.currency] || '₹';

  // Date Formatter Helper
  const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d)) return 'Invalid Date';

    // Set Timezone and Format
    const options = {
      timeZone: localization.timezone || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-GB', options); // 'en-GB' maps closely to DD/MM/YYYY
      const parts = formatter.formatToParts(d);
      
      // Custom mapping for format
      const day = parts.find(p => p.type === 'day')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const year = parts.find(p => p.type === 'year')?.value;

      let formattedDate = `${day}/${month}/${year}`;
      if (localization.dateFormat === 'MM/DD/YYYY') formattedDate = `${month}/${day}/${year}`;
      if (localization.dateFormat === 'YYYY-MM-DD') formattedDate = `${year}-${month}-${day}`;

      if (includeTime) {
        const hour = parts.find(p => p.type === 'hour')?.value;
        const minute = parts.find(p => p.type === 'minute')?.value;
        formattedDate += ` ${hour}:${minute}`;
      }

      return formattedDate;
    } catch (e) {
      return d.toLocaleDateString();
    }
  };

  return (
    <SettingsContext.Provider value={{ 
      localization, 
      setLocalization, 
      formatCurrency, 
      convertAmount,
      exchangeRates,
      ratesLoading,
      fetchLiveRates,
      formatDate, 
      currencySymbol, 
      refreshSettings,
      t,
      supportedCountries: SUPPORTED_COUNTRIES,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      supportedLanguages: SUPPORTED_LANGUAGES,
      getCountryByCode,
      getCurrencyByCountry
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
