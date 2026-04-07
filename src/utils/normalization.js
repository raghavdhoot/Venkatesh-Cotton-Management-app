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
    
    // For checking COTTON/KAPAS, we ignore spaces and case
    const checkValue = name.replace(/\s+/g, '').toUpperCase();
    
    if (checkValue === 'COTTON' || checkValue === 'KAPAS') {
        return 'COTTON';
    }
    
    // For other items, we keep spaces but normalize to uppercase and trim
    return name.trim().toUpperCase();
};
