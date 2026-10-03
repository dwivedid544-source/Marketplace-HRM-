/**
 * Kiaan License Engine — Canonicalizer Unit Test Suite
 * Module: backend-hrm/kiaan-license/core/canonicalizer.test.js
 *
 * Verifies RFC 8785 JCS compliance against:
 * 1. The 6 official RFC 8785 / Cyberphone reference test vectors
 * 2. UTF-16 code unit object key sorting
 * 3. Number serialization edge cases (IEEE 754, -0, extremes)
 * 4. String escaping & Unicode handling
 * 5. Rejection of invalid / unsupported values (NaN, Infinity, lone surrogates, BigInt, cycles)
 * 6. Repeated serialization determinism
 */

'use strict';

const assert = require('assert');
const canonicalize = require('./canonicalizer');
const { canonicalizeToBuffer } = canonicalize;

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
console.log('  RFC 8785 CANONICALIZER TEST SUITE');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// 1. OFFICIAL RFC 8785 REFERENCE TEST VECTORS
// ---------------------------------------------------------------------------
console.log('Group 1: Official RFC 8785 Reference Vectors');

runTest('Vector: arrays.json', () => {
    const input = [
        56,
        {
            "d": true,
            "10": null,
            "1": []
        }
    ];
    const expected = '[56,{"1":[],"10":null,"d":true}]';
    assert.strictEqual(canonicalize(input), expected);
});

runTest('Vector: french.json (locale-independent UTF-16 code unit sort)', () => {
    const input = {
        "peach": "This sorting order",
        "péché": "is wrong according to French",
        "pêche": "but canonicalization MUST",
        "sin": "ignore locale"
    };
    const expected = '{"peach":"This sorting order","péché":"is wrong according to French","pêche":"but canonicalization MUST","sin":"ignore locale"}';
    assert.strictEqual(canonicalize(input), expected);
});

runTest('Vector: structures.json (nested structures, empty keys, uppercase/lowercase)', () => {
    const input = {
        "1": { "f": { "f": "hi", "F": 5 }, "\n": 56.0 },
        "10": {},
        "": "empty",
        "a": {},
        "111": [{ "e": "yes", "E": "no" }],
        "A": {}
    };
    const expected = '{"":"empty","1":{"\\n":56,"f":{"F":5,"f":"hi"}},"10":{},"111":[{"E":"no","e":"yes"}],"A":{},"a":{}}';
    assert.strictEqual(canonicalize(input), expected);
});

runTest('Vector: unicode.json (unnormalized unicode preserved as-is)', () => {
    const input = {
        "Unnormalized Unicode": "A\u030a"
    };
    const expected = '{"Unnormalized Unicode":"Å"}';
    assert.strictEqual(canonicalize(input), expected);
});

runTest('Vector: values.json (RFC 8785 Section 3.2.2 full primitive & float test)', () => {
    const input = {
        "numbers": [333333333.33333329, 1e30, 4.50, 2e-3, 0.000000000000000000000000001],
        "string": "\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/",
        "literals": [null, true, false]
    };
    const expected = '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}';
    assert.strictEqual(canonicalize(input), expected);
});

runTest('Vector: weird.json (control characters, UTF-16 code units, emojis)', () => {
    const input = {
        "\u20ac": "Euro Sign",
        "\r": "Carriage Return",
        "\u000a": "Newline",
        "1": "One",
        "\u0080": "Control\u007f",
        "\ud83d\ude02": "Smiley",
        "\u00f6": "Latin Small Letter O With Diaeresis",
        "\ufb33": "Hebrew Letter Dalet With Dagesh",
        "</script>": "Browser Challenge"
    };
    const expected = '{"\\n":"Newline","\\r":"Carriage Return","1":"One","</script>":"Browser Challenge","\u0080":"Control\u007f","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😂":"Smiley","דּ":"Hebrew Letter Dalet With Dagesh"}';
    const actual = canonicalize(input);
    assert.strictEqual(actual, expected);
});

// ---------------------------------------------------------------------------
// 2. NUMBER SERIALIZATION & IEEE 754 EDGE CASES
// ---------------------------------------------------------------------------
console.log('\nGroup 2: Number Serialization & IEEE 754 Edge Cases');

runTest('Minus zero (-0) must serialize to "0"', () => {
    assert.strictEqual(canonicalize(-0), '0');
    assert.strictEqual(canonicalize({ val: -0 }), '{"val":0}');
    assert.strictEqual(canonicalize([-0, 0]), '[0,0]');
});

runTest('Smallest positive subnormal (5e-324)', () => {
    assert.strictEqual(canonicalize(5e-324), '5e-324');
    assert.strictEqual(canonicalize(-5e-324), '-5e-324');
});

runTest('Maximum double precision floats', () => {
    assert.strictEqual(canonicalize(1.7976931348623157e+308), '1.7976931348623157e+308');
    assert.strictEqual(canonicalize(-1.7976931348623157e+308), '-1.7976931348623157e+308');
});

runTest('Standard integers and fractional floats', () => {
    assert.strictEqual(canonicalize([0, 1, -1, 42, 3.14159, 1000000]), '[0,1,-1,42,3.14159,1000000]');
});

// ---------------------------------------------------------------------------
// 3. OBJECT KEY ORDERING
// ---------------------------------------------------------------------------
console.log('\nGroup 3: Object Key Ordering (UTF-16 Code Units)');

runTest('Lexicographical ascending property sort', () => {
    const obj = { z: 1, a: 2, m: 3 };
    assert.strictEqual(canonicalize(obj), '{"a":2,"m":3,"z":1}');
});

runTest('Empty string key sorts first', () => {
    const obj = { b: 1, "": 2, a: 3 };
    assert.strictEqual(canonicalize(obj), '{"":2,"a":3,"b":1}');
});

runTest('Prefix length ordering ("a", "aa", "ab")', () => {
    const obj = { "ab": 3, "a": 1, "aa": 2 };
    assert.strictEqual(canonicalize(obj), '{"a":1,"aa":2,"ab":3}');
});

runTest('Numeric keys sorted as strings ("1", "10", "2")', () => {
    const obj = { "2": true, "10": true, "1": true };
    assert.strictEqual(canonicalize(obj), '{"1":true,"10":true,"2":true}');
});

runTest('Case sensitivity (ASCII uppercase precedes lowercase)', () => {
    const obj = { "b": 1, "B": 2, "a": 3, "A": 4 };
    assert.strictEqual(canonicalize(obj), '{"A":4,"B":2,"a":3,"b":1}');
});

// ---------------------------------------------------------------------------
// 4. STRING ESCAPING & UNICODE
// ---------------------------------------------------------------------------
console.log('\nGroup 4: String Escaping & Unicode Handling');

runTest('Control character escaping (\\b, \\t, \\n, \\f, \\r)', () => {
    const obj = { text: "hello\bworld\tfoo\nbar\fbaz\rqux" };
    assert.strictEqual(canonicalize(obj), '{"text":"hello\\bworld\\tfoo\\nbar\\fbaz\\rqux"}');
});

runTest('C0 control characters escaped as lowercase hex (\\u0000 to \\u001f)', () => {
    const obj = { nullChar: "\u0000", escapeChar: "\u001b" };
    assert.strictEqual(canonicalize(obj), '{"escapeChar":"\\u001b","nullChar":"\\u0000"}');
});

runTest('Quotes and backslashes escaped, forward slash unescaped', () => {
    const obj = { path: 'C:\\Users\\admin/"test"' };
    assert.strictEqual(canonicalize(obj), '{"path":"C:\\\\Users\\\\admin/\\"test\\""}');
});

runTest('Multi-byte UTF-8 and surrogate pair characters emitted directly', () => {
    const obj = { emoji: '🚀', arabic: 'مرحبا', chinese: '你好', hindi: 'नमस्ते' };
    const result = canonicalize(obj);
    assert.strictEqual(result, '{"arabic":"مرحبا","chinese":"你好","emoji":"🚀","hindi":"नमस्ते"}');
});

// ---------------------------------------------------------------------------
// 5. REJECTION OF INVALID & UNSUPPORTED VALUES
// ---------------------------------------------------------------------------
console.log('\nGroup 5: Rejection of Invalid & Unsupported Values');

runTest('Rejects NaN with TypeError', () => {
    assert.throws(() => canonicalize(NaN), /NaN is not permitted/);
    assert.throws(() => canonicalize({ a: NaN }), /NaN is not permitted/);
    assert.throws(() => canonicalize([1, NaN, 3]), /NaN is not permitted/);
});

runTest('Rejects Infinity and -Infinity with TypeError', () => {
    assert.throws(() => canonicalize(Infinity), /Infinity is not permitted/);
    assert.throws(() => canonicalize(-Infinity), /Infinity is not permitted/);
    assert.throws(() => canonicalize({ num: Infinity }), /Infinity is not permitted/);
});

runTest('Rejects lone surrogates in strings (high surrogate without low)', () => {
    assert.throws(() => canonicalize({ bad: "prefix\uD800suffix" }), /Lone surrogate/);
});

runTest('Rejects lone surrogates in strings (low surrogate without high)', () => {
    assert.throws(() => canonicalize({ bad: "prefix\uDFFFsuffix" }), /Lone surrogate/);
});

runTest('Rejects BigInt with TypeError', () => {
    assert.throws(() => canonicalize(1234567890123456789n), /BigInt is not permitted/);
    assert.throws(() => canonicalize({ big: 42n }), /BigInt is not permitted/);
});

runTest('Rejects circular reference graphs', () => {
    const circular = { a: 1 };
    circular.self = circular;
    assert.throws(() => canonicalize(circular), /Circular reference detected/);
});

// ---------------------------------------------------------------------------
// 6. COMPLEX NESTING & toJSON UNWRAPPING
// ---------------------------------------------------------------------------
console.log('\nGroup 6: Deep Nesting, toJSON & Buffer Output');

runTest('Deeply nested structures without call-stack overflow', () => {
    let deep = { level: 0 };
    let current = deep;
    for (let i = 1; i <= 200; i++) {
        current.child = { level: i };
        current = current.child;
    }
    const result = canonicalize(deep);
    assert(result.startsWith('{"child":{'));
    assert(result.includes('"level":200'));
});

runTest('Objects with .toJSON() method are resolved and sorted', () => {
    const obj = {
        date: new Date('2026-10-03T11:00:00.000Z'),
        custom: {
            toJSON: () => ({ z: 1, a: 2 })
        }
    };
    const expected = '{"custom":{"a":2,"z":1},"date":"2026-10-03T11:00:00.000Z"}';
    assert.strictEqual(canonicalize(obj), expected);
});

runTest('canonicalizeToBuffer produces exact UTF-8 Buffer', () => {
    const obj = { hello: 'world', count: 42 };
    const buf = canonicalizeToBuffer(obj);
    assert(Buffer.isBuffer(buf));
    assert.strictEqual(buf.toString('utf8'), '{"count":42,"hello":"world"}');
});

runTest('Repeated canonicalization is 100% deterministic and idempotent', () => {
    const complexObj = {
        z: [3, 2, 1],
        a: { b: 2, a: 1 },
        tags: ["hrm", "license", "kiaan"],
        active: true,
        meta: null
    };

    const run1 = canonicalize(complexObj);
    const run2 = canonicalize(complexObj);
    const run3 = canonicalize(JSON.parse(run1));

    assert.strictEqual(run1, run2);
    assert.strictEqual(run2, run3);
});

console.log('\n======================================================');
console.log(`  ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('======================================================\n');
