require('dotenv').config();
const mongoose = require('mongoose');
const EcomOrder = require('./models/ecom/Order');

async function updateRecentOrder() {
    try {
        console.log('🔄 Finding most recent order to update...\n');
        
        // Get the most recent order
        const recentOrder = await EcomOrder.findOne({}).sort({ createdAt: -1 });
        
        if (!recentOrder) {
            console.log('❌ No orders found');
            process.exit(1);
        }
        
        console.log('📋 Found recent order:');
        console.log(`Order Number: ${recentOrder.orderNumber}`);
        console.log(`Customer: ${recentOrder.customerInfo.name} (${recentOrder.customerInfo.email})`);
        console.log(`Total: $${recentOrder.total}`);
        console.log(`Current Status: ${recentOrder.paymentStatus}\n`);
        
        // Update payment status to succeeded
        recentOrder.paymentStatus = 'succeeded';
        recentOrder.status = 'confirmed';
        recentOrder.completedAt = new Date();
        
        await recentOrder.save();
        
        console.log('✅ Order updated successfully!');
        console.log('Payment Status: pending → succeeded');
        console.log('Order Status: pending → confirmed\n');
        
        console.log('🎉 Now test your customer analytics again!');
        console.log('Run: curl http://localhost:3000/api/ecom/customers/analytics');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error updating order:', error);
        process.exit(1);
    }
}

updateRecentOrder();
