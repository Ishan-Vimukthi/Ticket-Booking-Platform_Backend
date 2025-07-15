const mongoose = require('mongoose');
const createEcomConnection = require('../../config/ecomDatabase');

const Schema = mongoose.Schema;

const EcomCustomerSchema = new Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    
    // Australian Address Structure
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { 
            type: String, 
            required: true,
            enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'], // State codes
            validate: {
                validator: function(value) {
                    return ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].includes(value);
                },
                message: 'Invalid Australian state code. Must be one of: NSW, VIC, QLD, WA, SA, TAS, ACT, NT'
            }
        },
        postalCode: { 
            type: String, 
            required: true,
            validate: {
                validator: function(value) {
                    // Australian postal codes are 4 digits
                    return /^\d{4}$/.test(value);
                },
                message: 'Invalid Australian postal code. Must be 4 digits (e.g., 2000)'
            }
        },
        country: { type: String, default: 'AU', enum: ['AU'] }
    },
    
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Number, default: 0 }
});

// Australian State Code to Name mapping
const stateNames = {
    'NSW': 'New South Wales',
    'VIC': 'Victoria',
    'QLD': 'Queensland', 
    'WA': 'Western Australia',
    'SA': 'South Australia',
    'TAS': 'Tasmania',
    'ACT': 'Australian Capital Territory',
    'NT': 'Northern Territory'
};

// Virtual for full state name
EcomCustomerSchema.virtual('address.stateName').get(function() {
    return this.address.state ? stateNames[this.address.state] : null;
});

// Ensure virtual fields are serialized
EcomCustomerSchema.set('toJSON', { virtuals: true });
EcomCustomerSchema.set('toObject', { virtuals: true });

// Add index for faster queries based on deletedAt
EcomCustomerSchema.index({ deletedAt: 1 });

// Create a sparse index on email so null values don't cause conflicts
EcomCustomerSchema.index({ email: 1 }, { sparse: true });

// Use the separate e-commerce database connection
const ecomConnection = createEcomConnection();
const EcomCustomer = ecomConnection.model('EcomCustomer', EcomCustomerSchema);

module.exports = EcomCustomer;
