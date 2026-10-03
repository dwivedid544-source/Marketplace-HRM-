/**
 * Centralized Country, Currency & Language Configuration for Frontend
 * Supporting India, USA, UK, UAE, Germany, Spain
 */

export const SUPPORTED_COUNTRIES = [
  {
    name: 'India',
    code: 'IN',
    flag: '🇮🇳',
    currency: 'INR',
    currencyName: 'Indian Rupee',
    currencySymbol: '₹',
    languages: [
      { code: 'hi', name: 'Hindi' },
      { code: 'en', name: 'English' }
    ],
    defaultLanguage: 'English',
    defaultTimezone: 'Asia/Kolkata',
    timezones: ['Asia/Kolkata']
  },
  {
    name: 'USA',
    code: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    currencyName: 'US Dollar',
    currencySymbol: '$',
    languages: [
      { code: 'en', name: 'English' }
    ],
    defaultLanguage: 'English',
    defaultTimezone: 'America/New_York',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
  },
  {
    name: 'UK',
    code: 'GB',
    flag: '🇬🇧',
    currency: 'GBP',
    currencyName: 'Pound Sterling',
    currencySymbol: '£',
    languages: [
      { code: 'en', name: 'English' }
    ],
    defaultLanguage: 'English',
    defaultTimezone: 'Europe/London',
    timezones: ['Europe/London']
  },
  {
    name: 'UAE',
    code: 'AE',
    flag: '🇦🇪',
    currency: 'AED',
    currencyName: 'UAE Dirham',
    currencySymbol: 'د.إ',
    languages: [
      { code: 'ar', name: 'Arabic' },
      { code: 'en', name: 'English' }
    ],
    defaultLanguage: 'English',
    defaultTimezone: 'Asia/Dubai',
    timezones: ['Asia/Dubai']
  },
  {
    name: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    currency: 'EUR',
    currencyName: 'Euro',
    currencySymbol: '€',
    languages: [
      { code: 'de', name: 'German' }
    ],
    defaultLanguage: 'German',
    defaultTimezone: 'Europe/Berlin',
    timezones: ['Europe/Berlin']
  },
  {
    name: 'Spain',
    code: 'ES',
    flag: '🇪🇸',
    currency: 'EUR',
    currencyName: 'Euro',
    currencySymbol: '€',
    languages: [
      { code: 'es', name: 'Spanish (Español)' }
    ],
    defaultLanguage: 'Spanish (Español)',
    defaultTimezone: 'Europe/Madrid',
    timezones: ['Europe/Madrid']
  }
];

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'INR (₹) - Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'USD ($) - US Dollar', locale: 'en-US' },
  { code: 'GBP', symbol: '£', name: 'GBP (£) - Pound Sterling', locale: 'en-GB' },
  { code: 'AED', symbol: 'د.إ', name: 'AED (د.إ) - UAE Dirham', locale: 'ar-AE' },
  { code: 'EUR', symbol: '€', name: 'EUR (€) - Euro (Germany & Spain)', locale: 'es-ES' },
  // Backward compatibility fallbacks
  { code: 'ZAR', symbol: 'R', name: 'ZAR (R) - South African Rand', locale: 'en-ZA' },
  { code: 'SGD', symbol: 'S$', name: 'SGD (S$) - Singapore Dollar', locale: 'en-SG' }
];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'de', name: 'German' },
  { code: 'ar', name: 'Arabic' }
];

export const CURRENCY_SYMBOLS = {
  'INR': '₹',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'AED': 'د.إ',
  'ZAR': 'R',
  'SGD': 'S$'
};

export const getCountryByCode = (code) => {
  if (!code) return null;
  return SUPPORTED_COUNTRIES.find(
    c => c.code.toLowerCase() === code.toLowerCase() || c.name.toLowerCase() === code.toLowerCase()
  );
};

export const getCurrencyByCountry = (countryIdentifier) => {
  const country = getCountryByCode(countryIdentifier);
  return country ? country.currency : 'INR';
};
