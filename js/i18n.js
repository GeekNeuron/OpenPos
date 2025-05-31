
// js/i18n.js
/**
 * @file Internationalization module for language switching and translations.
 * @author GeekNeuron
 * @version 1.2.0
 */

/**
 * Stores the current language code (e.g., 'en', 'fa').
 * Exported to window for global access by other modules like ui.js for date/number formatting.
 * @type {string}
 */
window.currentLanguage = 'en'; // Default language, will be updated by initI18n

/**
 * Stores loaded translation objects.
 * @type {Object<string, Object>}
 */
let translations = {}; // Not exposed to window, managed internally

const supportedLanguages = ['en', 'fa'];
const langToggleButton = document.getElementById('language-toggle-button');
const currentLangDisplay = document.getElementById('current-lang-display');

/**
 * Loads translation file for the given language.
 * @async
 * @param {string} lang - The language code (e.g., 'en', 'fa').
 * @returns {Promise<void>} Resolves when translations are loaded or rejects on error.
 */
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json?v=1.1`); // Added cache busting query param
        if (!response.ok) {
            throw new Error(`Failed to load translations for ${lang}: ${response.status} ${response.statusText}`);
        }
        translations[lang] = await response.json();
        console.log(`${lang.toUpperCase()} translations loaded.`);
    } catch (error) {
        console.error(error);
        // Fallback or error handling if a translation file is missing
        if (lang !== 'en' && !translations['en']) { // Try loading English as a fallback if not already English or EN not loaded
            console.warn(`Attempting to load English translations as fallback for ${lang}.`);
            await loadTranslations('en');
        } else if (!translations['en'] && lang === 'en') {
            console.error("Critical: Failed to load base English translations.");
            translations['en'] = {}; // Ensure en exists to prevent errors, even if empty
        }
    }
}

/**
 * Translates a key using the loaded translations for the current language.
 * Accesses global `window.currentLanguage` and internal `translations`.
 * @param {string} key - The translation key (e.g., "pageTitle", "positionCard.symbol").
 * @param {Object<string, string|number>} [vars={}] - Optional variables for placeholder replacement (e.g., {{name}}).
 * @returns {string} The translated string, or the key itself if not found or if English fallback also fails.
 */
function translate(key, vars = {}) {
    let langSet = translations[window.currentLanguage] || translations['en'];

    if (!langSet) { // If even English isn't loaded (critical failure)
        console.warn(`No translations loaded for current language '${window.currentLanguage}' or English fallback for key: ${key}`);
        return key; // Return the key itself
    }

    let text = key.split('.').reduce((obj, i) => (obj && typeof obj === 'object' ? obj[i] : undefined), langSet);

    // If text not found in current language, try English fallback
    if (text === undefined && window.currentLanguage !== 'en' && translations['en']) {
        // console.warn(`Key '${key}' not found in '${window.currentLanguage}', trying English fallback.`);
        langSet = translations['en'];
        text = key.split('.').reduce((obj, i) => (obj && typeof obj === 'object' ? obj[i] : undefined), langSet);
    }

    if (text !== undefined && typeof text === 'string') {
        for (const [varKey, varValue] of Object.entries(vars)) {
            text = text.replace(new RegExp(`{{${varKey}}}`, 'g'), String(varValue));
        }
        return text;
    }

    console.warn(`Translation key not found for lang '${window.currentLanguage}' (and EN fallback if different): ${key}`);
    return key; // Return the key itself if not found
}
// Export to global scope for validator.js and other modules if they don't import it directly
window.translate = translate;

/**
 * Applies translations to all elements with `data-i18n-key` or `data-i18n-placeholder` attributes.
 * Also updates document language, direction, and specific elements like the page title.
 */
function applyTranslationsToPage() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        element.textContent = translate(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = translate(key);
    });

    // Specific elements
    const pageTitleElement = document.querySelector('title[data-i18n-key]');
    if (pageTitleElement) {
        document.title = translate(pageTitleElement.getAttribute('data-i18n-key'));
    }


    // Update HTML lang attribute and body class/dir for text direction
    document.documentElement.lang = window.currentLanguage;
    document.body.classList.remove('fa', 'en'); // Remove previous lang classes
    document.body.classList.add(window.currentLanguage); // Add current lang class (e.g., 'fa' for RTL)

    if (window.currentLanguage === 'fa') {
        document.body.setAttribute('dir', 'rtl');
    } else {
        document.body.setAttribute('dir', 'ltr');
    }

    if(currentLangDisplay) {
        currentLangDisplay.textContent = translate(`lang_${window.currentLanguage}`).toUpperCase();
    }
    // Translate filter dropdown options (static text content)
    document.querySelectorAll('#type-filter option, #sort-by option').forEach(option => {
        const key = option.getAttribute('data-i18n-key');
        if (key) {
            option.textContent = translate(key);
        }
    });
}

/**
 * Sets the current language, loads translations if needed, and updates the UI.
 * @async
 * @param {string} lang - The language code to set (e.g., 'en', 'fa').
 */
async function setLanguage(lang) {
    if (!supportedLanguages.includes(lang)) {
        console.warn(`Unsupported language: ${lang}. Defaulting to 'en'.`);
        lang = 'en';
    }
    window.currentLanguage = lang; // Update global immediately

    if (!translations[lang]) { // Load only if not already loaded
        await loadTranslations(lang);
    }

    applyTranslationsToPage(); // Apply to static text

    // Re-render dynamic content that might depend on language (e.g., dates, numbers in cards)
    if (window.ui && typeof window.ui.applyFilterAndRender === 'function' && window.currentPositionsData) {
        window.ui.applyFilterAndRender(); // This will re-render positions using the new language for formatting
    }
    localStorage.setItem('preferredLanguage', lang); // Save preference
}

/**
 * Initializes the internationalization system.
 * Loads the preferred or default language and applies translations.
 * @async
 */
async function initI18n() {
    const preferredLanguage = localStorage.getItem('preferredLanguage');
    const initialLang = supportedLanguages.includes(preferredLanguage) ? preferredLanguage : 'en';
    window.currentLanguage = initialLang; // Set global currentLanguage here

    // Ensure English is always loaded first or as a fallback if preferred lang fails
    if (initialLang !== 'en' && !translations['en']) {
        await loadTranslations('en');
    }
    if (!translations[initialLang]) { // Load preferred language if not English and not yet loaded
        await loadTranslations(initialLang);
    }
    if (!translations['en']) { // Absolute fallback if English still not loaded (e.g. initialLang was 'en' and failed)
        await loadTranslations('en');
    }


    applyTranslationsToPage();

    if (langToggleButton) {
        langToggleButton.addEventListener('click', () => {
            const newLang = window.currentLanguage === 'en' ? 'fa' : 'en';
            setLanguage(newLang);
        });
    }
}
