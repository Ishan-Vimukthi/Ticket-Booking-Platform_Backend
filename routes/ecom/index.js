const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const customerRoutes = require('./customerRoutes');
const orderRoutes = require('./orderRoutes');
const stockRoutes = require('./stockRoutes');
const dashBoardRoutes = require('./dashBoardRoutes');
const dashboardStatsRoutes = require('./dashboardStatsRoutes'); // Optimized dashboard endpoint
const paymentRoutes = require('./paymentRoutes'); // Add payment routes

module.exports = (app) => {
    // E-commerce Health Check Routes
    app.get('/api/ecom', (req, res) => {
        res.json({
            status: 'SUCCESS',
            message: 'E-commerce API is running',
            timestamp: new Date(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    });

    app.get('/api/ecom/health', (req, res) => {
        res.json({
            status: 'UP',
            service: 'E-commerce Backend',
            uptime: process.uptime(),
            timestamp: new Date()
        });
    });

    // E-commerce API Routes with /api/ecom prefix
    app.use('/api/ecom/auth', authRoutes);
    app.use('/api/ecom/products', productRoutes);
    app.use('/api/ecom/categories', categoryRoutes);
    app.use('/api/ecom/customers', customerRoutes);
    app.use('/api/ecom/orders', orderRoutes);
    app.use('/api/ecom/stock', stockRoutes);
    app.use('/api/ecom/dashboard', dashBoardRoutes);
    app.use('/api/ecom/dashboard-stats', dashboardStatsRoutes); // Optimized dashboard stats
    app.use('/api/ecom/payments', paymentRoutes); // Add Stripe payment routes
};
