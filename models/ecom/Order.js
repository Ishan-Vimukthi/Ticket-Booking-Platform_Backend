const mongoose = require('mongoose');
const createEcomConnection = require('../../config/ecomDatabase');

const Schema = mongoose.Schema;

const EcomOrderItemSchema = new Schema({
    product: { type: Schema.Types.ObjectId, ref: 'EcomProduct', required: true },
    productName: { type: String, required: true }, // Store name for records
    productCode: { type: String, required: true },
    price: { type: Number, required: true }, // Price at time of order
    quantity: { type: Number, required: true },
    size: { type: String }, // Selected size
    color: { type: String }, // Selected color
    subtotal: { type: Number, required: true } // price * quantity
});

const EcomOrderSchema = new Schema({
    // Order identification
    orderNumber: { type: String, required: true, unique: true },
    
    // Customer information (flexible - no need for separate customer account)
    customerInfo: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        address: {
            street: { type: String, required: true },
            city: { type: String, required: true },
            state: { 
                type: String, 
                required: true,
                enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']
            },
            postalCode: { 
                type: String, 
                required: true,
                validate: {
                    validator: function(value) {
                        return /^\d{4}$/.test(value);
                    },
                    message: 'Invalid Australian postal code. Must be 4 digits'
                }
            },
            country: { type: String, default: 'AU', enum: ['AU'] }
        }
    },
    
    // Order items
    items: [EcomOrderItemSchema],
    
    // Pricing
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true }, // subtotal + shipping (no tax)
    
    // Payment information (Stripe Integration)
    paymentMethod: { type: String, default: 'stripe' },
    paymentIntentId: { type: String, required: true }, // Stripe Payment Intent ID
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'succeeded', 'failed', 'cancelled'],
        default: 'pending'
    },
    
    // Order status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    
    // Legacy fields (for backward compatibility)
    customer: { type: Schema.Types.ObjectId, ref: 'EcomCustomer' },
    totalAmount: { type: Number }, // Maps to total
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: { type: Number, default: 0 },
    
    // Additional tracking
    trackingNumber: { type: String },
    notes: { type: String }
});

// Pre-save middleware to generate order number and maintain legacy compatibility
EcomOrderSchema.pre('save', async function(next) {
    if (this.isNew && !this.orderNumber) {
        const count = await this.constructor.countDocuments();
        this.orderNumber = `ORD-${Date.now()}-${(count + 1).toString().padStart(4, '0')}`;
    }
    
    // Maintain legacy compatibility
    if (this.total && !this.totalAmount) {
        this.totalAmount = this.total;
    }
    
    this.updatedAt = new Date();
    next();
});

// Use the separate e-commerce database connection
const ecomConnection = createEcomConnection();
const EcomOrder = ecomConnection.model('EcomOrder', EcomOrderSchema);

module.exports = EcomOrder;
