/**
 * Normalizes item names for consistency.
 * - Removes all spaces
 * - Converts to uppercase
 * - Maps "KAPAS" variations to "COTTON"
 * - Maps "COTTON" variations to "COTTON"
 * 
 * @param {string} name - The raw item name
 * @returns {string} - The normalized item name
 */
export const normalizeItemName = (name) => {
    if (!name) return '';
    
    // Remove all whitespace and convert to uppercase
    const cleaned = name.replace(/\s+/g, '').toUpperCase();
    
    // Check for "COTTON" or "KAPAS"
    if (cleaned === 'COTTON' || cleaned === 'KAPAS') {
        return 'COTTON';
    }
    
    // Return the cleaned uppercase version for other items
    return cleaned;
};
