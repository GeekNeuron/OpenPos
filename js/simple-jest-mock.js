// js/simple-jest-mock.js
// A very basic mock of Jest's interface to allow conceptual tests to run in a browser.
// Not a full Jest environment. For real testing, use Jest.

(function() {
    if (typeof describe !== 'undefined') return; // Don't redefine if a real framework is present

    let currentSuiteName = '';
    let testCounts = { total: 0, passed: 0, failed: 0 };

    console.log("%cSimple Test Runner Initialized", "color: blue; font-size: 1.2em;");

    function outputResult(passed, name, errorMessage = '', errorStack = '') {
        if (passed) {
            console.log(`  %c✓ PASS%c ${name}`, 'color: green; font-weight:bold;', 'color: inherit;');
            testCounts.passed++;
        } else {
            console.error(`  %c✗ FAIL%c ${name}`, 'color: red; font-weight:bold;', 'color: inherit;');
            if (errorMessage) console.error(`     Error: ${errorMessage}`);
            if (errorStack) console.error(`     Stack: ${errorStack.split('\n').slice(1).join('\n')}`); // Basic stack formatting
            testCounts.failed++;
        }
    }

    globalThis.describe = (name, fn) => {
        currentSuiteName = name;
        console.groupCollapsed(`%cSUITE: ${name}`, "color: #666; font-weight: bold;");
        testCounts.total = 0; testCounts.passed = 0; testCounts.failed = 0;
        fn();
        console.log(`%cSuite Summary: ${testCounts.passed} passed, ${testCounts.failed} failed, ${testCounts.total} total.`,
            testCounts.failed > 0 ? "color: red;" : "color: green;");
        console.groupEnd();
        currentSuiteName = '';
    };

    globalThis.test = (name, fn) => {
        testCounts.total++;
        try {
            fn();
            outputResult(true, name);
        } catch (e) {
            outputResult(false, name, e.message, e.stack);
        }
    };
    globalThis.it = globalThis.test; // Alias 'it' to 'test'

    globalThis.expect = (actual) => {
        const DOMElementsToString = (el) => el instanceof HTMLElement ? el.outerHTML.slice(0, 100) + '...' : el; // Prevent huge logs
        const actualStr = () => JSON.stringify(DOMElementsToString(actual));
        const expectedStr = (expected) => JSON.stringify(DOMElementsToString(expected));

        return {
            toBe: (expected) => { if (actual !== expected) throw new Error(`Expected: ${expectedStr(expected)}, Received: ${actualStr()}`); },
            toEqual: (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected (deep): ${expectedStr(expected)}, Received: ${actualStr()}`); },
            toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, Received: ${actualStr()}`); },
            toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, Received: ${actualStr()}`); },
            toBeNull: () => { if (actual !== null) throw new Error(`Expected null, Received: ${actualStr()}`); },
            toBeUndefined: () => { if (actual !== undefined) throw new Error(`Expected undefined, Received: ${actualStr()}`); },
            toBeDefined: () => { if (actual === undefined) throw new Error(`Expected defined, Received: undefined`); },
            toBeNaN: () => { if (!Number.isNaN(actual)) throw new Error(`Expected NaN, Received: ${actualStr()}`); },
            toHaveLength: (length) => {
                if (actual == null || typeof actual.length !== 'number') throw new Error(`Expected object with length property, Received: ${actualStr()}`);
                if (actual.length !== length) throw new Error(`Expected length: ${length}, Received: ${actual.length}`);
            },
            toContain: (item) => {
                if (actual == null || typeof actual.includes !== 'function') throw new Error(`Expected object with an 'includes' method (Array or String), Received: ${actualStr()}`);
                if (!actual.includes(item)) throw new Error(`Expected ${actualStr()} to contain ${expectedStr(item)}`);
            },
            toMatch: (regex) => {
                if (actual == null || typeof actual.match !== 'function') throw new Error(`Expected string with a 'match' method, Received: ${actualStr()}`);
                if (!actual.match(regex)) throw new Error(`Expected ${actualStr()} to match ${regex}`);
            },
            toBeInstanceOf: (Class) => { if (!(actual instanceof Class)) throw new Error(`Expected instanceof ${Class.name || 'Class'}, Received: ${actualStr()}`); },
            toBeGreaterThan: (num) => { if (!(actual > num)) throw new Error(`Expected ${actualStr()} to be > ${num}`);},
            toBeLessThan: (num) => { if (!(actual < num)) throw new Error(`Expected ${actualStr()} to be < ${num}`);},
            // Basic array.some equivalent for expect
            toSatisfySome: (predicate) => {
                if (!Array.isArray(actual) || !actual.some(predicate)) {
                     throw new Error(`Expected array to have at least one element satisfying the predicate. Received: ${actualStr()}`);
                }
            },
            // Add more matchers as needed
        };
    };
    globalThis.beforeEach = (fn) => { /* Simple mock: call manually or structure tests for this */ fn(); };
    globalThis.afterEach = (fn) => { /* Simple mock */ };
    globalThis.beforeAll = (fn) => { fn(); }; // Runs immediately for the current suite
    globalThis.afterAll = (fn) => { /* Simple mock */ };

})();
