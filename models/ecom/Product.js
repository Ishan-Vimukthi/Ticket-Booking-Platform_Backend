const mongoose = require('mongoose');
const createEcomConnection = require('../../config/ecomDatabase');

const Schema = mongoose.Schema;

const EcomProductSchema = new Schema({
    name: { type: String, required: true },
    productCode: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'EcomCategory', required: true },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 0 },
    sku: { type: String },
    material: { type: String },
    careInstructions: { type: String },
    sizes: [{ type: String }], // ["S", "M", "L", "XL"]
    colors: [{ type: String }], // ["Red", "Blue", "Green"]
    images: [{ type: String }],
    
    // Stock Management Settings
    minStockLevel: { type: Number, default: 20 }, // Low stock threshold
    maxStockLevel: { type: Number, default: 100 }, // Maximum stock level
    reorderPoint: { type: Number, default: 30 }, // When to reorder
    
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'EcomUser' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: { type: Number, default: 0 }
});

// Use the separate e-commerce database connection
const ecomConnection = createEcomConnection();
const EcomProduct = ecomConnection.model('EcomProduct', EcomProductSchema);

module.exports = EcomProduct;
