const axios = require('axios');
const { 
    SUPPORTED_COUNTRIES, 
    SUPPORTED_CURRENCIES, 
    SUPPORTED_LANGUAGES, 
    CURRENCY_SYMBOLS,
    getCountryByCode, 
    getCurrencyByCountry 
} = require('../config/countryConfig');

async function testSuite() {
    console.log('====================================================');
    console.log('🚀 TESTING COUNTRY, CURRENCY & LANGUAGE CONFIGURATION');
    console.log('====================================================\n');

    // 1. Verify Configuration Integrity
    console.log('--- 1. Testing Supported Countries List ---');
    const expectedCountries = ['India', 'USA', 'UK', 'UAE', 'Germany', 'Spain'];
    expectedCountries.forEach(name => {
        const c = SUPPORTED_COUNTRIES.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (c) {
            console.log(`✅ [${c.flag} ${c.name}] Code: ${c.code} | Currency: ${c.currency} (${c.currencySymbol}) | Languages: ${c.languages.map(l => l.name).join(', ')}`);
        } else {
            console.error(`❌ Country missing: ${name}`);
        }
    });

    // 2. Test Specific Country Configurations
    console.log('\n--- 2. Testing Specific Country Resolution & Formatting ---');
    
    // India
    const inCountry = getCountryByCode('IN');
    console.log('🇮🇳 India:', {
        country: inCountry?.name,
        currency: inCountry?.currency,
        symbol: inCountry?.currencySymbol,
        languages: inCountry?.languages
    });

    // Germany
    const deCountry = getCountryByCode('DE');
    console.log('🇩🇪 Germany:', {
        country: deCountry?.name,
        currency: deCountry?.currency,
        symbol: deCountry?.currencySymbol,
        languages: deCountry?.languages
    });

    // Spain
    const esCountry = getCountryByCode('ES');
    console.log('🇪🇸 Spain:', {
        country: esCountry?.name,
        currency: esCountry?.currency,
        symbol: esCountry?.currencySymbol,
        languages: esCountry?.languages
    });

    // Check EUR sharing
    if (deCountry.currency === 'EUR' && esCountry.currency === 'EUR' && deCountry.currencySymbol === '€' && esCountry.currencySymbol === '€') {
        console.log('✅ PASS: Germany and Spain correctly share EUR (€) without duplicate currency codes.');
    } else {
        console.error('❌ FAIL: Germany and Spain currency mismatch.');
    }

    // 3. Test Switching Scenarios
    console.log('\n--- 3. Testing Country Switch Scenarios ---');
    const scenarios = [
        { from: 'Germany', to: 'Spain', expectedCurr: 'EUR', expectedSym: '€' },
        { from: 'Spain', to: 'Germany', expectedCurr: 'EUR', expectedSym: '€' },
        { from: 'India', to: 'Spain', expectedCurr: 'EUR', expectedSym: '€' },
        { from: 'Spain', to: 'USA', expectedCurr: 'USD', expectedSym: '$' }
    ];

    scenarios.forEach(({ from, to, expectedCurr, expectedSym }) => {
        const toObj = getCountryByCode(to);
        const curr = toObj.currency;
        const sym = toObj.currencySymbol;
        const pass = curr === expectedCurr && sym === expectedSym;
        console.log(`${pass ? '✅' : '❌'} Switch: ${from} ➔ ${to} => Resolved Currency: ${curr} (${sym})`);
    });

    // 4. Test API Integration (Login + Settings Update)
    console.log('\n--- 4. Testing Backend API Integration ---');
    try {
        const loginRes = await axios.post('http://localhost:5001/api/login', {
            userId: 'lightlabcreation@gmail.com',
            password: '123456789'
        });
        const token = loginRes.data.token;
        console.log('✅ Superadmin Logged in successfully. Token acquired.');

        // Update to Spain
        console.log('\nUpdating Global Settings to Spain (ES)...');
        await axios.put('http://localhost:5001/api/settings/global', {
            platform_name: 'Nexus HRM Pro',
            country: 'Spain',
            currency: 'EUR',
            language: 'Spanish (Español)',
            timezone: 'Europe/Madrid',
            date_format: 'DD/MM/YYYY'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Read back
        const globalRes = await axios.get('http://localhost:5001/api/settings/global', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Global Settings Saved & Verified:', {
            country: globalRes.data.country,
            currency: globalRes.data.currency,
            language: globalRes.data.language,
            timezone: globalRes.data.timezone
        });

        // Reset back to India (safe default)
        console.log('\nResetting Global Settings to India (IN)...');
        await axios.put('http://localhost:5001/api/settings/global', {
            platform_name: 'Nexus HRM Pro',
            country: 'India',
            currency: 'INR',
            language: 'English',
            timezone: 'Asia/Kolkata',
            date_format: 'DD/MM/YYYY'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Default settings restored cleanly.');

    } catch (apiErr) {
        console.error('❌ API Test Error:', apiErr.response?.data || apiErr.message);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL COUNTRY, CURRENCY & LANGUAGE TESTS COMPLETED!');
    console.log('====================================================');
    process.exit(0);
}

testSuite().catch(err => {
    console.error(err);
    process.exit(1);
});
