/**
 * Kiaan Central License Authority — Crockford Base32 & CRC16 Engine
 * Module: backend-hrm/kiaan-authority/core/crockfordBase32.js
 *
 * Implements Douglas Crockford's Base32 specification and CRC16-CCITT checksumming.
 *
 * Properties:
 * 1. Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ (32 characters, 5 bits each)
 * 2. Excluded characters: I, L, O, U
 * 3. Permissive decoding:
 *    - 'O' and 'o' map to '0'
 *    - 'I', 'i', 'L', 'l' map to '1'
 *    - 'U' and 'u' are strictly rejected (to avoid accidental obscenities)
 * 4. CRC16-CCITT: Polynomial 0x1021, Initial value 0xFFFF.
 */

'use strict';

/**
 * Douglas Crockford Base32 canonical alphabet (uppercase).
 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Reverse lookup map from character code to 5-bit numeric value.
 */
const DECODE_MAP = Object.freeze((() => {
    const map = new Array(256).fill(-1);
    for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
        const char = CROCKFORD_ALPHABET[i];
        map[char.charCodeAt(0)] = i;
        map[char.toLowerCase().charCodeAt(0)] = i;
    }
    // Permissive aliases
    map['O'.charCodeAt(0)] = 0;
    map['o'.charCodeAt(0)] = 0;
    map['I'.charCodeAt(0)] = 1;
    map['i'.charCodeAt(0)] = 1;
    map['L'.charCodeAt(0)] = 1;
    map['l'.charCodeAt(0)] = 1;
    return map;
})());

/**
 * Calculates CRC16-CCITT (0x1021, init 0xFFFF) over a buffer or UTF-8 string.
 *
 * @param {Buffer|string} input Data to checksum
 * @returns {number} 16-bit unsigned integer (0x0000 - 0xFFFF)
 */
function crc16Ccitt(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
    let crc = 0xFFFF;

    for (let i = 0; i < buffer.length; i++) {
        crc ^= (buffer[i] << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }

    return crc & 0xFFFF;
}

/**
 * Encodes a 16-bit CRC integer into exactly 4 Crockford Base32 characters.
 *
 * @param {number} crc 16-bit integer
 * @returns {string} 4-character Crockford Base32 string
 */
function encodeCrc16ToCrockford(crc) {
    if (typeof crc !== 'number' || crc < 0 || crc > 0xFFFF) {
        throw new TypeError('CRC value must be an unsigned 16-bit integer (0..65535)');
    }
    // 16 bits distributed into four 5-bit chunks (16 bits fits in 20 bits):
    // Chunk 0: bits 15..11 (5 bits)
    // Chunk 1: bits 10..6  (5 bits)
    // Chunk 2: bits 5..1   (5 bits)
    // Chunk 3: bit 0       (1 bit shifted into high bit of 5-bit chunk)
    const c0 = CROCKFORD_ALPHABET[(crc >> 11) & 0x1F];
    const c1 = CROCKFORD_ALPHABET[(crc >> 6) & 0x1F];
    const c2 = CROCKFORD_ALPHABET[(crc >> 1) & 0x1F];
    const c3 = CROCKFORD_ALPHABET[(crc & 0x01) << 4];
    return `${c0}${c1}${c2}${c3}`;
}

/**
 * Decodes a 4-character Crockford Base32 string back into a 16-bit CRC integer.
 *
 * @param {string} str 4-character Crockford Base32 string
 * @returns {number} 16-bit unsigned integer
 */
function decodeCrockfordToCrc16(str) {
    if (typeof str !== 'string' || str.length !== 4) {
        throw new TypeError('Expected exactly 4 Crockford Base32 characters for CRC16');
    }
    const v0 = DECODE_MAP[str.charCodeAt(0)];
    const v1 = DECODE_MAP[str.charCodeAt(1)];
    const v2 = DECODE_MAP[str.charCodeAt(2)];
    const v3 = DECODE_MAP[str.charCodeAt(3)];

    if (v0 === -1 || v1 === -1 || v2 === -1 || v3 === -1) {
        throw new Error('Invalid Crockford Base32 character in CRC block');
    }

    // The 16-bit CRC occupies 16 bits across 4 5-bit characters (20 bits total).
    // Bits 3..0 of character 3 are unused zero-padding bits. Non-zero padding bits
    // indicate corruption or a typo in the final character and must be rejected.
    if ((v3 & 0x0F) !== 0) {
        throw new Error('Invalid CRC16 encoding: non-zero padding bits in checksum');
    }

    return ((v0 << 11) | (v1 << 6) | (v2 << 1) | (v3 >> 4)) & 0xFFFF;
}

/**
 * Encodes a Buffer whose length is a multiple of 5 bytes into Crockford Base32.
 * Each 5-byte block (40 bits) maps bijectively to 8 5-bit Crockford characters
 * with zero padding bits.
 *
 * @param {Buffer} buffer Raw byte buffer (length must be multiple of 5)
 * @returns {string} Crockford Base32 string
 */
function encodeBytesToCrockford(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        throw new TypeError('Expected a Buffer for Crockford Base32 encoding');
    }
    if (buffer.length === 0 || buffer.length % 5 !== 0) {
        throw new Error(`Buffer length must be a non-zero multiple of 5 bytes, got ${buffer.length}`);
    }

    let result = '';
    for (let i = 0; i < buffer.length; i += 5) {
        const b0 = buffer[i];
        const b1 = buffer[i + 1];
        const b2 = buffer[i + 2];
        const b3 = buffer[i + 3];
        const b4 = buffer[i + 4];

        result += CROCKFORD_ALPHABET[(b0 >> 3) & 0x1F];
        result += CROCKFORD_ALPHABET[((b0 & 0x07) << 2) | ((b1 >> 6) & 0x03)];
        result += CROCKFORD_ALPHABET[(b1 >> 1) & 0x1F];
        result += CROCKFORD_ALPHABET[((b1 & 0x01) << 4) | ((b2 >> 4) & 0x0F)];
        result += CROCKFORD_ALPHABET[((b2 & 0x0F) << 1) | ((b3 >> 7) & 0x01)];
        result += CROCKFORD_ALPHABET[(b3 >> 2) & 0x1F];
        result += CROCKFORD_ALPHABET[((b3 & 0x03) << 3) | ((b4 >> 5) & 0x07)];
        result += CROCKFORD_ALPHABET[b4 & 0x1F];
    }

    return result;
}

/**
 * Decodes a Crockford Base32 string whose length is a multiple of 8 characters into a Buffer.
 *
 * @param {string} str Crockford Base32 string (length multiple of 8)
 * @returns {Buffer} Decoded Buffer
 */
function decodeCrockfordToBytes(str) {
    if (typeof str !== 'string' || str.length === 0 || str.length % 8 !== 0) {
        throw new Error('Expected Crockford Base32 string length to be a non-zero multiple of 8');
    }

    const buf = Buffer.alloc((str.length / 8) * 5);
    for (let i = 0; i < str.length; i += 8) {
        const v = [];
        for (let j = 0; j < 8; j++) {
            const char = str[i + j];
            const val = DECODE_MAP[char.charCodeAt(0)];
            if (val === -1 || val === undefined) {
                throw new Error(`Invalid Crockford Base32 character: '${char}'`);
            }
            v.push(val);
        }
        const byteOffset = (i / 8) * 5;
        buf[byteOffset + 0] = ((v[0] << 3) | (v[1] >> 2)) & 0xFF;
        buf[byteOffset + 1] = ((v[1] << 6) | (v[2] << 1) | (v[3] >> 4)) & 0xFF;
        buf[byteOffset + 2] = ((v[3] << 4) | (v[4] >> 1)) & 0xFF;
        buf[byteOffset + 3] = ((v[4] << 7) | (v[5] << 2) | (v[6] >> 3)) & 0xFF;
        buf[byteOffset + 4] = ((v[6] << 5) | v[7]) & 0xFF;
    }

    return buf;
}

/**
 * Normalizes a single Crockford Base32 character.
 * Replaces O->0, I/L->1, uppercases valid chars, rejects U and non-base32.
 *
 * @param {string} char Single character
 * @returns {string} Canonical Crockford character
 * @throws {Error} If character is invalid or 'U'
 */
function normalizeCrockfordChar(char) {
    if (typeof char !== 'string' || char.length !== 1) {
        throw new TypeError('Expected a single character');
    }
    const upper = char.toUpperCase();
    if (upper === 'U') {
        throw new Error("Invalid Crockford Base32 character: 'U' is prohibited to avoid accidental obscenities");
    }
    const val = DECODE_MAP[char.charCodeAt(0)];
    if (val === -1) {
        throw new Error(`Invalid character for Crockford Base32: '${char}'`);
    }
    return CROCKFORD_ALPHABET[val];
}

module.exports = {
    CROCKFORD_ALPHABET,
    crc16Ccitt,
    encodeCrc16ToCrockford,
    decodeCrockfordToCrc16,
    encodeBytesToCrockford,
    decodeCrockfordToBytes,
    normalizeCrockfordChar
};
