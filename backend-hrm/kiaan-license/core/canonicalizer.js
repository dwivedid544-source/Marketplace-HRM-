/**
 * Kiaan License Engine — Core Canonicalizer
 * Module: backend-hrm/kiaan-license/core/canonicalizer.js
 *
 * Implements RFC 8785: JSON Canonicalization Scheme (JCS).
 * Produces deterministic, platform-independent canonical JSON representation
 * of data structures for cryptographic signing and verification (e.g. Ed25519).
 *
 * Specification Reference:
 * - RFC 8785: https://www.rfc-editor.org/rfc/rfc8785.html
 * - Section 3.2.1: Whitespace (none outside strings)
 * - Section 3.2.2.1: Literals (null, true, false)
 * - Section 3.2.2.2: Strings (UTF-16 escaping, lone surrogate rejection)
 * - Section 3.2.2.3: Numbers (IEEE 754 double precision serialization, -0 -> 0)
 * - Section 3.2.3: Sorting of Object Properties (UTF-16 code unit ascending order)
 * - Section 3.2.4: UTF-8 generation
 */

'use strict';

/**
 * Validates and serializes a string according to RFC 8785 Section 3.2.2.2.
 * Rejects strings containing lone (unpaired) surrogates.
 *
 * @param {string} value
 * @returns {string} Serialized JSON string with standard escaping
 */
function serializeString(value) {
    // Check for lone / unpaired UTF-16 surrogates (RFC 8785 Section 3.2.2.2 Note)
    if (typeof value.isWellFormed === 'function') {
        if (!value.isWellFormed()) {
            throw new Error('RFC 8785: Lone surrogate code point is not permitted in strings');
        }
    } else {
        // Fallback detection for environments without String.prototype.isWellFormed
        const loneSurrogateRegex = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
        if (loneSurrogateRegex.test(value)) {
            throw new Error('RFC 8785: Lone surrogate code point is not permitted in strings');
        }
    }

    return JSON.stringify(value);
}

/**
 * Serializes primitive values according to RFC 8785 Section 3.2.2.
 *
 * @param {*} value
 * @returns {string}
 */
function serializePrimitive(value) {
    switch (typeof value) {
        case 'number':
            if (Number.isNaN(value)) {
                throw new TypeError('RFC 8785: NaN is not permitted in JSON');
            }
            if (!Number.isFinite(value)) {
                throw new TypeError('RFC 8785: Infinity is not permitted in JSON');
            }
            // In ECMAScript, JSON.stringify(-0) correctly produces "0"
            // and complies with ES 7.1.12.1 ToString Applied to the Number Type.
            return JSON.stringify(value);

        case 'string':
            return serializeString(value);

        case 'boolean':
            return value ? 'true' : 'false';

        case 'bigint':
            throw new TypeError('RFC 8785: BigInt is not permitted in standard JSON');

        default:
            // null, or values JSON.stringify maps to undefined (undefined, symbol, function)
            return JSON.stringify(value);
    }
}

/**
 * Unwraps an object, resolving any custom .toJSON() methods and boxed primitives,
 * while detecting circular references.
 *
 * @param {*} value
 * @param {Set<object>} seen
 * @returns {*} Serialized string representation, or frame metadata for iteration
 */
function enterValue(value, seen) {
    let wrappers = null;

    // Resolve .toJSON() methods if present (e.g. Date instances or custom objects)
    while (value !== null && typeof value === 'object' && typeof value.toJSON === 'function') {
        if (seen.has(value)) {
            throw new TypeError('RFC 8785: Circular reference detected');
        }
        seen.add(value);
        if (!wrappers) {
            wrappers = [];
        }
        wrappers.push(value);
        value = value.toJSON();
    }

    // Unwrap boxed primitives (new Number, new String, new Boolean)
    if (value instanceof Number || value instanceof String || value instanceof Boolean) {
        value = value.valueOf();
    }

    // If unwrapped value is a primitive or null
    if (value === null || typeof value !== 'object') {
        if (wrappers !== null) {
            for (const wrapper of wrappers) {
                seen.delete(wrapper);
            }
        }
        return serializePrimitive(value);
    }

    // Detect circular graph
    if (seen.has(value)) {
        throw new TypeError('RFC 8785: Circular reference detected');
    }
    seen.add(value);

    return {
        container: value,
        // null marks an array frame; otherwise holds sorted property keys.
        // Array.prototype.sort() comparator compares by UTF-16 code units as required by RFC 8785 Section 3.2.3.
        keys: Array.isArray(value) ? null : Object.keys(value).sort(),
        index: 0,
        first: true,
        wrappers: wrappers
    };
}

/**
 * Canonicalizes any JSON-compatible JavaScript value into a deterministic
 * canonical JSON string in strict accordance with RFC 8785.
 *
 * Employs an iterative depth-first stack traversal to support arbitrarily
 * deeply nested data structures without risking call-stack overflow.
 *
 * @param {*} object The value, array, or object to canonicalize
 * @returns {string|undefined} Deterministic canonical JSON string
 */
function canonicalize(object) {
    if (object === null || typeof object !== 'object') {
        return serializePrimitive(object);
    }

    const seen = new Set();
    const root = enterValue(object, seen);

    if (typeof root !== 'object') {
        return root;
    }

    let result = root.keys === null ? '[' : '{';
    const stack = [root];

    outer:
    while (stack.length > 0) {
        const frame = stack[stack.length - 1];
        const container = frame.container;

        if (frame.keys === null) {
            // Array Container
            while (frame.index < container.length) {
                const i = frame.index++;
                if (i > 0) {
                    result += ',';
                }

                const element = container[i];
                // Inside arrays, undefined, functions, and symbols map to null
                const value = (element === undefined || typeof element === 'symbol' || typeof element === 'function')
                    ? null
                    : element;

                if (value === null || typeof value !== 'object') {
                    result += serializePrimitive(value);
                    continue;
                }

                const child = enterValue(value, seen);
                if (typeof child !== 'object') {
                    result += (child === undefined ? 'null' : child);
                    continue;
                }

                result += child.keys === null ? '[' : '{';
                stack.push(child);
                continue outer;
            }
            result += ']';
        } else {
            // Object Container
            const keys = frame.keys;
            while (frame.index < keys.length) {
                const key = keys[frame.index++];
                const value = container[key];

                // Inside objects, properties with undefined, symbol, or function values are omitted
                if (value === undefined || typeof value === 'symbol' || typeof value === 'function') {
                    continue;
                }

                if (value === null || typeof value !== 'object') {
                    if (frame.first) {
                        frame.first = false;
                    } else {
                        result += ',';
                    }
                    result += serializeString(key) + ':' + serializePrimitive(value);
                    continue;
                }

                const child = enterValue(value, seen);
                // If a toJSON returned undefined, drop the property
                if (child === undefined) {
                    continue;
                }

                if (frame.first) {
                    frame.first = false;
                } else {
                    result += ',';
                }

                result += serializeString(key) + ':';
                if (typeof child !== 'object') {
                    result += child;
                    continue;
                }

                result += child.keys === null ? '[' : '{';
                stack.push(child);
                continue outer;
            }
            result += '}';
        }

        // Frame complete: remove container from cycle detection
        seen.delete(container);
        if (frame.wrappers !== null) {
            for (const wrapper of frame.wrappers) {
                seen.delete(wrapper);
            }
        }
        stack.pop();
    }

    return result;
}

/**
 * Helper to produce a UTF-8 Buffer directly from the canonicalized JSON output.
 * Convenience method for cryptographic hashing and signing (e.g. crypto.sign).
 *
 * @param {*} object
 * @returns {Buffer} UTF-8 bytes of canonical JSON
 */
function canonicalizeToBuffer(object) {
    const canonicalStr = canonicalize(object);
    if (canonicalStr === undefined) {
        throw new TypeError('RFC 8785: Cannot convert undefined to canonical buffer');
    }
    return Buffer.from(canonicalStr, 'utf8');
}

module.exports = canonicalize;
module.exports.canonicalize = canonicalize;
module.exports.canonicalizeToBuffer = canonicalizeToBuffer;
module.exports.default = canonicalize;
