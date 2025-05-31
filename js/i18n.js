// js/i18n.js

let currentLanguage = 'en'; // Default language
let translations = {}; // To store loaded translations

const supportedLanguages = ['en', 'fa'];
const langToggleButton = document.getElementById('language-toggle-button');
const currentLangDisplay = document.getElementById('current-lang-display');


/**
 * Loads translation file for the given language.
 * @param {string} lang - The language code (e.g., 'en', 'fa').
 * @returns {Promise<void>}
 */
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load translations for ${lang}: ${response.statusText}`);
        }
        translations[lang] = await response.json();
        console.log(`${lang.toUpperCase()} translations loaded.`);
    } catch (error) {
        console.error(error);
        // Fallback or error handling if a translation file is missing
        if (lang !== 'en') { // Try loading English as a fallback if not already English
            await loadTranslations('en');
        }
    }
}

/**
 * Translates a key using the loaded translations for the current language.
 * @param {string} key - The translation key (e.g., "pageTitle", "positionCard.symbol").
 * @param {Object} [vars={}] - Optional variables for placeholder replacement.
 * @returns {string} The translated string or the key itself if not found.
 */
function translate(key, vars = {}) {
    let langSet = translations[currentLanguage] || translations['en']; // Fallback to English
    if (!langSet) return key; // No translations loaded at all

    let text = key.split('.').reduce((obj, i) => (obj ? obj[i] : null), langSet);

    if (text) {
        for (const [varKey, varValue] of Object.entries(vars)) {
            text = text.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue);
        }
        return text;
    }
    console.warn(`Translation key not found for lang '${currentLanguage}': ${key}`);
    return key; // Return the key itself if not found
}


/**
 * Applies translations to all elements with data-i18n-key attribute.
 */
function applyTranslationsToPage() {
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        const translatedText = translate(key);

        // Handle different ways to set text based on element type
        if (element.tagName === 'INPUT' && element.type === 'placeholder') {
            element.placeholder = translatedText;
        } else if (element.tagName === 'TITLE') {
            document.title = translatedText;
        }
        else {
            element.textContent = translatedText;
        }
    });

    // Update HTML lang attribute and body class for direction
    document.documentElement.lang = currentLanguage;
    document.body.classList.remove('fa', 'en'); // Remove previous lang classes
    document.body.classList.add(currentLanguage); // Add current lang class (e.g., 'fa' for RTL)
    if (currentLanguage === 'fa') {
        document.body.setAttribute('dir', 'rtl');
    } else {
        document.body.setAttribute('dir', 'ltr');
    }
    if(currentLangDisplay) currentLangDisplay.textContent = translate(`lang_${currentLanguage}`).toUpperCase();
}

/**
 * Sets the current language and updates the UI.
 * @param {string} lang - The language code to set.
 */
async function setLanguage(lang) {
    if (!supportedLanguages.includes(lang)) {
        console.warn(`Unsupported language: ${lang}. Defaulting to 'en'.`);
        lang = 'en';
    }
    currentLanguage = lang;
    if (!translations[lang]) {
        await loadTranslations(lang);
    }
    applyTranslationsToPage();
    localStorage.setItem('preferredLanguage', lang); // Save preference
    // Potentially re-render dynamic content if it's already on the page
    if (window.currentPositionsData) { // Check if ui.js exposed current data
        window.ui.displayPositions(window.currentPositionsData);
    }
}

/**
 * Initializes the internationalization system.
 * Loads the preferred or default language.
 */
async function initI18n() {
    const preferredLanguage = localStorage.getItem('preferredLanguage');
    const initialLang = supportedLanguages.includes(preferredLanguage) ? preferredLanguage : 'en';

    await loadTranslations(initialLang); // Load default/preferred language first
    currentLanguage = initialLang; // Set it after loading
    applyTranslationsToPage();

    if (langToggleButton) {
        langToggleButton.addEventListener('click', () => {
            const newLang = currentLanguage === 'en' ? 'fa' : 'en';
            setLanguage(newLang);
        });
    }
}
