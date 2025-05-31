// js/app.js
/**
 * @file Main application logic for OpenPos.
 * Initializes the application, including theme, internationalization, and UI settings.
 * Fetches position data from the API, validates it, and coordinates with the UI module
 * to display the data. Also handles Service Worker registration and updates.
 * @author GeekNeuron
 * @version 1.3.0
 */

/**
 * The API endpoint URL for fetching open positions.
 * !!! IMPORTANT: Replace this with your actual API endpoint.
 * @type {string}
 * @constant
 */
const API_URL = 'YOUR_API_ENDPOINT_HERE'; // مثال: 'https://api.coingecko.com/api/v3/derivatives/exchanges/binance_futures?include_tickers=unexpired';
// const API_URL = 'sample_data.json'; // برای تست محلی

/**
 * Main application function. Orchestrates initialization and data fetching.
 * @async
 * @function mainApp
 */
async function mainApp() {
    initTheme();
    await initI18n(); // Must be awaited for translations to be ready

    if (window.ui && typeof window.ui.loadAndApplyUiSettings === 'function') {
        window.ui.loadAndApplyUiSettings();
    }

    window.ui.setLoading(true);
    let rawPositions = [];

    try {
        // Fetch positions with retry logic
        rawPositions = await fetchOpenPositions(API_URL, 3, 2500); // 3 retries, 2.5s delay

        // Validate the structure of each position object
        const { validatedPositions, errors: validationErrors } = validatePositionsArray(rawPositions); // from validator.js

        if (validationErrors.length > 0) {
            console.warn('Validation Issues Encountered:', validationErrors.join('\n'));
            if (validatedPositions.length > 0) { // If some data is still good, show a non-critical toast
                window.ui.showToast('somePositionsInvalid', 'warning', 4000);
            }
        }

        // Decide what to display
        if (validatedPositions.length === 0) { // No valid positions to show
            if (rawPositions.length > 0) { // Data was fetched, but none of it was valid
                window.ui.displayError('noPositionsAfterValidation', validationErrors.join('\n'));
            } else { // API returned empty or fetch failed completely before validation
                window.ui.displayPositions([]); // ui.js will show "no positions" message
            }
        } else {
            window.ui.displayPositions(validatedPositions);
        }

    } catch (error) {
        console.error('Main application error (after retries, if any):', error);
        let errorMessageKey = 'errorMessageDefault';
        let errorDetail = error.message;

        if (error.isClientError) {
            errorDetail = error.message.substring('API Client Error: '.length);
            if (error.message.includes('401') || error.message.includes('403')) errorMessageKey = 'errorUnauthorized';
            else if (error.message.includes('404')) errorMessageKey = 'errorNotFound';
            else errorMessageKey = 'errorClientGeneric';
        } else if (error.message.includes('Invalid API response format')) {
            errorMessageKey = 'errorInvalidResponse';
        } else if (error.message.startsWith('Server Error:')) {
            errorMessageKey = 'errorServerGeneric';
            errorDetail = error.message.substring('Server Error: '.length);
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('AbortError')) {
            errorMessageKey = 'errorFailedToFetch';
        }
        window.ui.displayError(errorMessageKey, errorDetail);
    } finally {
        window.ui.setLoading(false);
    }
}

document.addEventListener('DOMContentLoaded', mainApp);

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully with scope:', registration.scope);
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker == null) return;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New SW content is available. Showing update toast.');
                                window.ui.showToast(
                                    'swUpdateAvailableToast',
                                    'info',
                                    0, // Stays until action
                                    {
                                        textKey: 'swUpdateButton',
                                        callback: () => {
                                            // The new SW should have called skipWaiting() in its install event
                                            // and clients.claim() in its activate event.
                                            // So, a reload should be enough for the new SW to take control.
                                            window.location.reload();
                                        }
                                    }
                                );
                            } else {
                                console.log('Content is cached for offline use.');
                                window.ui.showToast('swContentCached', 'success', 3000);
                            }
                        }
                    };
                };
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });

    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        console.log('Controller changed. Reloading page...');
        window.location.reload();
        refreshing = true;
    });
}
