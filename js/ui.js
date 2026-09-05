// js/ui.js
/**
 * @file UI manipulation module for OpenPos.
 * Handles DOM interactions, rendering of positions, loading states, error messages,
 * toast notifications, filtering, sorting, lazy loading, and UI settings persistence.
 * @author GeekNeuron
 * @version 1.4.0
 */

/**
 * Formats a number with an adaptive decimal precision based on its magnitude,
 * so small-value assets (e.g. a token priced at 0.0000012) don't collapse to
 * "0" the way a flat toLocaleString() call would.
 * Approach adapted from freqtrade/frequi's formatDecimal() utility.
 * @param {number} value
 * @param {string} locale
 * @returns {string}
 */
function formatAdaptiveNumber(value, locale) {
    if (value === undefined || value === null || Number.isNaN(value)) return null;
    const absValue = Math.abs(value);
    let decimals = 2;
    if (absValue !== 0) {
        if (absValue < 0.0000001) decimals = 12;
        else if (absValue < 0.000001) decimals = 10;
        else if (absValue < 0.0001) decimals = 8;
        else if (absValue < 0.01) decimals = 6;
        else if (absValue < 1) decimals = 5;
        else if (absValue < 10) decimals = 4;
        else if (absValue < 100) decimals = 3;
    }
    return value.toLocaleString(locale, { maximumFractionDigits: decimals });
}

/**
 * Lightweight "pinned positions" persistence (localStorage), inspired by the
 * watchlist/tier concept in fyangch/crypto-dashboard - lets a user keep
 * specific symbols pinned to the top of the list regardless of sort order.
 */
const PINNED_STORAGE_KEY = 'openpos_pinned_symbols';
function getPinnedSymbols() {
    try {
        const raw = localStorage.getItem(PINNED_STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
        return new Set();
    }
}
function togglePinnedSymbol(symbol) {
    const pinned = getPinnedSymbols();
    if (pinned.has(symbol)) pinned.delete(symbol);
    else pinned.add(symbol);
    try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...pinned]));
    } catch (e) { /* storage unavailable - pin just won't persist */ }
    return pinned;
}

/**
 * Debounce function to limit the rate at which a function can fire.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * @namespace ui
 * @description Global namespace for UI related functions.
 */
window.ui = {};

// --- DOM Element Getters ---
const positionsGridElement = document.getElementById('positions-grid');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const errorMessageContainer = document.getElementById('error-message');
const errorMessageTextElement = errorMessageContainer.querySelector('.error-message-text');
const noPositionsMessageContainer = document.getElementById('no-positions-message');
const noPositionsMessageTextElement = noPositionsMessageContainer.querySelector('.info-message-text');
const listChangeAnnouncerElement = document.getElementById('list-change-announcer');
const toastContainerElement = document.getElementById('toast-container');

const typeFilterElement = document.getElementById('type-filter');
const symbolSearchElement = document.getElementById('symbol-search');
const sortByElement = document.getElementById('sort-by');

const statsBarElement = document.getElementById('stats-bar');
const statTotalElement = document.getElementById('stat-total');
const statLongElement = document.getElementById('stat-long');
const statShortElement = document.getElementById('stat-short');

/**
 * Key for storing UI settings in localStorage.
 * @const {string}
 */
const UI_SETTINGS_KEY = 'openPosUiSettings';

let allFetchedPositions = []; // Stores all validated positions fetched from API
let currentlyDisplayedPositions = []; // Positions currently shown on the page after filtering/sorting (full list for lazy load)
const renderBatchSize = 15; // Number of cards to render per batch for lazy loading
let currentRenderIndex = 0; // Index for lazy loading
let intersectionObserver = null;
const loadMoreSentinelId = 'load-more-sentinel';


/**
 * Sets the loading state in the UI.
 * @function setLoading
 * @memberof ui
 * @param {boolean} isLoading - True to show loading indicator, false to hide.
 */
window.ui.isLoading = false;
window.ui.setLoading = function(isLoading) {
    window.ui.isLoading = Boolean(isLoading);
    if (isLoading) {
        loadingIndicatorElement.style.display = 'flex';
        positionsGridElement.style.display = 'none';
        errorMessageContainer.style.display = 'none';
        noPositionsMessageContainer.style.display = 'none';
        if (statsBarElement) statsBarElement.style.display = 'none';
    } else {
        loadingIndicatorElement.style.display = 'none';
        // Display of grid or messages is handled by renderPositions
    }
};

/**
 * Displays an error message in the UI.
 * @function displayError
 * @memberof ui
 * @param {string} messageKey - The translation key for the error message.
 * @param {string} [detail=''] - Additional detail or raw error message for context.
 */
window.ui.displayError = function(messageKey, detail = '') {
    const translatedMessage = translate(messageKey);
    let fullMessage = translatedMessage;
    if (detail && detail !== translatedMessage) {
        const simpleDetail = detail.replace(/API (Client|Server) Error: \d+ /, '').replace(/Failed to fetch data from .* after \d+ attempts. Last error: /, '');
        if (!translatedMessage.includes(simpleDetail) && !translatedMessage.includes(detail)) {
            fullMessage += ` (${simpleDetail || detail})`;
        }
    }
    errorMessageTextElement.textContent = fullMessage;
    errorMessageContainer.style.display = 'flex';
    loadingIndicatorElement.style.display = 'none';
    positionsGridElement.style.display = 'none';
    noPositionsMessageContainer.style.display = 'none';
    if (statsBarElement) statsBarElement.style.display = 'none';
};

/**
 * Displays a toast notification, optionally with an action button.
 * @function showToast
 * @memberof ui
 * @param {string} messageKey - The translation key for the message.
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info'] - The type of toast.
 * @param {number} [duration=5000] - Duration in ms. If 0, toast stays until action or manual close.
 * @param {{textKey: string, callback: function, className?: string} | null} [action=null] - Optional action button.
 */
window.ui.showToast = function(messageKey, type = 'info', duration = 5000, action = null) {
    if (!toastContainerElement || !window.translate) return;

    const message = translate(messageKey);
    if (!message) return;

    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    toast.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    if (action && action.textKey && typeof action.callback === 'function') {
        const button = document.createElement('button');
        button.className = `toast-action-button ${action.className || ''}`;
        button.textContent = translate(action.textKey);
        button.type = 'button'; // Good practice for buttons
        button.addEventListener('click', () => {
            action.callback();
            if (toast.parentElement) {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            }
        });
        toast.appendChild(button);
    }

    toastContainerElement.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => {
                    if (toast.parentElement) toast.remove();
                }, { once: true });
            }
        }, duration);
    }
};


// --- Lazy Loading Helper Functions ---
/** @private */
function createAndAppendSentinel() {
    removeSentinel();
    if (currentRenderIndex < currentlyDisplayedPositions.length) {
        const sentinel = document.createElement('div');
        sentinel.id = loadMoreSentinelId;
        positionsGridElement.appendChild(sentinel);
        observeSentinel(sentinel);
    }
}

/** @private */
function removeSentinel() {
    const existingSentinel = document.getElementById(loadMoreSentinelId);
    if (existingSentinel) {
        if (intersectionObserver) { // intersectionObserver might be null if never initialized
            intersectionObserver.unobserve(existingSentinel);
        }
        existingSentinel.remove();
    }
}

/** @private */
function observeSentinel(sentinel) {
    if (intersectionObserver) {
        intersectionObserver.disconnect();
    }
    const observerOptions = { root: null, rootMargin: '100px', threshold: 0.01 }; // Load a bit before it's visible
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                intersectionObserver.unobserve(entry.target);
                renderNextBatch();
            }
        });
    }, observerOptions);
    intersectionObserver.observe(sentinel);
}

/**
 * Renders a batch of position cards to the grid.
 * @private
 * @param {Array<Position>} positionsToRenderInBatch - Array of positions for the current batch.
 * @param {boolean} [append=true] - If true, appends to existing grid.
 */
function renderBatchOfCards(positionsToRenderInBatch, append = true) {
    if (!append) {
        positionsGridElement.innerHTML = '';
    }
    if (!positionsToRenderInBatch || positionsToRenderInBatch.length === 0) return;

    const fragment = document.createDocumentFragment();
    positionsToRenderInBatch.forEach(position => {
        const card = document.createElement('div');
        card.className = 'position-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';

        const identity = document.createElement('div');
        identity.className = 'card-identity';

        const symbolText = position.symbol || translate('positionCard.na');
        const avatar = document.createElement('span');
        avatar.className = 'symbol-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = String(symbolText).replace(/USDT|USDC|BUSD|IRT$/i, '').slice(0, 2).toUpperCase() || '?';
        identity.appendChild(avatar);

        const symbolElement = document.createElement('span');
        symbolElement.className = 'symbol';
        symbolElement.textContent = symbolText;
        identity.appendChild(symbolElement);
        cardHeader.appendChild(identity);

        const headerActions = document.createElement('div');
        headerActions.className = 'card-header-actions';

        const pinnedSymbols = getPinnedSymbols();
        const isPinned = position.symbol && pinnedSymbols.has(position.symbol);
        if (isPinned) card.classList.add('pinned');
        const pinButton = document.createElement('button');
        pinButton.type = 'button';
        pinButton.className = 'pin-button';
        pinButton.setAttribute('aria-pressed', String(isPinned));
        pinButton.setAttribute('aria-label', translate('positionCard.pinToggle'));
        pinButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1Z"/></svg>';
        pinButton.addEventListener('click', () => {
            if (!position.symbol) return;
            togglePinnedSymbol(position.symbol);
            window.ui.applyFilterAndRender();
        });
        headerActions.appendChild(pinButton);

        let positionTypeClass = 'unknown';
        let positionTypeTextKey = 'positionCard.unknown';
        if (position.type) {
            const typeLower = String(position.type).toLowerCase(); // Ensure it's a string
            if (typeLower === 'long' || typeLower === 'buy') {
                positionTypeClass = 'long'; positionTypeTextKey = 'positionCard.long';
            } else if (typeLower === 'short' || typeLower === 'sell') {
                positionTypeClass = 'short'; positionTypeTextKey = 'positionCard.short';
            }
        }
        const typeElement = document.createElement('span');
        typeElement.className = `type ${positionTypeClass}`;
        card.classList.add(positionTypeClass);
        typeElement.textContent = translate(positionTypeTextKey);
        headerActions.appendChild(typeElement);
        cardHeader.appendChild(headerActions);
        card.appendChild(cardHeader);

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';
        const createInfoRow = (labelKey, value, unit = '', toLocale = true) => {
            const row = document.createElement('div');
            row.className = 'info-row';
            const label = translate(labelKey);
            let displayValue = translate('positionCard.na');
            const locale = window.currentLanguage === 'fa' ? 'fa-IR' : 'en-US';
            if (value !== undefined && value !== null) {
                if (toLocale && typeof value === 'number') {
                    displayValue = formatAdaptiveNumber(value, locale) ?? displayValue;
                } else {
                    displayValue = String(value);
                }
            }
            const labelSpan = document.createElement('span');
            labelSpan.className = 'info-label';
            labelSpan.textContent = label;
            const valueSpan = document.createElement('span');
            valueSpan.className = 'info-value';
            valueSpan.textContent = unit ? `${displayValue} ${unit}` : displayValue;
            row.appendChild(labelSpan);
            row.appendChild(valueSpan);
            return row;
        };
        cardContent.appendChild(createInfoRow('positionCard.entryPrice', position.entryPrice, position.quoteAsset || '', true));
        if (position.currentPrice !== undefined) {
            cardContent.appendChild(createInfoRow('positionCard.currentPrice', position.currentPrice, position.quoteAsset || '', true));
        }
        cardContent.appendChild(createInfoRow('positionCard.amount', position.amount, position.baseAsset || '', true));
        if (position.leverage !== undefined) cardContent.appendChild(createInfoRow('positionCard.leverage', position.leverage, 'x', true));
        if (position.pnl !== undefined) {
            const pnlRow = createInfoRow('positionCard.pnl', position.pnl, position.quoteAsset || '', true);
            const isPositive = parseFloat(position.pnl) >= 0;
            pnlRow.classList.add(isPositive ? 'pnl-positive' : 'pnl-negative');
            const valueSpan = pnlRow.querySelector('.info-value');
            const triangle = document.createElement('span');
            triangle.className = `pnl-triangle ${isPositive ? 'up' : 'down'}`;
            triangle.setAttribute('aria-hidden', 'true');
            valueSpan.prepend(triangle);
            cardContent.appendChild(pnlRow);
        }
        if (position.timestamp) {
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedTime = new Date(Number(position.timestamp)).toLocaleString(window.currentLanguage === 'fa' ? 'fa-IR' : 'en-US', dateOptions);
            cardContent.appendChild(createInfoRow('positionCard.timestamp', formattedTime, '', false));
        }
        card.appendChild(cardContent);

        if (position.user) {
            const userElement = document.createElement('div');
            userElement.className = 'user-info';
            userElement.textContent = `${translate('positionCard.user')}: ${position.user}`;
            card.appendChild(userElement);
        }
        fragment.appendChild(card);
    });
    positionsGridElement.appendChild(fragment);
}

/**
 * Renders the next batch of positions for lazy loading.
 * @private
 */
function renderNextBatch() {
    const batchStartIndex = currentRenderIndex;
    const nextBatch = currentlyDisplayedPositions.slice(currentRenderIndex, currentRenderIndex + renderBatchSize);
    renderBatchOfCards(nextBatch, true); // Always append for lazy loading batches
    currentRenderIndex += nextBatch.length;

    createAndAppendSentinel(); // Re-adds sentinel if more items exist

    // ARIA announcement for lazy loaded content (might be too verbose on every scroll)
    // Consider announcing only when all items are loaded or in larger chunks.
    if (listChangeAnnouncerElement && nextBatch.length > 0 && batchStartIndex > 0) { // Avoid announcing initial batch again
        // const announcementText = translate('ariaMorePositionsLoaded', { count: nextBatch.length });
        // listChangeAnnouncerElement.textContent = announcementText;
        // console.log("Announced more loaded: ", announcementText);
    }

    if (currentRenderIndex >= currentlyDisplayedPositions.length && currentlyDisplayedPositions.length > 0) {
        if (listChangeAnnouncerElement && batchStartIndex > 0) { // Announce only if it wasn't the first (and only) batch
            const announcementText = translate('ariaAllPositionsDisplayed', { count: currentlyDisplayedPositions.length });
            listChangeAnnouncerElement.textContent = announcementText;
        }
    }
}


/**
 * Updates the small stats summary bar (total / long / short) to reflect
 * whatever is currently displayed after filtering.
 * @private
 * @param {Array<Position>} positions
 */
function updateStatsBar(positions) {
    if (!statsBarElement) return;
    const total = positions.length;
    let longCount = 0;
    let shortCount = 0;
    positions.forEach(p => {
        const t = p.type ? String(p.type).toLowerCase() : '';
        if (t === 'long' || t === 'buy') longCount++;
        else if (t === 'short' || t === 'sell') shortCount++;
    });
    const locale = window.currentLanguage === 'fa' ? 'fa-IR' : 'en-US';
    if (statTotalElement) statTotalElement.textContent = total.toLocaleString(locale);
    if (statLongElement) statLongElement.textContent = longCount.toLocaleString(locale);
    if (statShortElement) statShortElement.textContent = shortCount.toLocaleString(locale);
    statsBarElement.style.display = total > 0 ? 'flex' : 'none';
}

/**
 * Main function to render/re-render the list of positions in the UI.
 * @function renderPositions
 * @memberof ui
 * @param {Array<Position>} positionsToDisplay - Full list of positions to display (filtered and sorted).
 */
window.ui.renderPositions = function(positionsToDisplay) {
    currentlyDisplayedPositions = positionsToDisplay;
    currentRenderIndex = 0;
    updateStatsBar(positionsToDisplay);
    if (intersectionObserver) intersectionObserver.disconnect(); // Disconnect old observer
    positionsGridElement.innerHTML = ''; // Clear grid for new filtered/sorted list
    removeSentinel();

    let announcementMessageKey = '';
    let announcementVars = {};

    if (!currentlyDisplayedPositions || currentlyDisplayedPositions.length === 0) {
        const currentFilterType = typeFilterElement.value;
        const currentSearchTerm = symbolSearchElement.value;
        let messageKey = 'noPositionsMessage';
        if (allFetchedPositions.length === 0 && !window.ui.isLoading) {
            messageKey = 'noPositionsMessage'; announcementMessageKey = 'ariaNoPositionsInitial';
        } else if (currentFilterType !== 'all' || currentSearchTerm.trim() !== '') {
            messageKey = 'noPositionsMatchFilter'; announcementMessageKey = 'ariaNoPositionsAfterFilter';
        } else {
            messageKey = 'noPositionsMessage'; announcementMessageKey = 'ariaNoPositionsInitial';
        }
        noPositionsMessageTextElement.textContent = translate(messageKey);
        noPositionsMessageContainer.style.display = 'flex';
        positionsGridElement.style.display = 'none';
    } else {
        noPositionsMessageContainer.style.display = 'none';
        positionsGridElement.style.display = 'grid';
        renderNextBatch(); // Render first batch and set up sentinel

        if (currentlyDisplayedPositions.length <= renderBatchSize) { // All items fit in the first batch
            announcementMessageKey = 'ariaAllPositionsDisplayed';
            announcementVars = { count: currentlyDisplayedPositions.length };
        } else {
            announcementMessageKey = 'ariaPositionsDisplayed'; // Initial batch announcement
            announcementVars = { count: renderBatchSize, total: currentlyDisplayedPositions.length };
        }
    }

    if (listChangeAnnouncerElement && announcementMessageKey) {
        const announcementText = translate(announcementMessageKey, announcementVars);
        listChangeAnnouncerElement.textContent = announcementText;
    }
};

// --- Filtering and Sorting Logic (Pure functions for testability) ---
/** @private */
function _filterPositionsLogic(positions, filterTypeValue, searchTerm) {
    let filtered = [...positions];
    if (filterTypeValue !== 'all') {
        filtered = filtered.filter(p => p.type && String(p.type).toLowerCase() === filterTypeValue);
    }
    if (searchTerm) {
        filtered = filtered.filter(p => p.symbol && String(p.symbol).toLowerCase().includes(searchTerm));
    }
    return filtered;
}
window._uiTestExports = window._uiTestExports || {}; // For testing in browser without modules
window._uiTestExports._filterPositionsLogic = _filterPositionsLogic;


/** @private */
function _sortPositionsLogic(positions, sortValue) {
    let positionsToSort = [...positions];
    switch (sortValue) {
        case 'symbol-asc': positionsToSort.sort((a, b) => (String(a.symbol) || '').localeCompare(String(b.symbol) || '')); break;
        case 'symbol-desc': positionsToSort.sort((a, b) => (String(b.symbol) || '').localeCompare(String(a.symbol) || '')); break;
        case 'entryPrice-asc': positionsToSort.sort((a, b) => (Number(a.entryPrice) || 0) - (Number(b.entryPrice) || 0)); break;
        case 'entryPrice-desc': positionsToSort.sort((a, b) => (Number(b.entryPrice) || 0) - (Number(a.entryPrice) || 0)); break;
        case 'timestamp-desc': positionsToSort.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)); break;
        case 'timestamp-asc': positionsToSort.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0)); break;
        default: break;
    }
    return positionsToSort;
}
window._uiTestExports._sortPositionsLogic = _sortPositionsLogic;


/**
 * Sets the active value on a segmented-control container (a div wrapping
 * several buttons, each with a data-value), updating dataset + button
 * active/aria-pressed state. Pattern adapted from frequi's USegmentedControl.
 * @param {HTMLElement} container
 * @param {string} value
 */
function setSegmentedValue(container, value) {
    container.dataset.value = value;
    container.querySelectorAll('.segmented-btn').forEach(btn => {
        const isActive = btn.dataset.value === value;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

/**
 * Applies current filters and sorting to allFetchedPositions and updates the UI.
 * @function applyFilterAndRender
 * @memberof ui
 */
window.ui.applyFilterAndRender = function() {
    if (!typeFilterElement || !symbolSearchElement || !sortByElement) return;
    const filterTypeValue = typeFilterElement.dataset.value || 'all';
    const searchTerm = symbolSearchElement.value.toLowerCase().trim();
    const sortValue = sortByElement.value;

    let filtered = _filterPositionsLogic([...allFetchedPositions], filterTypeValue, searchTerm);
    let sortedAndFiltered = _sortPositionsLogic(filtered, sortValue);

    // Pinned positions float to the top, keeping their relative sort order
    // within each group (stable partition) - see fyangch/crypto-dashboard's
    // watchlist/tier concept.
    const pinnedSymbols = getPinnedSymbols();
    if (pinnedSymbols.size > 0) {
        const pinned = [];
        const rest = [];
        sortedAndFiltered.forEach(p => {
            (p.symbol && pinnedSymbols.has(p.symbol) ? pinned : rest).push(p);
        });
        sortedAndFiltered = pinned.concat(rest);
    }

    window.ui.renderPositions(sortedAndFiltered);
    window.ui.saveUiSettings();
};

/**
 * Initializes the display of positions.
 * @function displayPositions
 * @memberof ui
 * @param {Array<Position>} validatedPositions - Validated positions from the API.
 */
window.ui.displayPositions = function(validatedPositions) {
    allFetchedPositions = validatedPositions;
    window.currentPositionsData = validatedPositions; // For i18n and other modules
    window.ui.applyFilterAndRender();
};

/**
 * Saves current UI filter/sort settings to localStorage.
 * @function saveUiSettings
 * @memberof ui
 */
window.ui.saveUiSettings = function() {
    if (!typeFilterElement || !symbolSearchElement || !sortByElement) return;
    const settings = {
        typeFilter: typeFilterElement.dataset.value || 'all',
        symbolSearch: symbolSearchElement.value,
        sortBy: sortByElement.value
    };
    try {
        localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Error saving UI settings:', error);
    }
};

/**
 * Loads UI settings from localStorage and applies them to controls.
 * @function loadAndApplyUiSettings
 * @memberof ui
 */
window.ui.loadAndApplyUiSettings = function() {
    if (!typeFilterElement || !symbolSearchElement || !sortByElement) return;
    try {
        const savedSettings = localStorage.getItem(UI_SETTINGS_KEY);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.typeFilter && typeFilterElement.querySelector(`[data-value="${settings.typeFilter}"]`)) {
                setSegmentedValue(typeFilterElement, settings.typeFilter);
            }
            if (settings.symbolSearch !== undefined) symbolSearchElement.value = settings.symbolSearch;
            if (settings.sortBy && sortByElement.querySelector(`option[value="${settings.sortBy}"]`)) {
                sortByElement.value = settings.sortBy;
            }
        }
    } catch (error) {
        console.error('Error loading UI settings:', error);
    }
};

// --- Event Listeners ---
if (typeFilterElement) {
    typeFilterElement.addEventListener('click', (e) => {
        const btn = e.target.closest('.segmented-btn');
        if (!btn) return;
        setSegmentedValue(typeFilterElement, btn.dataset.value);
        window.ui.applyFilterAndRender();
    });
}
if (symbolSearchElement) symbolSearchElement.addEventListener('input', debounce(window.ui.applyFilterAndRender, 300));
if (sortByElement) sortByElement.addEventListener('change', window.ui.applyFilterAndRender);
