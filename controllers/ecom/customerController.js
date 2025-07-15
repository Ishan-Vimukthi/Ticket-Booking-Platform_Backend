const EcomCustomer = require('../../models/ecom/Customer');
const EcomOrder = require('../../models/ecom/Order');
const mongoose = require('mongoose');

/**
 * Add a new customer
 */
const addCustomer = async (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;

    if (!firstName || !lastName || !email || !phone || !address) {
        return res.status(400).json({ 
            status: "FAILED", 
            message: "All fields are required: firstName, lastName, email, phone, address" 
        });
    }

    // Validate address structure
    if (!address.street || !address.city || !address.state || !address.postalCode) {
        return res.status(400).json({
            status: "FAILED",
            message: "Address must include street, city, state, and postalCode"
        });
    }

    // Validate Australian state code
    const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
    if (!validStates.includes(address.state)) {
        return res.status(400).json({
            status: "FAILED",
            message: `Invalid state code '${address.state}'. Must be one of: ${validStates.join(', ')}`
        });
    }

    // Validate postal code
    if (!/^\d{4}$/.test(address.postalCode)) {
        return res.status(400).json({
            status: "FAILED",
            message: "Invalid postal code. Must be 4 digits (e.g., 2000)"
        });
    }

    try {
        const newCustomer = new EcomCustomer({
            firstName,
            lastName,
            email,
            phone,
            address: {
                street: address.street,
                city: address.city,
                state: address.state,
                postalCode: address.postalCode,
                country: 'AU'
            },
            deletedAt: 0
        });

        await newCustomer.save();
        return res.status(201).json({ 
            status: "SUCCESS", 
            message: "Customer added successfully", 
            data: newCustomer 
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Internal server error", 
            error: err.message 
        });
    }
};

/**
 * Get all customers with order statistics (Enhanced for frontend)
 */
const getAllCustomers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', type = 'all' } = req.query;
        const skip = (page - 1) * limit;

        // Build search query
        let searchQuery = { deletedAt: 0 };
        if (search) {
            searchQuery.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Get customers from orders (since we might not have separate customer records)
        const orderAggregation = await EcomOrder.aggregate([
            {
                $match: { 
                    paymentStatus: { $in: ['succeeded', 'completed'] },
                    'customerInfo.email': { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$customerInfo.email',
                    name: { $first: '$customerInfo.name' },
                    email: { $first: '$customerInfo.email' },
                    phone: { $first: '$customerInfo.phone' },
                    address: { $first: '$customerInfo.address' },
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$total' },
                    firstOrderDate: { $min: '$createdAt' },
                    lastOrderDate: { $max: '$createdAt' },
                    orders: { $push: '$$ROOT' }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    phone: 1,
                    address: 1,
                    totalOrders: 1,
                    totalSpent: 1,
                    firstOrderDate: 1,
                    lastOrderDate: 1,
                    // Calculate customer type
                    customerType: {
                        $cond: {
                            if: { $gte: ['$totalSpent', 500] },
                            then: 'VIP',
                            else: {
                                $cond: {
                                    if: { $gte: ['$totalOrders', 5] },
                                    then: 'Loyal',
                                    else: {
                                        $cond: {
                                            if: { $gte: ['$totalOrders', 2] },
                                            then: 'Regular',
                                            else: 'New'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            { $sort: { lastOrderDate: -1 } }
        ]);

        // Apply type filter
        let filteredCustomers = orderAggregation;
        if (type !== 'all') {
            filteredCustomers = orderAggregation.filter(customer => 
                customer.customerType.toLowerCase() === type.toLowerCase()
            );
        }

        // Apply search filter
        if (search) {
            filteredCustomers = filteredCustomers.filter(customer =>
                customer.name?.toLowerCase().includes(search.toLowerCase()) ||
                customer.email?.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Apply pagination
        const totalCustomers = filteredCustomers.length;
        const paginatedCustomers = filteredCustomers.slice(skip, skip + parseInt(limit));

        // Format response for frontend
        const formattedCustomers = paginatedCustomers.map(customer => ({
            id: customer._id,
            name: customer.name || 'Unknown Customer',
            email: customer.email,
            phone: customer.phone || '',
            address: customer.address || {},
            customerType: customer.customerType,
            stats: {
                totalOrders: customer.totalOrders,
                totalSpent: customer.totalSpent,
                firstOrderDate: customer.firstOrderDate,
                lastOrderDate: customer.lastOrderDate
            },
            createdAt: customer.firstOrderDate,
            updatedAt: customer.lastOrderDate
        }));

        return res.json({
            success: true,
            data: formattedCustomers,
            pagination: {
                total: totalCustomers,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCustomers / limit)
            }
        });

    } catch (err) {
        console.error('Get customers error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
};

/**
 * Update a customer
 */
const updateCustomer = async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ status: "FAILED", message: "Invalid customer ID" });
    }

    // Validate address structure if provided
    if (updateData.address) {
        // Validate Australian state code
        const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
        if (updateData.address.state && !validStates.includes(updateData.address.state)) {
            return res.status(400).json({
                status: "FAILED",
                message: `Invalid state code '${updateData.address.state}'. Must be one of: ${validStates.join(', ')}`
            });
        }

        // Validate postal code
        if (updateData.address.postalCode && !/^\d{4}$/.test(updateData.address.postalCode)) {
            return res.status(400).json({
                status: "FAILED",
                message: "Invalid postal code. Must be 4 digits (e.g., 2000)"
            });
        }

        // Ensure country is AU
        updateData.address.country = 'AU';
    }

    try {
        const customer = await EcomCustomer.findOneAndUpdate(
            { _id: id, deletedAt: 0 },
            updateData,
            { new: true }
        );

        if (!customer) {
            return res.status(404).json({ status: "FAILED", message: "Customer not found" });
        }

        return res.json({ status: "SUCCESS", message: "Customer updated successfully", data: customer });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Soft delete a customer
 */
const deleteCustomer = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ status: "FAILED", message: "Invalid customer ID" });
    }

    try {
        const customer = await EcomCustomer.findOne({ _id: id, deletedAt: 0 });
        if (!customer) {
            return res.status(404).json({ status: "FAILED", message: "Customer not found" });
        }

        customer.deletedAt = Date.now();
        await customer.save();

        return res.json({ status: "SUCCESS", message: "Customer deleted successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: "FAILED", message: "Internal server error", error: err.message });
    }
};

/**
 * Get customer analytics for dashboard
 */
const getCustomerAnalytics = async (req, res) => {
    try {
        // Get current date and month boundaries
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Aggregate customer data from orders with customer type classification
        const analytics = await EcomOrder.aggregate([
            {
                $match: { 
                    paymentStatus: { $in: ['succeeded', 'completed'] },
                    'customerInfo.email': { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$customerInfo.email',
                    totalSpent: { $sum: '$total' },
                    totalOrders: { $sum: 1 },
                    firstOrderDate: { $min: '$createdAt' },
                    lastOrderDate: { $max: '$createdAt' }
                }
            },
            {
                $addFields: {
                    customerType: {
                        $cond: [
                            { $gte: ['$totalSpent', 500] }, 'vip',
                            {
                                $cond: [
                                    { $gte: ['$totalOrders', 5] }, 'loyal',
                                    {
                                        $cond: [
                                            { $gte: ['$totalOrders', 2] }, 'regular',
                                            'new'
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCustomers: { $sum: 1 },
                    totalRevenue: { $sum: '$totalSpent' },
                    totalOrders: { $sum: '$totalOrders' },
                    newCustomersThisMonth: {
                        $sum: {
                            $cond: [
                                { $gte: ['$firstOrderDate', startOfMonth] },
                                1,
                                0
                            ]
                        }
                    },
                    newCustomersLastMonth: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gte: ['$firstOrderDate', startOfLastMonth] },
                                        { $lte: ['$firstOrderDate', endOfLastMonth] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    vipCustomers: {
                        $sum: {
                            $cond: [{ $eq: ['$customerType', 'vip'] }, 1, 0]
                        }
                    },
                    loyalCustomers: {
                        $sum: {
                            $cond: [{ $eq: ['$customerType', 'loyal'] }, 1, 0]
                        }
                    },
                    regularCustomers: {
                        $sum: {
                            $cond: [{ $eq: ['$customerType', 'regular'] }, 1, 0]
                        }
                    },
                    newCustomers: {
                        $sum: {
                            $cond: [{ $eq: ['$customerType', 'new'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const result = analytics[0] || {
            totalCustomers: 0,
            totalRevenue: 0,
            totalOrders: 0,
            newCustomersThisMonth: 0,
            newCustomersLastMonth: 0,
            vipCustomers: 0,
            loyalCustomers: 0,
            regularCustomers: 0,
            newCustomers: 0
        };

        // Calculate average order value
        const averageOrderValue = result.totalOrders > 0 
            ? result.totalRevenue / result.totalOrders 
            : 0;

        return res.json({
            success: true,
            data: {
                totalCustomers: result.totalCustomers,
                newCustomersThisMonth: result.newCustomersThisMonth,
                totalRevenue: result.totalRevenue,
                averageOrderValue: Math.round(averageOrderValue * 100) / 100,
                customersByType: {
                    vip: result.vipCustomers || 0,
                    loyal: result.loyalCustomers || 0,
                    regular: result.regularCustomers || 0,
                    new: result.newCustomers || 0
                }
            }
        });

    } catch (err) {
        console.error('Get customer analytics error:', err);
        return res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
};

/**
 * Get customer by ID with order history
 */
const getCustomerById = async (req, res) => {
    const { id: email } = req.params; // Using email as ID since that's our identifier

    try {
        // Get customer data from orders
        const customerData = await EcomOrder.aggregate([
            {
                $match: { 
                    'customerInfo.email': email,
                    paymentStatus: { $in: ['succeeded', 'completed'] }
                }
            },
            {
                $group: {
                    _id: '$customerInfo.email',
                    name: { $first: '$customerInfo.name' },
                    email: { $first: '$customerInfo.email' },
                    phone: { $first: '$customerInfo.phone' },
                    address: { $first: '$customerInfo.address' },
                    totalOrders: { $sum: 1 },
                    totalSpent: { $sum: '$total' },
                    firstOrderDate: { $min: '$createdAt' },
                    lastOrderDate: { $max: '$createdAt' },
                    orders: { $push: '$$ROOT' }
                }
            }
        ]);

        if (!customerData.length) {
            return res.status(404).json({ 
                status: "FAILED", 
                message: "Customer not found" 
            });
        }

        const customer = customerData[0];

        // Determine customer type
        let customerType = 'New';
        if (customer.totalSpent >= 500) customerType = 'VIP';
        else if (customer.totalOrders >= 5) customerType = 'Loyal';
        else if (customer.totalOrders >= 2) customerType = 'Regular';

        // Format response
        const formattedCustomer = {
            id: customer._id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone || '',
            address: customer.address || {},
            customerType: customerType,
            stats: {
                totalOrders: customer.totalOrders,
                totalSpent: customer.totalSpent,
                averageOrderValue: customer.totalSpent / customer.totalOrders,
                firstOrderDate: customer.firstOrderDate,
                lastOrderDate: customer.lastOrderDate
            },
            orders: customer.orders.slice(0, 10), // Latest 10 orders
            createdAt: customer.firstOrderDate,
            updatedAt: customer.lastOrderDate
        };

        return res.json({
            status: "SUCCESS",
            data: formattedCustomer
        });

    } catch (err) {
        console.error('Get customer by ID error:', err);
        return res.status(500).json({ 
            status: "FAILED", 
            message: "Internal server error", 
            error: err.message 
        });
    }
};

module.exports = {
    addCustomer,
    getAllCustomers,
    updateCustomer,
    deleteCustomer,
    getCustomerAnalytics,
    getCustomerById
};
