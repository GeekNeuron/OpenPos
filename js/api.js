// js/api.js

/**
 * Fetches open positions data from the specified API URL.
 * @async
 * @param {string} apiUrl - The full API endpoint URL.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of position objects.
 * Rejects with an error if fetching fails.
 */
async function fetchOpenPositions(apiUrl) {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            // Try to get more specific error message from response if available
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                // Ignore if response is not JSON
            }
            const errorMessage = errorData?.message || response.statusText;
            throw new Error(`API Error: ${response.status} ${errorMessage}`);
        }
        const data = await response.json();
        // Assuming the API returns an array of positions directly.
        // If positions are nested, e.g., data.positions, adjust accordingly in app.js
        return data;
    } catch (error) {
        console.error('Error in fetchOpenPositions:', error);
        throw error; // Re-throw to be handled by the caller (app.js)
    }
}

// Example: If your API requires an API Key in the header:
/*
async function fetchOpenPositionsWithApiKey(apiUrl, apiKey) {
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}` // Or 'X-API-KEY': apiKey, etc.
            }
        });
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {}
            const errorMessage = errorData?.message || response.statusText;
            throw new Error(`API Error: ${response.status} ${errorMessage}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in fetchOpenPositionsWithApiKey:', error);
        throw error;
    }
}
*/
