/**
 * Australian Address Validation Utilities
 * For the E-commerce Backend System
 */

// Australian State Codes and Names
const australianStates = {
    'NSW': 'New South Wales',
    'VIC': 'Victoria',
    'QLD': 'Queensland',
    'WA': 'Western Australia',
    'SA': 'South Australia',
    'TAS': 'Tasmania',
    'ACT': 'Australian Capital Territory',
    'NT': 'Northern Territory'
};

/**
 * Validate Australian state code
 * @param {string} stateCode - State code to validate (e.g., 'NSW', 'VIC')
 * @returns {boolean} - True if valid Australian state code
 */
const isValidStateCode = (stateCode) => {
    return Object.keys(australianStates).includes(stateCode);
};

/**
 * Validate Australian postal code
 * @param {string} postalCode - Postal code to validate (must be 4 digits)
 * @returns {boolean} - True if valid Australian postal code
 */
const isValidPostalCode = (postalCode) => {
    return /^\d{4}$/.test(postalCode);
};

/**
 * Get full state name from state code
 * @param {string} stateCode - State code (e.g., 'NSW')
 * @returns {string|null} - Full state name or null if invalid
 */
const getStateName = (stateCode) => {
    return australianStates[stateCode] || null;
};

/**
 * Get all valid Australian state codes
 * @returns {string[]} - Array of valid state codes
 */
const getValidStateCodes = () => {
    return Object.keys(australianStates);
};

/**
 * Validate complete Australian address object
 * @param {Object} address - Address object to validate
 * @param {string} address.street - Street address
 * @param {string} address.city - City name
 * @param {string} address.state - State code
 * @param {string} address.postalCode - Postal code
 * @param {string} [address.country] - Country (should be 'AU')
 * @returns {Object} - Validation result with success boolean and errors array
 */
const validateAustralianAddress = (address) => {
    const errors = [];
    
    if (!address) {
        return { success: false, errors: ['Address is required'] };
    }

    // Check required fields
    if (!address.street || address.street.trim() === '') {
        errors.push('Street address is required');
    }
    
    if (!address.city || address.city.trim() === '') {
        errors.push('City is required');
    }
    
    if (!address.state || address.state.trim() === '') {
        errors.push('State is required');
    } else if (!isValidStateCode(address.state)) {
        errors.push(`Invalid state code '${address.state}'. Must be one of: ${getValidStateCodes().join(', ')}`);
    }
    
    if (!address.postalCode || address.postalCode.trim() === '') {
        errors.push('Postal code is required');
    } else if (!isValidPostalCode(address.postalCode)) {
        errors.push('Invalid postal code. Must be 4 digits (e.g., 2000)');
    }
    
    if (address.country && address.country !== 'AU') {
        errors.push('Only Australian addresses are supported (country must be AU)');
    }

    return {
        success: errors.length === 0,
        errors: errors
    };
};

/**
 * Standardize Australian address format
 * @param {Object} address - Raw address data
 * @returns {Object} - Standardized address object
 */
const standardizeAustralianAddress = (address) => {
    if (!address) return null;
    
    return {
        street: address.street ? address.street.trim() : '',
        city: address.city ? address.city.trim() : '',
        state: address.state ? address.state.toUpperCase().trim() : '',
        postalCode: address.postalCode ? address.postalCode.trim() : '',
        country: 'AU'
    };
};

module.exports = {
    australianStates,
    isValidStateCode,
    isValidPostalCode,
    getStateName,
    getValidStateCodes,
    validateAustralianAddress,
    standardizeAustralianAddress
};
