const Stock = require('../model/Stock');
const User = require('../model/User');
const Product = require('../model/Product');
const emailService = require('../services/emailService');

/**
 * Create a new stock entry
 */
const addStock = async (req, res) => {
    const { product, quantity, size, price, supplier } = req.body;

    if (!product || quantity == null || !size || price == null || !supplier) {
        return res.json({ status: "FAILED", message: "All required fields must be provided" });
    }

    if (quantity < 0 || price < 0) {
        return res.json({ status: "FAILED", message: "Quantity and Price cannot be negative" });
    }

    try {
        // Populate productCode from Product model
        const productData = await Product.findById(product);
        if (!productData) {
            return res.json({ status: "FAILED", message: "Invalid product ID" });
        }

        // Generate batch number: BATCH_<productCode>_<DDMMYY>
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const formattedDate = `${day}${month}${year}`;
        const batchNumber = `BATCH_${productData.productCode}_${formattedDate}`;

        const newStock = new Stock({
            product,
            batchNumber,
            quantity,
            size,
            price,
            supplier,
            lowStockAlert: 5,
            lastRestocked: Date.now()
        });

        await newStock.save();
        return res.json({ status: "SUCCESS", message: "Stock added successfully", data: newStock });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Get all non-deleted stocks
 */
const getAllStocks = async (req, res) => {
    try {
        const stocks = await Stock.find({ deletedAt: 0 }).populate('product');
        return res.json({ status: "SUCCESS", data: stocks });
    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Get all stocks including deleted ones
 */
const getAllStocksWithDeleted = async (req, res) => {
    try {
        // Find all stocks, including soft-deleted ones
        const stocks = await Stock.find({}).populate('product');
        return res.json({ status: "SUCCESS", data: stocks });
    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Get a single stock by ID
 */
const getStockById = async (req, res) => {
    const { id } = req.params;

    try {
        const stock = await Stock.findOne({ _id: id, deletedAt: 0 }).populate('product');
        if (!stock) {
            return res.json({ status: "FAILED", message: "Stock not found" });
        }
        return res.json({ status: "SUCCESS", data: stock });
    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Update an existing stock
 */
const updateStock = async (req, res) => {
    const { id } = req.params;
    const { quantity, price, size, lowStockAlert, supplier } = req.body;

    try {
        const stock = await Stock.findOne({ _id: id, deletedAt: 0 });
        if (!stock) {
            return res.json({ status: "FAILED", message: "Stock not found" });
        }

        if (quantity !== undefined) stock.quantity = quantity;
        if (price !== undefined) stock.price = price;
        if (size !== undefined) stock.size = size;
        if (lowStockAlert !== undefined) stock.lowStockAlert = lowStockAlert;
        if (supplier !== undefined) stock.supplier = supplier;
        stock.lastRestocked = Date.now();

        // Save the stock after updates
        await stock.save();

        // Check if stock quantity is below the low stock alert threshold
        if (stock.quantity <= stock.lowStockAlert) {
            // Get all user emails to notify about the low stock
            const users = await User.find();
            const userEmails = users.map(user => user.email);

            // Get the product details from stock.product (which is an ObjectId)
            const productData = await Product.findById(stock.product);
            if (!productData) {
                return res.json({ status: "FAILED", message: "Invalid product ID" });
            }

            // Send email to all users
            emailService.sendLowStockAlert(productData.name, stock.batchNumber, stock.quantity, userEmails);
        }

        return res.json({ status: "SUCCESS", message: "Stock updated", data: stock });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Soft delete a stock
 */
const softDeleteStock = async (req, res) => {
    const { id } = req.params;

    try {
        const stock = await Stock.findOne({ _id: id });

        if (!stock) {
            return res.json({ status: "FAILED", message: "Stock not found" });
        }

        if (stock.deletedAt !== 0) {
            return res.json({ status: "FAILED", message: "Stock already deleted" });
        }

        stock.deletedAt = Date.now();
        await stock.save();

        return res.json({ status: "SUCCESS", message: "Stock soft deleted successfully" });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Restore a soft-deleted stock
 */
const restoreStock = async (req, res) => {
    const { id } = req.params;

    try {
        const stock = await Stock.findOne({ _id: id });

        if (!stock) {
            return res.json({ status: "FAILED", message: "Stock not found" });
        }

        if (stock.deletedAt === 0) {
            return res.json({ status: "FAILED", message: "Stock is not deleted" });
        }

        stock.deletedAt = 0;
        await stock.save();

        return res.json({ status: "SUCCESS", message: "Stock restored successfully", data: stock });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Permanently delete a stock
 */
const permanentlyDeleteStock = async (req, res) => {
    const { id } = req.params;

    try {
        const stock = await Stock.findById(id);

        if (!stock) {
            return res.json({ status: "FAILED", message: "Stock not found" });
        }

        await Stock.findByIdAndDelete(id);

        return res.json({ status: "SUCCESS", message: "Stock permanently deleted" });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

/**
 * Check all stocks for low stock and send alerts
 */
const checkLowStock = async (req, res) => {
    try {
        // Get all active stock items and populate product info
        const stocks = await Stock.find({ deletedAt: 0 }).populate('product');

        // Filter out stocks where quantity is less than or equal to the alert threshold
        const lowStockItems = stocks.filter(stock => stock.quantity <= stock.lowStockAlert);

        if (lowStockItems.length > 0) {
            // Get all user emails to notify about the low stock
            const users = await User.find();
            const userEmails = users.map(user => user.email);

            // Send email for each low stock item
            for (const stock of lowStockItems) {
                emailService.sendLowStockAlert(
                    stock.product?.name || 'Unknown Product',
                    stock.batchNumber,
                    stock.quantity,
                    userEmails
                );
            }

            return res.json({ status: "SUCCESS", message: "Low stock alerts sent to users" });
        }

        return res.json({ status: "SUCCESS", message: "No low stock items found" });

    } catch (err) {
        console.error(err);
        return res.json({ status: "FAILED", message: "Internal server error" });
    }
};

module.exports = {
    addStock,
    getAllStocks,
    getAllStocksWithDeleted,
    getStockById,
    updateStock,
    softDeleteStock,
    restoreStock,
    permanentlyDeleteStock,
    checkLowStock
};