// js/api.js
/**
 * @file API communication module for fetching open positions.
 * Includes retry mechanism for network requests.
 * @author GeekNeuron
 * @version 1.1.0
 */

/**
 * Represents a single open position.
 * @typedef {Object} Position
 * @property {string} symbol - Trading symbol (e.g., "BTCUSDT").
 * @property {string} type - Position type ("long", "short", "buy", "sell").
 * @property {number} entryPrice - The price at which the position was entered.
 * @property {number} amount - The size of the position.
 * @property {string} [baseAsset] - The base asset (e.g., "BTC").
 * @property {string} [quoteAsset] - The quote asset (e.g., "USDT").
 * @property {number} [leverage] - Leverage used for the position.
 * @property {number} [pnl] - Profit and Loss for the position.
 * @property {string} [user] - Identifier for the user who opened the position.
 * @property {number} [timestamp] - Timestamp of when the position was opened (Unix ms).
 */

/**
 * Fetches open positions data with a retry mechanism.
 * @async
 * @function fetchOpenPositions
 * @param {string} apiUrl - The full API endpoint URL.
 * @param {number} [maxRetries=3] - Maximum number of retry attempts.
 * @param {number} [retryDelayMs=2000] - Delay in milliseconds between retries.
 * @returns {Promise<Array<Position>>} - A promise that resolves to an array of position objects.
 * @throws {Error} If the API request fails after all retries or if the response is malformed or a client error (4xx) occurs.
 */
async function fetchOpenPositions(apiUrl, maxRetries = 3, retryDelayMs = 2000) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            console.log(`Attempt ${attempts + 1} to fetch from ${apiUrl}`);
            const response = await fetch(apiUrl, {
                signal: AbortSignal.timeout(10000) // 10 second timeout for each request
            });

            if (!response.ok) {
                if (response.status >= 500 && response.status <= 599) { // Server errors
                    throw new Error(`Server Error: ${response.status} ${response.statusText}`);
                } else { // Client errors (4xx) or other non-server errors
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { /* ignore if not json */ }
                    const clientErrorMessage = errorData?.message || response.statusText || `Client Error ${response.status}`;
                    const clientError = new Error(`API Client Error: ${response.status} ${clientErrorMessage}`);
                    clientError.isClientError = true; // Flag for app.js to not retry or show generic retry message
                    throw clientError; // Stop retrying for client errors
                }
            }

            const data = await response.json();
            // Basic validation already done in validator.js, but an initial array check is good.
            if (!Array.isArray(data)) {
                console.error('API response is not an array:', data);
                // This error will be caught by the outer try-catch in app.js if it's the first attempt,
                // or by this function's catch block if it's a retry attempt.
                throw new Error('Invalid API response format: Expected an array of positions.');
            }
            console.log(`Successfully fetched data from ${apiUrl}`);
            return data; // Success, exit loop

        } catch (error) {
            attempts++;
            console.warn(`Attempt ${attempts} of ${maxRetries} failed for ${apiUrl}: ${error.message}`);

            if (error.isClientError) {
                console.error('Client error, not retrying:', error.message);
                throw error; // Re-throw to be handled by app.js immediately
            }

            if (attempts >= maxRetries) {
                console.error(`All ${maxRetries} retry attempts failed for ${apiUrl}.`);
                // Add more context to the final error
                const finalError = new Error(`Failed to fetch data from ${apiUrl} after ${maxRetries} attempts. Last error: ${error.message}`);
                finalError.cause = error; // Preserve original error cause
                throw finalError;
            }

            // Notify user about retry attempt via toast (optional)
            if (typeof window !== 'undefined' && window.ui && typeof window.ui.showToast === 'function' && typeof translate === 'function') {
                window.ui.showToast(
                    translate('apiRetrying', { attempt: attempts + 1, max: maxRetries }),
                    'warning',
                    retryDelayMs - 200 // Show toast slightly less than delay
                );
            }
            console.log(`Waiting ${retryDelayMs}ms before next retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }
    // Should not be reached if logic is correct, but as a fallback:
    throw new Error(`Exhausted retries for ${apiUrl} - unexpected state.`);
}
