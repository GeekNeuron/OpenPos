// js/ui.js
// Expose a global object for ui functions if needed by i18n or other modules
window.ui = {};

const positionsGridElement = document.getElementById('positions-grid');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const errorMessageElement = document.getElementById('error-message');
const noPositionsMessageElement = document.getElementById('no-positions-message');

/**
 * Sets the loading state in the UI.
 * @param {boolean} isLoading - True to show loading, false to hide.
 */
window.ui.setLoading = function(isLoading) {
    if (isLoading) {
        loadingIndicatorElement.style.display = 'flex';
        positionsGridElement.style.display = 'none';
        errorMessageElement.style.display = 'none';
        noPositionsMessageElement.style.display = 'none';
    } else {
        loadingIndicatorElement.style.display = 'none';
        // The display of grid or no-positions message is handled by displayPositions
    }
};

/**
 * Displays an error message in the UI.
 * @param {string} messageKey - The translation key for the error message.
 * @param {string} [fallbackMessage='An error occurred.'] - Fallback message if key not found.
 */
window.ui.displayError = function(messageKey, fallbackMessage = 'An error occurred.') {
    const message = translate(messageKey, { fallback: fallbackMessage });
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = 'block';
    loadingIndicatorElement.style.display = 'none';
    positionsGridElement.style.display = 'none';
    noPositionsMessageElement.style.display = 'none';
};

/**
 * Displays the fetched positions as cards in the UI.
 * @param {Array<Object>} positions - An array of position objects.
 * Expected position object structure:
 * {
 * symbol: "BTCUSDT",      // (string) Trading symbol
 * type: "long" or "short",// (string) Position type
 * entryPrice: 50000,      // (number) Entry price
 * amount: 0.5,            // (number) Position size
 * baseAsset: "BTC",       // (string, optional) e.g., BTC, ETH
 * quoteAsset: "USDT",     // (string, optional) e.g., USDT, USD
 * leverage: 10,           // (number, optional) Leverage used
 * pnl: 150.50,            // (number, optional) Profit and Loss
 * user: "GeekNeuron",     // (string, optional) User identifier
 * timestamp: 1678886400000 // (number, optional) Timestamp of position opening
 * }
 */
window.ui.displayPositions = function(positions) {
    positionsGridElement.innerHTML = ''; // Clear previous positions

    if (!positions || positions.length === 0) {
        noPositionsMessageElement.style.display = 'block';
        positionsGridElement.style.display = 'none';
        return;
    }

    noPositionsMessageElement.style.display = 'none';
    positionsGridElement.style.display = 'grid';

    positions.forEach(position => {
        const card = document.createElement('div');
        card.className = 'position-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';

        const symbolElement = document.createElement('span');
        symbolElement.className = 'symbol';
        symbolElement.textContent = position.symbol || translate('positionCard.na');
        cardHeader.appendChild(symbolElement);

        const typeElement = document.createElement('span');
        let positionTypeClass = 'unknown';
        let positionTypeTextKey = 'positionCard.unknown';
        if (position.type) {
            if (position.type.toLowerCase() === 'long') {
                positionTypeClass = 'long';
                positionTypeTextKey = 'positionCard.long';
            } else if (position.type.toLowerCase() === 'short') {
                positionTypeClass = 'short';
                positionTypeTextKey = 'positionCard.short';
            }
        }
        typeElement.className = `type ${positionTypeClass}`;
        typeElement.textContent = translate(positionTypeTextKey);
        cardHeader.appendChild(typeElement);
        card.appendChild(cardHeader);

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';

        const createInfoParagraph = (labelKey, value, unit = '', toLocale = true) => {
            const p = document.createElement('p');
            const label = translate(labelKey) || labelKey.split('.').pop();
            let displayValue = translate('positionCard.na');
            if (value !== undefined && value !== null) {
                displayValue = toLocale && typeof value === 'number' ? value.toLocaleString(currentLanguage === 'fa' ? 'fa-IR' : 'en-US') : value;
            }
            p.innerHTML = `<strong>${label}:</strong> ${displayValue} ${unit}`;
            return p;
        };

        cardContent.appendChild(createInfoParagraph('positionCard.entryPrice', position.entryPrice, position.quoteAsset || '', true));
        cardContent.appendChild(createInfoParagraph('positionCard.amount', position.amount, position.baseAsset || '', true));

        if (position.leverage !== undefined) {
            cardContent.appendChild(createInfoParagraph('positionCard.leverage', position.leverage, 'x', true));
        }
        if (position.pnl !== undefined) {
            const pnlPara = createInfoParagraph('positionCard.pnl', position.pnl, position.quoteAsset || '', true);
            pnlPara.classList.add(position.pnl >= 0 ? 'pnl-positive' : 'pnl-negative');
            cardContent.appendChild(pnlPara);
        }
        if (position.timestamp) {
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedTime = new Date(position.timestamp).toLocaleString(currentLanguage === 'fa' ? 'fa-IR' : 'en-US', dateOptions);
            cardContent.appendChild(createInfoParagraph('positionCard.timestamp', formattedTime, '', false));
        }
        card.appendChild(cardContent);

        if (position.user) {
            const userElement = document.createElement('div');
            userElement.className = 'user-info';
            userElement.textContent = `${translate('positionCard.user')}: ${position.user}`;
            card.appendChild(userElement);
        }
        positionsGridElement.appendChild(card);
    });
     // Store current data globally for potential re-renders on language change
    window.currentPositionsData = positions;
};
