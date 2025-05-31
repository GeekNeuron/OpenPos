// tests/i18n.test.js

// Assumes i18n.js has exposed:
// window.translate
// window.translations (can be mocked/set)
// window.currentLanguage (can be mocked/set)
// For Jest with ES Modules: import { translate, /* other needed exports/mocks */ } from '../js/i18n.js';

describe('translate function in i18n', () => {
    let originalTranslations;
    let originalCurrentLanguage;
    let translateFunc; // Will point to window.translate

    beforeAll(() => {
        // If i18n.js is a script tag, window.translate should exist.
        // For Jest, you'd import it.
        translateFunc = window.translate;
        if (typeof translateFunc !== 'function') {
            console.warn("window.translate is not defined. Tests might fail. Ensure i18n.js is loaded and exports it.");
            // Fallback for a simple test environment without proper loading order
            translateFunc = (key) => key;
        }
    });

    beforeEach(() => {
        originalTranslations = JSON.parse(JSON.stringify(window.translations || {}));
        originalCurrentLanguage = window.currentLanguage;

        window.translations = {
            en: {
                greeting: 'Hello',
                greetingWithName: 'Hello {{name}}!',
                complex: { message: 'This is a nested {{value}}.' },
                fallbackTest: 'English Fallback',
                onlyInEnglish: 'This is only in English'
            },
            fa: {
                greeting: 'سلام',
                greetingWithName: 'سلام {{name}}!',
                complex: { message: 'این یک {{value}} تو در تو است.' }
            },
            // de: {} // German intentionally left sparse for fallback tests
        };
    });

    afterEach(() => {
        window.translations = originalTranslations;
        window.currentLanguage = originalCurrentLanguage;
    });

    test('should translate a simple key for EN', () => {
        window.currentLanguage = 'en';
        expect(translateFunc('greeting')).toBe('Hello');
    });

    test('should translate a simple key for FA', () => {
        window.currentLanguage = 'fa';
        expect(translateFunc('greeting')).toBe('سلام');
    });

    test('should translate with placeholder (EN)', () => {
        window.currentLanguage = 'en';
        expect(translateFunc('greetingWithName', { name: 'World' })).toBe('Hello World!');
    });

    test('should translate with placeholder (FA)', () => {
        window.currentLanguage = 'fa';
        expect(translateFunc('greetingWithName', { name: 'دنیا' })).toBe('سلام دنیا!');
    });

    test('should translate nested key (EN)', () => {
        window.currentLanguage = 'en';
        expect(translateFunc('complex.message', { value: 'message' })).toBe('This is a nested message.');
    });

    test('should return key if not found (EN)', () => {
        window.currentLanguage = 'en';
        expect(translateFunc('nonExistentKey')).toBe('nonExistentKey');
    });

    test('should return key if nested part not found (EN)', () => {
        window.currentLanguage = 'en';
        expect(translateFunc('complex.nonExistent')).toBe('complex.nonExistent');
    });

    test('should fallback to English if key not in current language (FA -> EN)', () => {
        window.currentLanguage = 'fa';
        expect(translateFunc('onlyInEnglish')).toBe('This is only in English');
    });

    test('should fallback to English if current language (e.g., DE) has no translations for the key', () => {
        window.currentLanguage = 'de'; // German has no 'fallbackTest' key
        window.translations.de = { someOtherKey: "Hallo" }; // Ensure 'de' lang object exists
        expect(translateFunc('fallbackTest')).toBe('English Fallback');
    });

     test('should return key if not found in current language (DE) and not in English fallback', () => {
        window.currentLanguage = 'de';
        window.translations.de = {};
        expect(translateFunc('completelyMissingKeyEverywhere')).toBe('completelyMissingKeyEverywhere');
    });

    test('should handle uninitialized/empty current language translations by falling back to EN', () => {
        window.currentLanguage = 'fr'; // French not defined in mock translations
        expect(translateFunc('greeting')).toBe('Hello');
    });

    test('should return key if all translations are empty', () => {
        window.translations = {};
        window.currentLanguage = 'en';
        expect(translateFunc('greeting')).toBe('greeting');
    });
});
