const EcomStock = require('../../models/ecom/Stock');
const EcomProduct = require('../../models/ecom/Product');
const mongoose = require('mongoose');

/**
 * Add new stock
 */
const addStock = async (req, res) => {
    const { product, batchNumber, quantity, size, price, supplier } = req.body;

    if (!product || !batchNumber || !quantity || !size || !price || !supplier) {
        return res.status(400).json({ status: "FAILED", message: "All fields are required" });
    }

    try {
        const newStock = new EcomStock({
            product,
            batchNumber,
            quantity,
            size,
            price,
            supplier,
            deletedAt: 0
        });

        await newStock.save();
        const populatedStock = await EcomStock.findById(newStock._id).populate('product');

        return res.status(201).json({ status: "SUCCESS", message: "Stock added successfully", data: populatedStock });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Get all non-deleted stock
 */
const getAllStock = async (req, res) => {
    try {
        const stock = await EcomStock.find({ deletedAt: 0 })
            .populate('product')
            .sort({ createdAt: -1 });

        return res.json({ status: "SUCCESS", data: stock });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Update stock quantity
 */
const updateStock = async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ status: "FAILED", message: "Invalid stock ID" });
    }

    try {
        const stock = await EcomStock.findOneAndUpdate(
            { _id: id, deletedAt: 0 },
            updateData,
            { new: true }
        ).populate('product');

        if (!stock) {
            return res.status(404).json({ status: "FAILED", message: "Stock not found" });
        }

        return res.json({ status: "SUCCESS", message: "Stock updated successfully", data: stock });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Get low stock items
 */
const getLowStock = async (req, res) => {
    try {
        const lowStockItems = await EcomStock.find({
            deletedAt: 0,
            $expr: { $lt: ["$quantity", "$lowStockAlert"] }
        }).populate('product');

        return res.json({ status: "SUCCESS", data: lowStockItems });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Bulk update stock quantities - simplified
 */
const bulkUpdateStock = async (req, res) => {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ 
            status: "FAILED", 
            message: "Updates array is required" 
        });
    }

    try {
        const results = [];

        for (const update of updates) {
            const { productId, quantity } = update;

            if (!mongoose.Types.ObjectId.isValid(productId) || typeof quantity !== 'number') {
                continue; // Skip invalid updates
            }

            try {
                const product = await EcomProduct.findOneAndUpdate(
                    { _id: productId, isDeleted: false },
                    { quantity: quantity, updatedAt: new Date() },
                    { new: true }
                );

                if (product) {
                    results.push({
                        productId,
                        productName: product.name,
                        newQuantity: quantity
                    });
                }
            } catch (error) {
                // Skip errors and continue
                continue;
            }
        }

        return res.json({
            status: "SUCCESS",
            message: `Updated ${results.length} products`,
            data: results
        });

    } catch (err) {
        console.error('Bulk update error:', err);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Internal server error"
        });
    }
};

/**
 * Get stock status for products with simple data structure
 */
const getStockStatus = async (req, res) => {
    try {
        const products = await EcomProduct.find({ 
            deletedAt: 0, 
            isDeleted: false 
        })
        .populate('category')
        .sort({ createdAt: -1 });

        const stockData = products.map(product => {
            const quantity = product.quantity || 0;
            
            // Simple status logic
            let status = 'healthy';
            if (quantity === 0) {
                status = 'out_of_stock';
            } else if (quantity <= 20) {
                status = 'low';
            } else if (quantity <= 40) {
                status = 'medium';
            }

            return {
                _id: product._id,
                name: product.name,
                sku: product.productCode,
                quantity: quantity,
                price: product.price || 0,
                status: status,
                images: product.images || [],
                sizes: product.sizes || [],
                colors: product.colors || [],
                createdAt: product.createdAt,
                updatedAt: product.updatedAt
            };
        });

        return res.json({
            status: "SUCCESS",
            data: stockData
        });

    } catch (err) {
        console.error('Get stock status error:', err);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Internal server error", 
            error: err.message 
        });
    }
};

/**
 * Update stock settings for a product - simplified
 */
const updateStockSettings = async (req, res) => {
    const { productId, minStockLevel, maxStockLevel, reorderPoint } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ 
            status: "FAILED", 
            message: "Invalid product ID" 
        });
    }

    try {
        const updateFields = {};
        if (minStockLevel !== undefined) updateFields.minStockLevel = minStockLevel;
        if (maxStockLevel !== undefined) updateFields.maxStockLevel = maxStockLevel;
        if (reorderPoint !== undefined) updateFields.reorderPoint = reorderPoint;
        updateFields.updatedAt = new Date();

        const product = await EcomProduct.findOneAndUpdate(
            { _id: productId, isDeleted: false },
            updateFields,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ 
                status: "FAILED", 
                message: "Product not found" 
            });
        }

        return res.json({
            status: "SUCCESS",
            message: "Stock settings updated",
            data: {
                productId: product._id,
                productName: product.name,
                minStockLevel: product.minStockLevel,
                maxStockLevel: product.maxStockLevel,
                reorderPoint: product.reorderPoint
            }
        });

    } catch (err) {
        console.error('Update stock settings error:', err);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Internal server error"
        });
    }
};

module.exports = {
    addStock,
    getAllStock,
    updateStock,
    getLowStock,
    bulkUpdateStock,
    getStockStatus,
    updateStockSettings
};
