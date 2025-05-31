// tests/validator.test.js

// This test file assumes that the functions `validatePositionObject` and `validatePositionsArray`
// are exposed globally (e.g., on window) OR that you are using a test runner like Jest
// with a module system (e.g., ES Modules or CommonJS) where you can import them.

// For Jest with ES Modules, you would have:
// import { validatePositionObject, validatePositionsArray } from '../js/validator.js';
// And in validator.js, you'd export these functions:
// export { validatePositionObject, validatePositionsArray };

// --- Mocking window.translate for tests if validator.js relies on it globally ---
const mockTranslate = (key, vars = {}) => {
    let message = String(key); // Ensure key is a string
    for (const k in vars) {
        message = message.replace(new RegExp(`{{${k}}}`, 'g'), String(vars[k]));
    }
    return message;
};
// If validator.js uses window.translate, ensure it's set before tests.
// This is a simplified approach. Jest provides robust mocking (jest.mock, jest.spyOn).
if (typeof window !== 'undefined') {
    window.translate = mockTranslate;
} else {
    global.translate = mockTranslate; // For Node.js like environment (Jest)
}


// Assuming validator.js functions are accessible globally for this demo, e.g.
// window.validatePositionObject and window.validatePositionsArray are set from validator.js
const { validatePositionObject, validatePositionsArray } = (typeof window !== 'undefined' && window.validatePositionObject) ? window : require('../js/validator.js'); // Fallback for Node if directly running, adjust path as needed


describe('validatePositionObject', () => {
    const validPosition = {
        symbol: 'BTCUSDT', type: 'long', entryPrice: 50000, amount: 1, timestamp: Date.now()
    };

    test('should return isValid: true for a valid position object', () => {
        const result = validatePositionObject(validPosition);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    test('should return isValid: false if required "symbol" is missing', () => {
        const position = { ...validPosition, symbol: undefined };
        const result = validatePositionObject(position);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('symbol') && e.includes('required'))).toBe(true);
    });

    test('should return isValid: false if "entryPrice" has incorrect type (string)', () => {
        const position = { ...validPosition, entryPrice: 'not-a-number' };
        const result = validatePositionObject(position);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('entryPrice') && e.includes('invalid type') && e.includes('number') && e.includes('string'))).toBe(true);
    });

     test('should return isValid: false for unrecognized position "type"', () => {
        const position = { ...validPosition, type: 'unknown_type' };
        const result = validatePositionObject(position);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('type') && e.includes('invalid value') && e.includes('unknown_type'))).toBe(true);
    });

    test('should return true for valid enum "type" like "buy" or "sell"', () => {
        const positionBuy = { ...validPosition, type: 'buy' };
        const resultBuy = validatePositionObject(positionBuy);
        expect(resultBuy.isValid).toBe(true);

        const positionSell = { ...validPosition, type: 'sell' };
        const resultSell = validatePositionObject(positionSell);
        expect(resultSell.isValid).toBe(true);
    });

    test('should return isValid: false if position is not an object (null)', () => {
        const result = validatePositionObject(null);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('not a valid object'))).toBe(true);
    });

     test('should return isValid: false if required field is an empty string', () => {
        const position = { ...validPosition, symbol: '' };
        const result = validatePositionObject(position);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('symbol') && e.includes('required'))).toBe(true);
    });
});

describe('validatePositionsArray', () => {
    const validPosition1 = { symbol: 'BTCUSDT', type: 'long', entryPrice: 50000, amount: 1 };
    const validPosition2 = { symbol: 'ETHUSDT', type: 'short', entryPrice: 3000, amount: 10 };
    const invalidPositionNoPrice = { symbol: 'ADAUSDT', type: 'long', amount: 100 }; // Missing entryPrice
    const invalidPositionWrongType = { symbol: 'SOLUSDT', type: 'superlong', entryPrice: 100, amount: 10 };


    test('should return isValid: true and all positions for an array of valid positions', () => {
        const positions = [validPosition1, validPosition2];
        const result = validatePositionsArray(positions);
        expect(result.isValid).toBe(true); // Overall structure is valid (it's an array)
        expect(result.validatedPositions.length).toBe(2);
        expect(result.errors.length).toBe(0);
    });

    test('should return validated positions and errors for a mixed array of valid and invalid positions', () => {
        const positions = [validPosition1, invalidPositionNoPrice, validPosition2, invalidPositionWrongType];
        const result = validatePositionsArray(positions);
        expect(result.isValid).toBe(true); // Structure is an array
        expect(result.validatedPositions.length).toBe(2); // Only validPosition1 and validPosition2
        expect(result.validatedPositions.find(p=>p.symbol === 'BTCUSDT')).toEqual(validPosition1);
        expect(result.validatedPositions.find(p=>p.symbol === 'ETHUSDT')).toEqual(validPosition2);
        expect(result.errors.length).toBeGreaterThanOrEqual(2); // At least one error for each invalid position
        expect(result.errors.some(e => e.includes('ADAUSDT') && e.includes('entryPrice') && e.includes('required'))).toBe(true);
        expect(result.errors.some(e => e.includes('SOLUSDT') && e.includes('type') && e.includes('invalid value'))).toBe(true);
    });

    test('should return empty validatedPositions and errors if all positions in array are invalid', () => {
        const positions = [invalidPositionNoPrice, invalidPositionWrongType];
        const result = validatePositionsArray(positions);
        expect(result.isValid).toBe(true); // Structure is an array
        expect(result.validatedPositions.length).toBe(0);
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    test('should return isValid: false for a non-array input', () => {
        const result = validatePositionsArray({ some: 'object' });
        expect(result.isValid).toBe(false);
        expect(result.validatedPositions.length).toBe(0);
        expect(result.errors.some(e => e.includes('not an array'))).toBe(true);
    });

    test('should return isValid: true for an empty array with no errors', () => {
        const result = validatePositionsArray([]);
        expect(result.isValid).toBe(true);
        expect(result.validatedPositions.length).toBe(0);
        expect(result.errors.length).toBe(0);
    });
});

// --- Simple Jest Mock Implementation for running in browser (conceptual) ---
// This is a very basic mock and not a full Jest environment.
if (typeof describe === 'undefined') {
    let _testSuiteName = '';
    global.describe = (name, fn) => { _testSuiteName = name; console.group(name); fn(); console.groupEnd(); };
    global.test = (name, fn) => {
        try {
            fn();
            console.log(`  %cPASS%c: ${name}`, 'color: green; font-weight: bold;', 'color: inherit;');
        } catch (e) {
            console.error(`  %cFAIL%c: ${name}`, 'color: red; font-weight: bold;', 'color: inherit;', e);
        }
    };
    global.expect = (actual) => ({
        toBe: (expected) => { if (actual !== expected) throw new Error(`Expected: ${expected}, Received: ${actual}`); },
        toEqual: (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected: ${JSON.stringify(expected)}, Received: ${JSON.stringify(actual)}`); },
        toContain: (expected) => { if (!(actual && typeof actual.includes === 'function' && actual.includes(expected))) throw new Error(`Expected array/string to contain: ${expected}, Received: ${actual}`); },
        toBeGreaterThan: (expected) => { if (!(actual > expected)) throw new Error(`Expected ${actual} to be > ${expected}`); },
        toBeGreaterThanOrEqual: (expected) => { if (!(actual >= expected)) throw new Error(`Expected ${actual} to be >= ${expected}`); },
        toHaveLength: (expected) => { if (actual.length !== expected) throw new Error(`Expected length: ${expected}, Received length: ${actual.length}`); },
        toBeInstanceOf: (expected) => { if (!(actual instanceof expected)) throw new Error(`Expected instanceof ${expected.name || expected}, Received ${actual}`); },
        toBeUndefined: () => { if (actual !== undefined) throw new Error(`Expected undefined, Received ${actual}`); },
        toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, Received ${actual}`); },
        toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, Received ${actual}`); },
        toMatchObject: (expected) => { // Very basic implementation
            for (const key in expected) {
                if (!actual || JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) {
                    throw new Error(`Expected object to match: ${JSON.stringify(expected)}, but key '${key}' did not match in ${JSON.stringify(actual)}`);
                }
            }
        },
        // Add .some for array checks
        some: (predicate) => {
            if (!Array.isArray(actual) || !actual.some(predicate)) {
                throw new Error(`Expected array to have at least one element satisfying the predicate. Received: ${JSON.stringify(actual)}`);
            }
        }
    });
    global.beforeEach = (fn) => { /* In this mock, beforeEach/All isn't fully implemented, call manually if needed or structure tests accordingly */ };
    global.afterEach = (fn) => { /* As above */ };
    global.beforeAll = (fn) => { fn(); }; // Run immediately
    global.afterAll = (fn) => { /* As above */ };
}
