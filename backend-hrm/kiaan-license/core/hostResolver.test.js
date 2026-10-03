/**
 * Kiaan License Engine — Host Resolver Unit Test Suite
 * Module: backend-hrm/kiaan-license/core/hostResolver.test.js
 *
 * Verifies:
 * 1. RFC 1123 domain normalization (case, trailing dots, IDN/punycode)
 * 2. Port handling (isolation, boundaries 1-65535, invalid ports)
 * 3. Malformed host rejection (injection, credentials, paths, forbidden chars)
 * 4. Reverse proxy trust evaluation (trusted vs untrusted peer IPs, CIDR matching)
 * 5. Ambiguous multi-value forwarded host rejection
 * 6. Development localhost bypass vs production strict enforcement
 * 7. IPv4 and IPv6 edge cases (bracketed IPv6, IPv4-mapped IPv6)
 * 8. Deterministic repeated results
 */

'use strict';

const assert = require('assert');
const {
    resolveHost,
    normalizeHostname,
    isTrustedProxy,
    isDevelopmentHost,
    DEFAULT_TRUSTED_PROXIES,
    HostResolutionCodes
} = require('./hostResolver');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        throw err;
    }
}

console.log('\n======================================================');
console.log('  HOST RESOLVER & REVERSE PROXY GUARD TEST SUITE');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// 1. STANDARD DOMAIN NORMALIZATION
// ---------------------------------------------------------------------------
console.log('Group 1: Standard Domain Normalization');

runTest('Standard lowercase domain', () => {
    const res = normalizeHostname('hrm.kiaan.com');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res.port, null);
    assert.strictEqual(res.code, HostResolutionCodes.VALID_HOST);
});

runTest('Uppercase domain is lowercased', () => {
    const res = normalizeHostname('HRM.KIAAN.COM');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res.port, null);
});

runTest('Mixed case domain is lowercased', () => {
    const res = normalizeHostname('Portal.KiaanHRM.Enterprise.Net');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'portal.kiaanhrm.enterprise.net');
});

runTest('Trailing DNS root dot is stripped', () => {
    const res = normalizeHostname('hrm.kiaan.com.');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'hrm.kiaan.com');
});

runTest('Uppercase domain with trailing dot', () => {
    const res = normalizeHostname('ERP.ACME.ORG.');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'erp.acme.org');
});

runTest('Internationalized domain name (IDN) converted to ASCII punycode', () => {
    const res = normalizeHostname('münchen.de');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'xn--mnchen-3ya.de');
});

runTest('Pre-encoded punycode domain preserved', () => {
    const res = normalizeHostname('xn--mnchen-3ya.de');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'xn--mnchen-3ya.de');
});

// ---------------------------------------------------------------------------
// 2. PORT EXTRACTION & VALIDATION
// ---------------------------------------------------------------------------
console.log('\nGroup 2: Port Extraction & Boundary Validation');

runTest('Valid standard ports extracted correctly', () => {
    const res1 = normalizeHostname('hrm.kiaan.com:80');
    assert.strictEqual(res1.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res1.port, 80);

    const res2 = normalizeHostname('hrm.kiaan.com:443');
    assert.strictEqual(res2.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res2.port, 443);

    const res3 = normalizeHostname('hrm.kiaan.com:8080');
    assert.strictEqual(res3.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res3.port, 8080);
});

runTest('Port boundary values: 1 and 65535', () => {
    const minPort = normalizeHostname('hrm.kiaan.com:1');
    assert.strictEqual(minPort.success, true);
    assert.strictEqual(minPort.port, 1);

    const maxPort = normalizeHostname('hrm.kiaan.com:65535');
    assert.strictEqual(maxPort.success, true);
    assert.strictEqual(maxPort.port, 65535);
});

runTest('Port out of range rejected (0 and 65536)', () => {
    const zeroPort = normalizeHostname('hrm.kiaan.com:0');
    assert.strictEqual(zeroPort.success, false);
    assert.strictEqual(zeroPort.code, HostResolutionCodes.INVALID_PORT);

    const highPort = normalizeHostname('hrm.kiaan.com:65536');
    assert.strictEqual(highPort.success, false);
    assert.strictEqual(highPort.code, HostResolutionCodes.INVALID_PORT);
});

runTest('Non-numeric port rejected', () => {
    const res = normalizeHostname('hrm.kiaan.com:abc');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, HostResolutionCodes.INVALID_PORT);
});

runTest('Empty port (trailing colon) rejected', () => {
    const res = normalizeHostname('hrm.kiaan.com:');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, HostResolutionCodes.INVALID_PORT);
});

// ---------------------------------------------------------------------------
// 3. MALFORMED HOSTNAME REJECTION & INJECTION PREVENTION
// ---------------------------------------------------------------------------
console.log('\nGroup 3: Malformed Hostname Rejection & Injection Prevention');

runTest('Empty or whitespace host rejected', () => {
    assert.strictEqual(normalizeHostname('').code, HostResolutionCodes.EMPTY_HOST);
    assert.strictEqual(normalizeHostname('   ').code, HostResolutionCodes.EMPTY_HOST);
    assert.strictEqual(normalizeHostname(null).code, HostResolutionCodes.EMPTY_HOST);
    assert.strictEqual(normalizeHostname(undefined).code, HostResolutionCodes.EMPTY_HOST);
});

runTest('Credentials in host rejected (@ character)', () => {
    const res = normalizeHostname('admin:secret@hrm.kiaan.com');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, HostResolutionCodes.MALFORMED_HOST);
});

runTest('Paths and query strings in host rejected (/, ?, #)', () => {
    assert.strictEqual(normalizeHostname('hrm.kiaan.com/api/v1').code, HostResolutionCodes.MALFORMED_HOST);
    assert.strictEqual(normalizeHostname('hrm.kiaan.com?token=123').code, HostResolutionCodes.MALFORMED_HOST);
    assert.strictEqual(normalizeHostname('hrm.kiaan.com#fragment').code, HostResolutionCodes.MALFORMED_HOST);
});

runTest('Spaces, backslashes, control characters rejected', () => {
    assert.strictEqual(normalizeHostname('hrm kiaan.com').code, HostResolutionCodes.MALFORMED_HOST);
    assert.strictEqual(normalizeHostname('hrm\\kiaan.com').code, HostResolutionCodes.MALFORMED_HOST);
    assert.strictEqual(normalizeHostname('hrm\r\nkiaan.com').code, HostResolutionCodes.MALFORMED_HOST);
});

runTest('Consecutive dots rejected (empty labels)', () => {
    const res = normalizeHostname('hrm..kiaan.com');
    assert.strictEqual(res.success, false);
    assert(res.code === HostResolutionCodes.MALFORMED_DOMAIN || res.code === HostResolutionCodes.MALFORMED_DOMAIN_LABEL);
});

runTest('Hyphen at start or end of label rejected', () => {
    assert.strictEqual(normalizeHostname('-hrm.kiaan.com').code, HostResolutionCodes.MALFORMED_DOMAIN_LABEL);
    assert.strictEqual(normalizeHostname('hrm-.kiaan.com').code, HostResolutionCodes.MALFORMED_DOMAIN_LABEL);
});

// ---------------------------------------------------------------------------
// 4. IPV4 AND IPV6 EDGE CASES
// ---------------------------------------------------------------------------
console.log('\nGroup 4: IPv4 and IPv6 Edge Cases');

runTest('Standard IPv4 address without and with port', () => {
    const res1 = normalizeHostname('192.168.1.100');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.hostname, '192.168.1.100');
    assert.strictEqual(res1.port, null);

    const res2 = normalizeHostname('10.0.0.1:3000');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.hostname, '10.0.0.1');
    assert.strictEqual(res2.port, 3000);
});

runTest('Bracketed IPv6 address without and with port', () => {
    const res1 = normalizeHostname('[::1]');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.hostname, '::1');
    assert.strictEqual(res1.port, null);

    const res2 = normalizeHostname('[::1]:8080');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.hostname, '::1');
    assert.strictEqual(res2.port, 8080);

    const res3 = normalizeHostname('[fe80::1ff:fe23:4567:890a]:443');
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.hostname, 'fe80::1ff:fe23:4567:890a');
    assert.strictEqual(res3.port, 443);
});

runTest('Unbracketed IPv6 address rejected per RFC 3986', () => {
    const res = normalizeHostname('2001:db8::1');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, HostResolutionCodes.MALFORMED_IPV6);
});

runTest('Unclosed IPv6 bracket rejected', () => {
    const res = normalizeHostname('[::1');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, HostResolutionCodes.MALFORMED_IPV6);
});

// ---------------------------------------------------------------------------
// 5. REVERSE PROXY TRUST EVALUATION
// ---------------------------------------------------------------------------
console.log('\nGroup 5: Reverse Proxy Trust Evaluation');

runTest('CIDR matcher validates private and loopback ranges', () => {
    assert.strictEqual(isTrustedProxy('127.0.0.1', ['127.0.0.1/32']), true);
    assert.strictEqual(isTrustedProxy('127.0.0.2', ['127.0.0.1/32']), false);
    assert.strictEqual(isTrustedProxy('10.5.20.1', ['10.0.0.0/8']), true);
    assert.strictEqual(isTrustedProxy('172.18.0.4', ['172.16.0.0/12']), true);
    assert.strictEqual(isTrustedProxy('192.168.1.50', ['192.168.0.0/16']), true);
    assert.strictEqual(isTrustedProxy('203.0.113.195', ['192.168.0.0/16']), false);
    assert.strictEqual(isTrustedProxy('::1', ['::1/128']), true);
    assert.strictEqual(isTrustedProxy('::ffff:127.0.0.1', ['127.0.0.1/32']), true);
});

runTest('Trusted proxy remote peer accepts X-Forwarded-Host', () => {
    const result = resolveHost({
        rawHost: '172.18.0.4:3000',
        forwardedHost: 'hrm.enterprise.com',
        remoteIp: '172.18.0.1', // Docker bridge gateway (trusted via 172.16.0.0/12)
        trustedProxies: DEFAULT_TRUSTED_PROXIES
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.hostname, 'hrm.enterprise.com');
    assert.strictEqual(result.source, 'forwarded');
});

runTest('Untrusted proxy remote peer ignores X-Forwarded-Host and falls back to Host', () => {
    const result = resolveHost({
        rawHost: 'direct.legitimate.com',
        forwardedHost: 'spoofed.licensed.com',
        remoteIp: '203.0.113.50', // Public WAN IP (untrusted)
        trustedProxies: DEFAULT_TRUSTED_PROXIES
    });

    assert.strictEqual(result.success, true);
    // X-Forwarded-Host must be completely ignored
    assert.strictEqual(result.hostname, 'direct.legitimate.com');
    assert.strictEqual(result.source, 'untrusted_forwarded_ignored');
});

runTest('Trusted proxy without X-Forwarded-Host falls back to direct Host', () => {
    const result = resolveHost({
        rawHost: 'direct.internal.com',
        forwardedHost: undefined,
        remoteIp: '127.0.0.1',
        trustedProxies: DEFAULT_TRUSTED_PROXIES
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.hostname, 'direct.internal.com');
    assert.strictEqual(result.source, 'direct');
});

runTest('Ambiguous multiple or comma-separated X-Forwarded-Host rejected', () => {
    const result = resolveHost({
        rawHost: 'direct.com',
        forwardedHost: 'legit.com, attacker.com',
        remoteIp: '127.0.0.1',
        trustedProxies: DEFAULT_TRUSTED_PROXIES
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, HostResolutionCodes.AMBIGUOUS_FORWARDED_HOST);
});

// ---------------------------------------------------------------------------
// 6. DEVELOPMENT LOCALHOST BYPASS VS PRODUCTION
// ---------------------------------------------------------------------------
console.log('\nGroup 6: Development Localhost Bypass vs Production');

runTest('Localhost in development environment has isDevBypass = true', () => {
    const res1 = resolveHost({
        rawHost: 'localhost:5000',
        remoteIp: '127.0.0.1',
        nodeEnv: 'development'
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.hostname, 'localhost');
    assert.strictEqual(res1.isDevBypass, true);

    const res2 = resolveHost({
        rawHost: '127.0.0.1:3000',
        remoteIp: '127.0.0.1',
        nodeEnv: 'development'
    });
    assert.strictEqual(res2.isDevBypass, true);

    const res3 = resolveHost({
        rawHost: '[::1]:8080',
        remoteIp: '::1',
        nodeEnv: 'development'
    });
    assert.strictEqual(res3.isDevBypass, true);
});

runTest('Localhost in production environment has isDevBypass = false', () => {
    const res1 = resolveHost({
        rawHost: 'localhost:5000',
        remoteIp: '127.0.0.1',
        nodeEnv: 'production'
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.hostname, 'localhost');
    assert.strictEqual(res1.isDevBypass, false); // Hard-disabled in production

    const res2 = resolveHost({
        rawHost: '127.0.0.1:5000',
        remoteIp: '127.0.0.1',
        nodeEnv: 'production'
    });
    assert.strictEqual(res2.isDevBypass, false);
});

runTest('Production domain in development has isDevBypass = false', () => {
    const res = resolveHost({
        rawHost: 'hrm.kiaan.com',
        remoteIp: '127.0.0.1',
        nodeEnv: 'development'
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.hostname, 'hrm.kiaan.com');
    assert.strictEqual(res.isDevBypass, false); // Real domain is not dev bypass
});

// ---------------------------------------------------------------------------
// 7. DETERMINISM & PURITY
// ---------------------------------------------------------------------------
console.log('\nGroup 7: Determinism & Purity');

runTest('Repeated resolution is 100% deterministic and stateless', () => {
    const params = {
        rawHost: 'HRM.Kiaan.com.:8443',
        forwardedHost: 'App.München.DE.:443',
        remoteIp: '10.0.0.5',
        trustedProxies: DEFAULT_TRUSTED_PROXIES,
        nodeEnv: 'production'
    };

    const first = resolveHost(params);
    for (let i = 0; i < 50; i++) {
        const next = resolveHost(params);
        assert.deepStrictEqual(next, first);
    }
    assert.strictEqual(first.hostname, 'app.xn--mnchen-3ya.de');
    assert.strictEqual(first.port, 443);
    assert.strictEqual(first.isDevBypass, false);
});

console.log('\n======================================================');
console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('======================================================\n');
