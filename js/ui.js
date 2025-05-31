// js/ui.js
/**
 * @file UI manipulation module for OpenPos.
 * Handles DOM interactions, rendering of positions, loading states, error messages,
 * toast notifications, filtering, sorting, lazy loading, and UI settings persistence.
 * @author GeekNeuron
 * @version 1.4.0
 */

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
window.ui.setLoading = function(isLoading) {
    if (isLoading) {
        loadingIndicatorElement.style.display = 'flex';
        positionsGridElement.style.display = 'none';
        errorMessageContainer.style.display = 'none';
        noPositionsMessageContainer.style.display = 'none';
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
        const symbolElement = document.createElement('span');
        symbolElement.className = 'symbol';
        symbolElement.textContent = position.symbol || translate('positionCard.na');
        cardHeader.appendChild(symbolElement);
        const typeElement = document.createElement('span');
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
        typeElement.className = `type ${positionTypeClass}`;
        typeElement.textContent = translate(positionTypeTextKey);
        cardHeader.appendChild(typeElement);
        card.appendChild(cardHeader);

        const cardContent = document.createElement('div');
        cardContent.className = 'card-content';
        const createInfoParagraph = (labelKey, value, unit = '', toLocale = true) => {
            const p = document.createElement('p');
            const label = translate(labelKey);
            let displayValue = translate('positionCard.na');
            if (value !== undefined && value !== null) {
                displayValue = toLocale && typeof value === 'number' ? value.toLocaleString(window.currentLanguage === 'fa' ? 'fa-IR' : 'en-US') : String(value);
            }
            p.innerHTML = `<strong>${label}:</strong> ${displayValue} ${unit}`;
            return p;
        };
        cardContent.appendChild(createInfoParagraph('positionCard.entryPrice', position.entryPrice, position.quoteAsset || '', true));
        cardContent.appendChild(createInfoParagraph('positionCard.amount', position.amount, position.baseAsset || '', true));
        if (position.leverage !== undefined) cardContent.appendChild(createInfoParagraph('positionCard.leverage', position.leverage, 'x', true));
        if (position.pnl !== undefined) {
            const pnlPara = createInfoParagraph('positionCard.pnl', position.pnl, position.quoteAsset || '', true);
            pnlPara.classList.add(parseFloat(position.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative');
            cardContent.appendChild(pnlPara);
        }
        if (position.timestamp) {
            const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedTime = new Date(Number(position.timestamp)).toLocaleString(window.currentLanguage === 'fa' ? 'fa-IR' : 'en-US', dateOptions);
            cardContent.appendChild(createInfoParagraph('positionCard.timestamp', formattedTime, '', false));
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
 * Main function to render/re-render the list of positions in the UI.
 * @function renderPositions
 * @memberof ui
 * @param {Array<Position>} positionsToDisplay - Full list of positions to display (filtered and sorted).
 */
window.ui.renderPositions = function(positionsToDisplay) {
    currentlyDisplayedPositions = positionsToDisplay;
    currentRenderIndex = 0;
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
 * Applies current filters and sorting to allFetchedPositions and updates the UI.
 * @function applyFilterAndRender
 * @memberof ui
 */
window.ui.applyFilterAndRender = function() {
    if (!typeFilterElement || !symbolSearchElement || !sortByElement) return;
    const filterTypeValue = typeFilterElement.value;
    const searchTerm = symbolSearchElement.value.toLowerCase().trim();
    const sortValue = sortByElement.value;

    let filtered = _filterPositionsLogic([...allFetchedPositions], filterTypeValue, searchTerm);
    let sortedAndFiltered = _sortPositionsLogic(filtered, sortValue);

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
        typeFilter: typeFilterElement.value,
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
            if (settings.typeFilter && typeFilterElement.querySelector(`option[value="${settings.typeFilter}"]`)) {
                typeFilterElement.value = settings.typeFilter;
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
if (typeFilterElement) typeFilterElement.addEventListener('change', window.ui.applyFilterAndRender);
if (symbolSearchElement) symbolSearchElement.addEventListener('input', debounce(window.ui.applyFilterAndRender, 300));
if (sortByElement) sortByElement.addEventListener('change', window.ui.applyFilterAndRender);
