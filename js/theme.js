// js/theme.js

const themeToggleButton = document.getElementById('theme-toggle-button');
const bodyElement = document.body;
const sunIcon = document.querySelector('#theme-toggle-button .theme-icon-light');
const moonIcon = document.querySelector('#theme-toggle-button .theme-icon-dark');

/**
 * Applies the specified theme.
 * @param {string} theme - The theme to apply ('light-theme' or 'dark-theme').
 */
function applyTheme(theme) {
    bodyElement.classList.remove('light-theme', 'dark-theme');
    bodyElement.classList.add(theme);

    if (theme === 'dark-theme') {
        if(moonIcon) moonIcon.style.display = 'none';
        if(sunIcon) sunIcon.style.display = 'block';
    } else {
        if(moonIcon) moonIcon.style.display = 'block';
        if(sunIcon) sunIcon.style.display = 'none';
    }
    localStorage.setItem('preferredTheme', theme);
}

/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
    const currentTheme = bodyElement.classList.contains('dark-theme') ? 'dark-theme' : 'light-theme';
    const newTheme = currentTheme === 'dark-theme' ? 'light-theme' : 'dark-theme';
    applyTheme(newTheme);
}

/**
 * Initializes the theme based on user preference or system preference.
 */
function initTheme() {
    let preferredTheme = localStorage.getItem('preferredTheme');

    if (!preferredTheme) {
        // Optional: Check for system preference if no local storage setting
        // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        //     preferredTheme = 'dark-theme';
        // } else {
        //     preferredTheme = 'light-theme';
        // }
        preferredTheme = 'light-theme'; // Default to light if no preference
    }

    applyTheme(preferredTheme);

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    }
}
