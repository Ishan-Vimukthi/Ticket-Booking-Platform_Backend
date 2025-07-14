/**
 * Dashboard Statistics Controller - Optimized for Frontend
 * Provides aggregated data in a single API call to reduce frontend requests
 */

const EcomProduct = require('../../models/ecom/Product');
const EcomCategory = require('../../models/ecom/Category');
const EcomCustomer = require('../../models/ecom/Customer');
const EcomOrder = require('../../models/ecom/Order');
const EcomStock = require('../../models/ecom/Stock');

/**
 * Get comprehensive dashboard statistics in a single call
 * This reduces the 4 concurrent API calls your frontend is making
 */
const getDashboardStats = async (req, res) => {
    try {
        // Parallel execution for performance
        const [
            totalProducts,
            totalCustomers,
            totalOrders,
            totalRevenue,
            recentOrders,
            lowStockProducts,
            customerAnalytics,
            recycledProducts
        ] = await Promise.all([
            // Product count
            EcomProduct.countDocuments({ deletedAt: 0 }),
            
            // Customer count
            EcomCustomer.countDocuments({ deletedAt: 0 }),
            
            // Order count
            EcomOrder.countDocuments({ paymentStatus: { $in: ['succeeded', 'completed'] } }),
            
            // Total revenue
            EcomOrder.aggregate([
                { $match: { paymentStatus: { $in: ['succeeded', 'completed'] } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]),
            
            // Recent orders (last 5)
            EcomOrder.find({ paymentStatus: { $in: ['succeeded', 'completed'] } })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            
            // Low stock products (< 10 units)
            EcomProduct.find({ 
                deletedAt: 0,
                quantity: { $lt: 10, $gt: 0 }
            }).limit(5).lean(),
            
            // Customer type distribution
            EcomOrder.aggregate([
                { $match: { paymentStatus: { $in: ['succeeded', 'completed'] } } },
                {
                    $group: {
                        _id: '$customerInfo.email',
                        totalSpent: { $sum: '$total' },
                        totalOrders: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: null,
                        vip: { $sum: { $cond: [{ $gte: ['$totalSpent', 500] }, 1, 0] } },
                        loyal: { $sum: { $cond: [{ $and: [{ $lt: ['$totalSpent', 500] }, { $gte: ['$totalOrders', 5] }] }, 1, 0] } },
                        regular: { $sum: { $cond: [{ $and: [{ $lt: ['$totalOrders', 5] }, { $gte: ['$totalOrders', 2] }] }, 1, 0] } },
                        new: { $sum: { $cond: [{ $lt: ['$totalOrders', 2] }, 1, 0] } }
                    }
                }
            ]),
            
            // Recycled products count
            EcomProduct.countDocuments({ deletedAt: { $ne: 0 } })
        ]);

        // Calculate average order value
        const avgOrderValue = totalOrders > 0 ? (totalRevenue[0]?.total || 0) / totalOrders : 0;

        // Format response matching your frontend expectations
        const dashboardData = {
            // Overview stats for cards
            overview: {
                totalProducts,
                totalCustomers,
                totalOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
                averageOrderValue: Math.round(avgOrderValue * 100) / 100,
                recycledProducts
            },
            
            // Recent activity
            recentOrders: recentOrders.map(order => ({
                id: order._id,
                customerName: order.customerInfo?.name || 'Unknown',
                customerEmail: order.customerInfo?.email || '',
                total: order.total,
                status: order.paymentStatus,
                date: order.createdAt,
                items: order.items?.length || 0
            })),
            
            // Stock insights
            stockInsights: {
                lowStockCount: lowStockProducts.length,
                lowStockProducts: lowStockProducts.map(product => ({
                    id: product._id,
                    name: product.name,
                    quantity: product.quantity,
                    sku: product.sku || product.name.substring(0, 6).toUpperCase()
                }))
            },
            
            // Customer distribution
            customersByType: customerAnalytics[0] || {
                vip: 0,
                loyal: 0,
                regular: 0,
                new: 0
            },
            
            // Performance metrics
            performance: {
                lowStockAlert: lowStockProducts.length > 0,
                revenueGrowth: "N/A", // Can be enhanced later
                orderTrend: "N/A"     // Can be enhanced later
            }
        };

        return res.json({
            success: true,
            data: dashboardData
        });

    } catch (err) {
        console.error('Dashboard stats error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard statistics',
            message: err.message
        });
    }
};

/**
 * Get real-time business insights
 */
const getBusinessInsights = async (req, res) => {
    try {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const [thisMonthStats, lastMonthStats] = await Promise.all([
            // This month
            EcomOrder.aggregate([
                { 
                    $match: { 
                        paymentStatus: { $in: ['succeeded', 'completed'] },
                        createdAt: { $gte: thisMonth }
                    } 
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 },
                        customers: { $addToSet: '$customerInfo.email' }
                    }
                }
            ]),
            
            // Last month
            EcomOrder.aggregate([
                { 
                    $match: { 
                        paymentStatus: { $in: ['succeeded', 'completed'] },
                        createdAt: { $gte: lastMonth, $lte: endLastMonth }
                    } 
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$total' },
                        orders: { $sum: 1 },
                        customers: { $addToSet: '$customerInfo.email' }
                    }
                }
            ])
        ]);

        const thisMonth_data = thisMonthStats[0] || { revenue: 0, orders: 0, customers: [] };
        const lastMonth_data = lastMonthStats[0] || { revenue: 0, orders: 0, customers: [] };

        // Calculate growth percentages
        const revenueGrowth = lastMonth_data.revenue > 0 
            ? ((thisMonth_data.revenue - lastMonth_data.revenue) / lastMonth_data.revenue * 100)
            : thisMonth_data.revenue > 0 ? 100 : 0;

        const orderGrowth = lastMonth_data.orders > 0
            ? ((thisMonth_data.orders - lastMonth_data.orders) / lastMonth_data.orders * 100)
            : thisMonth_data.orders > 0 ? 100 : 0;

        const customerGrowth = lastMonth_data.customers.length > 0
            ? ((thisMonth_data.customers.length - lastMonth_data.customers.length) / lastMonth_data.customers.length * 100)
            : thisMonth_data.customers.length > 0 ? 100 : 0;

        return res.json({
            success: true,
            data: {
                thisMonth: {
                    revenue: thisMonth_data.revenue,
                    orders: thisMonth_data.orders,
                    customers: thisMonth_data.customers.length
                },
                lastMonth: {
                    revenue: lastMonth_data.revenue,
                    orders: lastMonth_data.orders,
                    customers: lastMonth_data.customers.length
                },
                growth: {
                    revenue: Math.round(revenueGrowth * 100) / 100,
                    orders: Math.round(orderGrowth * 100) / 100,
                    customers: Math.round(customerGrowth * 100) / 100
                }
            }
        });

    } catch (err) {
        console.error('Business insights error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch business insights'
        });
    }
};

module.exports = {
    getDashboardStats,
    getBusinessInsights
};
