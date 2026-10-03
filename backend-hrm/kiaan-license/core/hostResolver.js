/**
 * Kiaan License Engine — Host Resolver & Reverse Proxy Guard
 * Module: backend-hrm/kiaan-license/core/hostResolver.js
 *
 * Implements secure host resolution, canonical domain normalization,
 * RFC 1123 DNS validation, and reverse proxy trust verification.
 *
 * Security Requirements:
 * 1. Reverse Proxy Trust: Forwarded headers (X-Forwarded-Host) are ONLY inspected
 *    if the immediate remote peer IP matches an explicitly configured trusted proxy list.
 * 2. Spoofing Prevention: If the peer IP is not trusted, X-Forwarded-Host is completely ignored,
 *    and the server falls back strictly to the direct socket Host header.
 * 3. Ambiguous Header Rejection: Multiple comma-separated forwarded hosts are strictly rejected
 *    to prevent HTTP Host header smuggling or conflicting proxy configurations.
 * 4. RFC 1123 Normalization: Hostnames are lowercased, trailing DNS root dots stripped,
 *    ports parsed and isolated, and labels validated against DNS specifications.
 * 5. Internationalized Domains (IDN): Converted to ASCII punycode (RFC 5891).
 * 6. Development Isolation: Localhost bypass (localhost, 127.0.0.1, ::1) is permitted
 *    strictly when NODE_ENV === 'development'. Production must never receive a bypass.
 */

'use strict';

const net = require('net');
const { domainToASCII } = require('url');

/**
 * Standard RFC 1918 & Loopback CIDRs used as secure defaults for trusted reverse proxies.
 * Includes loopback (127.0.0.1/32, ::1/128) and private container/intranet subnets.
 */
const DEFAULT_TRUSTED_PROXIES = Object.freeze([
    '127.0.0.1/32',
    '::1/128',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
]);

/**
 * Standard loopback / development hostnames.
 */
const DEV_HOSTNAMES = Object.freeze(new Set([
    'localhost',
    '127.0.0.1',
    '::1'
]));

/**
 * Host resolution status codes.
 */
const HostResolutionCodes = Object.freeze({
    VALID_HOST: 'VALID_HOST',
    EMPTY_HOST: 'EMPTY_HOST',
    MALFORMED_HOST: 'MALFORMED_HOST',
    MALFORMED_IPV6: 'MALFORMED_IPV6',
    INVALID_IPV6: 'INVALID_IPV6',
    INVALID_PORT: 'INVALID_PORT',
    MALFORMED_DOMAIN: 'MALFORMED_DOMAIN',
    MALFORMED_DOMAIN_LABEL: 'MALFORMED_DOMAIN_LABEL',
    AMBIGUOUS_FORWARDED_HOST: 'AMBIGUOUS_FORWARDED_HOST',
    UNTRUSTED_PROXY_IGNORED: 'UNTRUSTED_PROXY_IGNORED',
    INVALID_REQUEST: 'INVALID_REQUEST'
});

/**
 * Parses an IPv4 or IPv6 string into a structured representation with BigInt representation
 * for bitwise CIDR mask comparison.
 *
 * @param {string} ip
 * @returns {object|null} { version: 4|6, bigInt: BigInt, str: string }
 */
function parseIpAddress(ip) {
    if (typeof ip !== 'string') {
        return null;
    }

    let cleanIp = ip.trim();

    // Strip IPv6 zone index (e.g. fe80::1%eth0)
    const zoneIndex = cleanIp.indexOf('%');
    if (zoneIndex !== -1) {
        cleanIp = cleanIp.slice(0, zoneIndex);
    }

    // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    if (cleanIp.toLowerCase().startsWith('::ffff:') && net.isIPv4(cleanIp.slice(7))) {
        cleanIp = cleanIp.slice(7);
    }

    const version = net.isIP(cleanIp);
    if (version === 4) {
        const octets = cleanIp.split('.').map(Number);
        let n = 0n;
        for (const octet of octets) {
            n = (n << 8n) | BigInt(octet);
        }
        return { version: 4, bigInt: n, str: cleanIp };
    } else if (version === 6) {
        const parts = cleanIp.split('::');
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - (left.length + right.length);
        const middle = Array(missing).fill('0');
        const full = [...left, ...middle, ...right].map(h => parseInt(h || '0', 16));

        let n = 0n;
        for (const h of full) {
            n = (n << 16n) | BigInt(h);
        }
        return { version: 6, bigInt: n, str: cleanIp };
    }

    return null;
}

/**
 * Evaluates whether an IP address falls within a specific CIDR range or matches an exact IP.
 *
 * @param {string} ip The client/peer IP address
 * @param {string} cidrOrIp CIDR notation (e.g. 10.0.0.0/8) or exact IP (e.g. 127.0.0.1)
 * @returns {boolean}
 */
function matchCidr(ip, cidrOrIp) {
    const parsedIp = parseIpAddress(ip);
    if (!parsedIp || typeof cidrOrIp !== 'string') {
        return false;
    }

    const [rangeIp, prefixStr] = cidrOrIp.trim().split('/');
    const parsedCidr = parseIpAddress(rangeIp);
    if (!parsedCidr) {
        return false;
    }

    if (parsedIp.version !== parsedCidr.version) {
        return false;
    }

    const totalBits = parsedIp.version === 4 ? 32n : 128n;
    const prefix = prefixStr !== undefined ? BigInt(prefixStr) : totalBits;

    if (prefix < 0n || prefix > totalBits) {
        return false;
    }

    if (prefix === 0n) {
        return true;
    }

    const mask = ((1n << totalBits) - 1n) ^ ((1n << (totalBits - prefix)) - 1n);
    return (parsedIp.bigInt & mask) === (parsedCidr.bigInt & mask);
}

/**
 * Checks if a remote peer IP is in the trusted reverse proxy list.
 *
 * @param {string} remoteIp The socket remote address
 * @param {string[]} [trustedList] Array of trusted CIDRs or IP addresses
 * @returns {boolean}
 */
function isTrustedProxy(remoteIp, trustedList = DEFAULT_TRUSTED_PROXIES) {
    if (!remoteIp || typeof remoteIp !== 'string') {
        return false;
    }

    if (!Array.isArray(trustedList) || trustedList.length === 0) {
        return false;
    }

    for (const cidr of trustedList) {
        if (matchCidr(remoteIp, cidr)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a hostname is a loopback or local development host.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isDevelopmentHost(hostname) {
    if (!hostname || typeof hostname !== 'string') {
        return false;
    }
    return DEV_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * Normalizes, parses, and validates a raw host string according to RFC 1123 and RFC 3986.
 * Isolates port, strips trailing root dot, lowercases, and validates DNS labels.
 *
 * @param {string} rawHost The Host or X-Forwarded-Host string
 * @returns {object} { success: boolean, hostname: string|null, port: number|null, code: string, reason?: string }
 */
function normalizeHostname(rawHost) {
    if (typeof rawHost !== 'string' || rawHost.trim().length === 0) {
        return {
            success: false,
            hostname: null,
            port: null,
            code: HostResolutionCodes.EMPTY_HOST,
            reason: 'Host is missing or empty'
        };
    }

    const hostStr = rawHost.trim();

    // Reject control characters, whitespace, credentials, paths, query parameters, fragments, backslashes
    // RFC 3986 forbids userinfo, paths, queries, fragments in the host authority
    if (/[\s@/\\?#\x00-\x1f\x7f]/.test(hostStr)) {
        return {
            success: false,
            hostname: null,
            port: null,
            code: HostResolutionCodes.MALFORMED_HOST,
            reason: 'Host contains forbidden characters (whitespace, credentials, path, or query)'
        };
    }

    let hostname = '';
    let port = null;

    // IPv6 host enclosed in square brackets (RFC 3986 § 3.2.2)
    if (hostStr.startsWith('[')) {
        const closingBracket = hostStr.indexOf(']');
        if (closingBracket === -1) {
            return {
                success: false,
                hostname: null,
                port: null,
                code: HostResolutionCodes.MALFORMED_IPV6,
                reason: 'Unclosed IPv6 bracket in host'
            };
        }

        const ipv6Candidate = hostStr.slice(1, closingBracket);
        if (!net.isIPv6(ipv6Candidate)) {
            return {
                success: false,
                hostname: null,
                port: null,
                code: HostResolutionCodes.INVALID_IPV6,
                reason: 'Malformed IPv6 address in host'
            };
        }

        hostname = ipv6Candidate.toLowerCase();
        const remainder = hostStr.slice(closingBracket + 1);

        if (remainder.length > 0) {
            if (!remainder.startsWith(':')) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    code: HostResolutionCodes.MALFORMED_HOST,
                    reason: 'Invalid characters following IPv6 closing bracket'
                };
            }

            const portStr = remainder.slice(1);
            if (!/^\d+$/.test(portStr)) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    code: HostResolutionCodes.INVALID_PORT,
                    reason: 'Port must be a non-empty sequence of digits'
                };
            }

            port = parseInt(portStr, 10);
            if (port < 1 || port > 65535) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    code: HostResolutionCodes.INVALID_PORT,
                    reason: `Port out of range (1-65535): ${port}`
                };
            }
        }
    } else {
        // Non-bracketed host (domain name, IPv4, or malformed IPv6)
        const colonCount = (hostStr.match(/:/g) || []).length;

        if (colonCount > 1) {
            // Unbracketed IPv6 is invalid per RFC 3986 § 3.2.2
            return {
                success: false,
                hostname: null,
                port: null,
                code: HostResolutionCodes.MALFORMED_IPV6,
                reason: 'IPv6 address in host must be enclosed in square brackets'
            };
        } else if (colonCount === 1) {
            const [h, portStr] = hostStr.split(':');
            hostname = h;

            if (!/^\d+$/.test(portStr)) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    code: HostResolutionCodes.INVALID_PORT,
                    reason: 'Port must be a non-empty sequence of digits'
                };
            }

            port = parseInt(portStr, 10);
            if (port < 1 || port > 65535) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    code: HostResolutionCodes.INVALID_PORT,
                    reason: `Port out of range (1-65535): ${port}`
                };
            }
        } else {
            hostname = hostStr;
        }
    }

    // Strip trailing DNS root dot (e.g. "hrm.kiaan.com." -> "hrm.kiaan.com")
    if (hostname.endsWith('.')) {
        hostname = hostname.slice(0, -1);
    }

    if (hostname.length === 0) {
        return {
            success: false,
            hostname: null,
            port: null,
            code: HostResolutionCodes.EMPTY_HOST,
            reason: 'Normalized hostname is empty'
        };
    }

    // Lowercase normalization
    hostname = hostname.toLowerCase();

    // Check if hostname is valid IPv4 or IPv6
    if (net.isIPv4(hostname) || net.isIPv6(hostname)) {
        return {
            success: true,
            hostname: hostname,
            port: port,
            code: HostResolutionCodes.VALID_HOST,
            reason: null
        };
    }

    // Convert Internationalized Domain Names (IDN) to ASCII punycode (e.g. "münchen.de" -> "xn--mnchen-3ya.de")
    let asciiDomain;
    try {
        asciiDomain = domainToASCII(hostname);
    } catch (err) {
        return {
            success: false,
            hostname: null,
            port: null,
            code: HostResolutionCodes.MALFORMED_DOMAIN,
            reason: 'Failed to convert internationalized domain name to ASCII'
        };
    }

    // domainToASCII returns empty string on invalid domain input
    if (!asciiDomain || asciiDomain.length === 0 || asciiDomain.length > 253) {
        return {
            success: false,
            hostname: null,
            port: null,
            code: HostResolutionCodes.MALFORMED_DOMAIN,
            reason: 'Domain name is invalid or exceeds 253 characters'
        };
    }

    // RFC 1123 / RFC 952 DNS label validation
    const labels = asciiDomain.split('.');
    const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

    for (const label of labels) {
        if (!labelRegex.test(label)) {
            return {
                success: false,
                hostname: null,
                port: null,
                code: HostResolutionCodes.MALFORMED_DOMAIN_LABEL,
                reason: `Invalid DNS label '${label}' (must be 1-63 alphanumeric characters, hyphens inside only)`
            };
        }
    }

    return {
        success: true,
        hostname: asciiDomain,
        port: port,
        code: HostResolutionCodes.VALID_HOST,
        reason: null
    };
}

/**
 * Resolves the canonical host for an incoming HTTP request using explicit proxy trust rules.
 *
 * @param {object} params
 * @param {string} [params.rawHost] The HTTP 'Host' header value
 * @param {string} [params.forwardedHost] The HTTP 'X-Forwarded-Host' header value
 * @param {string} [params.remoteIp] The immediate socket peer remote address
 * @param {string[]} [params.trustedProxies] Optional array of trusted proxy CIDRs/IPs
 * @param {string} [params.nodeEnv] Execution environment ('development'|'production'|etc.)
 * @returns {object} Structured host resolution result
 */
function resolveHost({
    rawHost,
    forwardedHost,
    remoteIp,
    trustedProxies = DEFAULT_TRUSTED_PROXIES,
    nodeEnv = process.env.NODE_ENV
} = {}) {
    const isPeerTrusted = isTrustedProxy(remoteIp, trustedProxies);
    let targetHost;
    let source;

    if (forwardedHost !== undefined && forwardedHost !== null && String(forwardedHost).trim().length > 0) {
        if (isPeerTrusted) {
            const rawFwd = String(forwardedHost).trim();

            // Strict Smuggling / Ambiguity Check:
            // Multi-value comma-separated X-Forwarded-Host is strictly rejected as ambiguous
            if (rawFwd.includes(',')) {
                return {
                    success: false,
                    hostname: null,
                    port: null,
                    source: 'forwarded',
                    isDevBypass: false,
                    code: HostResolutionCodes.AMBIGUOUS_FORWARDED_HOST,
                    reason: 'Multiple or comma-separated X-Forwarded-Host values are not permitted'
                };
            }

            targetHost = rawFwd;
            source = 'forwarded';
        } else {
            // Untrusted remote peer attempted to send X-Forwarded-Host:
            // Discard the forwarded header and fall back strictly to direct Host header
            targetHost = rawHost;
            source = 'untrusted_forwarded_ignored';
        }
    } else {
        // No forwarded header provided: use direct Host header
        targetHost = rawHost;
        source = 'direct';
    }

    // Normalize and validate the selected host string
    const normalized = normalizeHostname(targetHost);

    if (!normalized.success) {
        return {
            success: false,
            hostname: null,
            port: null,
            source: source,
            isDevBypass: false,
            code: normalized.code,
            reason: normalized.reason
        };
    }

    // Evaluate development localhost bypass
    // Allowed strictly when NODE_ENV === 'development'
    const isDevHost = isDevelopmentHost(normalized.hostname);
    const isDevBypass = isDevHost && (nodeEnv === 'development');

    return {
        success: true,
        hostname: normalized.hostname,
        port: normalized.port,
        source: source,
        isDevBypass: isDevBypass,
        code: HostResolutionCodes.VALID_HOST,
        reason: null
    };
}

module.exports = {
    resolveHost,
    normalizeHostname,
    isTrustedProxy,
    isDevelopmentHost,
    DEFAULT_TRUSTED_PROXIES,
    HostResolutionCodes
};
