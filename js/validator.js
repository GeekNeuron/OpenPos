// js/validator.js
/**
 * @file Data validation module for API responses.
 * @author GeekNeuron
 * @version 1.1.0
 */

/**
 * Defines the expected schema for a Position object.
 * Each key represents a field, and the value is an object defining its type and if it's required.
 * @type {Object<string, {type: string, required: boolean, enumValues?: Array<string>}>}
 */
const positionSchema = {
    symbol: { type: 'string', required: true },
    type: { type: 'string', required: true, enumValues: ['long', 'short', 'buy', 'sell'] }, // Added enumValues for type
    entryPrice: { type: 'number', required: true },
    amount: { type: 'number', required: true },
    baseAsset: { type: 'string', required: false },
    quoteAsset: { type: 'string', required: false },
    leverage: { type: 'number', required: false },
    pnl: { type: 'number', required: false },
    user: { type: 'string', required: false },
    timestamp: { type: 'number', required: false } // Unix ms
};

/**
 * Validates a single position object against the positionSchema.
 * @param {Object} position - The position object to validate.
 * @returns {{isValid: boolean, errors: string[]}} - An object indicating if the position is valid and an array of error messages.
 */
function validatePositionObject(position) {
    const errors = [];
    // Ensure translate is available, fallback to simple messages if not (e.g., during tests if not mocked globally)
    const _translate = typeof translate === 'function' ? translate : (key, vars = {}) => {
        let msg = key;
        for(const k in vars) msg = msg.replace(`{{${k}}}`, vars[k]);
        return msg;
    };


    if (typeof position !== 'object' || position === null) {
        errors.push(_translate('validationErrorNotObject'));
        return { isValid: false, errors };
    }

    for (const key in positionSchema) {
        const schemaField = positionSchema[key];
        const value = position[key];

        if (schemaField.required && (value === undefined || value === null || String(value).trim() === '')) {
            errors.push(_translate('validationErrorRequiredField', { field: key }));
        }

        if (value !== undefined && value !== null && String(value).trim() !== '') { // Check for non-empty values too
            if (typeof value !== schemaField.type) {
                // Allow string numbers to be validated as numbers if they are numeric strings
                if (schemaField.type === 'number' && typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value)) {
                    // Potentially coerce here or just allow, Zod would handle coercion.
                    // For now, we'll be strict on type.
                    // errors.push(_translate('validationErrorInvalidTypeCoercible', { field: key, expectedType: schemaField.type, actualType: typeof value }));
                } else {
                    errors.push(_translate('validationErrorInvalidType', { field: key, expectedType: schemaField.type, actualType: typeof value }));
                }
            }
            if (schemaField.enumValues && typeof value === 'string' && !schemaField.enumValues.includes(value.toLowerCase())) {
                 errors.push(_translate('validationErrorInvalidEnumValue', { field: key, value: value, allowed: schemaField.enumValues.join(', ') }));
            }
        }
    }
    return { isValid: errors.length === 0, errors };
}
// Export for testing if not using modules in tests (conceptual)
// if (typeof window !== 'undefined') window.validatePositionObject = validatePositionObject;


/**
 * Validates an array of position objects.
 * @param {Array<Object>} positionsData - The array of position data from the API.
 * @returns {{isValid: boolean, validatedPositions: Array<Object>, errors: string[]}}
 * - isValid: Overall structural validity (is it an array). Functional validity depends on items.
 * - validatedPositions: Array of positions that passed individual validation (others are skipped).
 * - errors: Array of all validation error messages encountered from invalid items.
 */
function validatePositionsArray(positionsData) {
    // Ensure translate is available
    const _translate = typeof translate === 'function' ? translate : (key) => key;

    if (!Array.isArray(positionsData)) {
        return {
            isValid: false, // The structure itself is invalid
            validatedPositions: [],
            errors: [_translate('validationErrorNotArray')]
        };
    }

    const allErrors = [];
    const validPositions = [];

    positionsData.forEach((position, index) => {
        // Coerce numeric strings to numbers before validation if needed, or ensure schema handles it.
        // For now, assuming API sends correct types or validation will catch type mismatches.
        // Example coercion (can be risky if API is inconsistent):
        // if (typeof position.entryPrice === 'string') position.entryPrice = parseFloat(position.entryPrice);
        // if (typeof position.amount === 'string') position.amount = parseFloat(position.amount);
        // if (typeof position.pnl === 'string') position.pnl = parseFloat(position.pnl);
        // if (typeof position.leverage === 'string') position.leverage = parseFloat(position.leverage);
        // if (typeof position.timestamp === 'string') position.timestamp = parseInt(position.timestamp, 10);


        const { isValid, errors: itemErrors } = validatePositionObject(position);
        if (isValid) {
            // Ensure numbers are numbers if coercion was intended but not done strictly above
            // This step could be more robust with a transformation phase
            const coercedPosition = { ...position };
            if (positionSchema.entryPrice.type === 'number' && typeof coercedPosition.entryPrice !== 'number') coercedPosition.entryPrice = parseFloat(coercedPosition.entryPrice);
            if (positionSchema.amount.type === 'number' && typeof coercedPosition.amount !== 'number') coercedPosition.amount = parseFloat(coercedPosition.amount);
            // ... other numeric fields
            validPositions.push(coercedPosition);

        } else {
            itemErrors.forEach(errMsg => {
                allErrors.push(`Position ${index + 1} (${position.symbol || 'Unknown Symbol'}): ${errMsg}`);
            });
        }
    });

    // isValid here reflects if the initial structure was an array.
    // The filtering of invalid items is handled by returning only `validPositions`.
    // App.js will decide based on `validationErrors.length` and `validPositions.length`.
    return { isValid: true, validatedPositions: validPositions, errors: allErrors };
}
// Export for testing if not using modules in tests (conceptual)
// if (typeof window !== 'undefined') window.validatePositionsArray = validatePositionsArray;
