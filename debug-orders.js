require('dotenv').config();
const mongoose = require('mongoose');
const createEcomConnection = require('./config/ecomDatabase');

async function debugOrders() {
    try {
        // Connect to database
        const ecomConnection = createEcomConnection();
        
        // Define order schema
        const Schema = mongoose.Schema;
        const EcomOrderSchema = new Schema({}, { strict: false }); // Allow any fields
        const EcomOrder = ecomConnection.model('EcomOrder', EcomOrderSchema);
        
        console.log('🔍 Checking for orders in database...\n');
        
        // Get all orders
        const allOrders = await EcomOrder.find({});
        console.log(`📊 Total orders found: ${allOrders.length}\n`);
        
        if (allOrders.length > 0) {
            console.log('📋 Order details:');
            allOrders.forEach((order, index) => {
                console.log(`\n--- Order ${index + 1} ---`);
                console.log(`ID: ${order._id}`);
                console.log(`Order Number: ${order.orderNumber || 'Not set'}`);
                console.log(`Customer Email: ${order.customerInfo?.email || 'Not set'}`);
                console.log(`Customer Name: ${order.customerInfo?.name || 'Not set'}`);
                console.log(`Payment Status: ${order.paymentStatus || 'Not set'}`);
                console.log(`Order Status: ${order.status || 'Not set'}`);
                console.log(`Total: $${order.total || 0}`);
                console.log(`Created: ${order.createdAt || 'Not set'}`);
                console.log(`Items Count: ${order.items?.length || 0}`);
            });
        } else {
            console.log('❌ No orders found in database');
            console.log('\nPossible reasons:');
            console.log('1. Order creation failed');
            console.log('2. Wrong database connection');
            console.log('3. Payment not completed properly');
        }
        
        // Check if there are any orders with different payment statuses
        const allStatuses = await EcomOrder.distinct('paymentStatus');
        console.log(`\n🏷️  Payment statuses found: ${JSON.stringify(allStatuses)}`);
        
        const allOrderStatuses = await EcomOrder.distinct('status');
        console.log(`📝 Order statuses found: ${JSON.stringify(allOrderStatuses)}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error checking orders:', error);
        process.exit(1);
    }
}

debugOrders();
