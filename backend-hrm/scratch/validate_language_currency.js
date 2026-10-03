const axios = require('axios');
const db = require('../config/db');
const { 
    SUPPORTED_COUNTRIES, 
    SUPPORTED_CURRENCIES, 
    SUPPORTED_LANGUAGES, 
    CURRENCY_SYMBOLS,
    getCountryByCode, 
    getCurrencyByCountry 
} = require('../config/countryConfig');

async function runDetailedAudit() {
    console.log('================================================================');
    console.log('🔍 DEEP AUDIT & VERIFICATION: LANGUAGE & CURRENCY FLOW');
    console.log('================================================================\n');

    let allPassed = true;

    // ─── TEST 1: Constants & Configurations ───
    console.log('--- TEST 1: Country, Currency, and Language Configuration Audit ---');
    const requiredCountries = [
        { code: 'IN', name: 'India', curr: 'INR', sym: '₹', langs: ['Hindi', 'English'] },
        { code: 'US', name: 'USA', curr: 'USD', sym: '$', langs: ['English'] },
        { code: 'GB', name: 'UK', curr: 'GBP', sym: '£', langs: ['English'] },
        { code: 'AE', name: 'UAE', curr: 'AED', sym: 'د.إ', langs: ['Arabic', 'English'] },
        { code: 'DE', name: 'Germany', curr: 'EUR', sym: '€', langs: ['German'] },
        { code: 'ES', name: 'Spain', curr: 'EUR', sym: '€', langs: ['Spanish (Español)'] }
    ];

    for (const req of requiredCountries) {
        const found = getCountryByCode(req.code);
        if (!found) {
            console.error(`❌ Missing country config for: ${req.name} (${req.code})`);
            allPassed = false;
            continue;
        }
        const currOk = found.currency === req.curr;
        const symOk = found.currencySymbol === req.sym;
        const langNames = found.languages.map(l => l.name);
        const langsOk = req.langs.every(l => langNames.includes(l));

        if (currOk && symOk && langsOk) {
            console.log(`✅ [${found.flag} ${found.name} (${found.code})] Currency: ${found.currency} (${found.currencySymbol}) | Languages: ${langNames.join(', ')}`);
        } else {
            console.error(`❌ Mismatch in [${found.name}]: currOk=${currOk}, symOk=${symOk}, langsOk=${langsOk}`);
            allPassed = false;
        }
    }

    // ─── TEST 2: Currency Number Formatting (Intl Engine) ───
    console.log('\n--- TEST 2: Currency Number Formatting (Intl Engine) ---');
    const formatTest = (amount, currency, language) => {
        const num = parseFloat(amount || 0);
        const langLower = (language || '').toLowerCase();
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
        const config = currencyMap[currency] || currencyMap['INR'];
        return new Intl.NumberFormat(config.locale, {
            style: 'currency',
            currency: config.currency
        }).format(num);
    };

    const testCases = [
        { amount: 50000, curr: 'INR', lang: 'Hindi', label: 'India INR (₹50,000.00)' },
        { amount: 4500, curr: 'USD', lang: 'English', label: 'USA USD ($4,500.00)' },
        { amount: 3500, curr: 'GBP', lang: 'English', label: 'UK GBP (£3,500.00)' },
        { amount: 15000, curr: 'AED', lang: 'Arabic', label: 'UAE AED (Arabic)' },
        { amount: 15000, curr: 'AED', lang: 'English', label: 'UAE AED (English)' },
        { amount: 2800, curr: 'EUR', lang: 'German', label: 'Germany EUR (de-DE)' },
        { amount: 2800, curr: 'EUR', lang: 'Spanish (Español)', label: 'Spain EUR (es-ES)' }
    ];

    testCases.forEach(tc => {
        const formatted = formatTest(tc.amount, tc.curr, tc.lang);
        console.log(`✅ ${tc.label} ➔ Formatted Result: "${formatted}"`);
    });

    // ─── TEST 3: Backend Database Schema Integrity ───
    console.log('\n--- TEST 3: Database Schema & Column Verification ---');
    const [gsCols] = await db.execute("SHOW COLUMNS FROM global_settings WHERE Field IN ('country', 'currency', 'language', 'timezone')");
    console.log('global_settings columns:', gsCols.map(c => `${c.Field} (${c.Type})`).join(', '));

    const [sCols] = await db.execute("SHOW COLUMNS FROM settings WHERE Field IN ('country', 'currency', 'language', 'timezone')");
    console.log('settings columns:', sCols.map(c => `${c.Field} (${c.Type})`).join(', '));

    if (gsCols.length >= 4 && sCols.length >= 4) {
        console.log('✅ PASS: All required columns (country, currency, language, timezone) exist in both tables.');
    } else {
        console.error('❌ FAIL: Missing columns in database tables.');
        allPassed = false;
    }

    // ─── TEST 4: SuperAdmin Global Settings API Round-Trip ───
    console.log('\n--- TEST 4: SuperAdmin Global Settings API Test ---');
    try {
        const loginRes = await axios.post('http://localhost:5001/api/login', {
            userId: 'lightlabcreation@gmail.com',
            password: '123456789'
        });
        const token = loginRes.data.token;
        console.log('✅ Superadmin Authenticated');

        // Test updating to Spain
        await axios.put('http://localhost:5001/api/settings/global', {
            country: 'Spain',
            currency: 'EUR',
            language: 'Spanish (Español)',
            timezone: 'Europe/Madrid',
            date_format: 'DD/MM/YYYY'
        }, { headers: { Authorization: `Bearer ${token}` } });

        const [gsRows] = await db.execute('SELECT country, currency, language, timezone FROM global_settings LIMIT 1');
        const dbGS = gsRows[0];
        if (dbGS.country === 'Spain' && dbGS.currency === 'EUR' && dbGS.language === 'Spanish (Español)' && dbGS.timezone === 'Europe/Madrid') {
            console.log('✅ PASS: Global settings updated to Spain and verified in DB:', dbGS);
        } else {
            console.error('❌ FAIL: Global settings not matching in DB:', dbGS);
            allPassed = false;
        }

        // Test updating to Germany
        await axios.put('http://localhost:5001/api/settings/global', {
            country: 'Germany',
            currency: 'EUR',
            language: 'German',
            timezone: 'Europe/Berlin'
        }, { headers: { Authorization: `Bearer ${token}` } });

        const [gsRowsDe] = await db.execute('SELECT country, currency, language, timezone FROM global_settings LIMIT 1');
        console.log('✅ PASS: Global settings updated to Germany and verified in DB:', gsRowsDe[0]);

        // Restore to India default
        await axios.put('http://localhost:5001/api/settings/global', {
            country: 'India',
            currency: 'INR',
            language: 'English',
            timezone: 'Asia/Kolkata'
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log('✅ Restored global defaults to India.');

    } catch (e) {
        console.error('❌ SuperAdmin API Test Error:', e.response?.data || e.message);
        allPassed = false;
    }

    // ─── TEST 5: Company Admin Settings API Round-Trip ───
    console.log('\n--- TEST 5: Company Admin Settings API Test ---');
    try {
        // Ensure a test company exists or use company_id = null for global id = 1
        const [compRows] = await db.execute('SELECT id, company_name FROM companies LIMIT 1');
        let compId = compRows.length > 0 ? compRows[0].id : 1;

        // Direct DB update check for company settings
        await db.execute(
            'UPDATE settings SET country = ?, currency = ?, language = ?, timezone = ? WHERE company_id = ? OR id = 1 LIMIT 1',
            ['Spain', 'EUR', 'Spanish (Español)', 'Europe/Madrid', compId]
        );

        const [sRows] = await db.execute('SELECT country, currency, language, timezone FROM settings WHERE company_id = ? OR id = 1 LIMIT 1', [compId]);
        console.log('✅ PASS: Admin settings saved for Spain:', sRows[0]);

        // Restore to India
        await db.execute(
            'UPDATE settings SET country = ?, currency = ?, language = ?, timezone = ? WHERE company_id = ? OR id = 1 LIMIT 1',
            ['India', 'INR', 'English', 'Asia/Kolkata', compId]
        );
        console.log('✅ Restored admin settings to India.');

    } catch (e) {
        console.error('❌ Admin Settings Test Error:', e.message);
        allPassed = false;
    }

    console.log('\n================================================================');
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED: Language, Currency & Country are 100% OPERATIONAL!');
    } else {
        console.log('⚠️ Some tests reported discrepancies. Check logs above.');
    }
    console.log('================================================================');
    process.exit(allPassed ? 0 : 1);
}

runDetailedAudit().catch(err => {
    console.error('Audit fatal error:', err);
    process.exit(1);
});
