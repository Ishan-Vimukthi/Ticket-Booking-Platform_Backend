require('dotenv').config();
const mongoose = require('mongoose');
const EcomOrder = require('./models/ecom/Order');

async function updateMultipleOrdersForTesting() {
    try {
        console.log('🔄 Updating multiple orders for comprehensive customer testing...\n');
        
        // Get several orders from different customers
        const orders = await EcomOrder.find({ paymentStatus: 'pending' })
            .sort({ createdAt: -1 })
            .limit(8); // Update 8 orders for good test data
        
        if (orders.length === 0) {
            console.log('❌ No pending orders found');
            process.exit(1);
        }
        
        console.log(`📋 Found ${orders.length} orders to update:\n`);
        
        let updated = 0;
        for (const order of orders) {
            console.log(`Updating Order ${order.orderNumber}`);
            console.log(`Customer: ${order.customerInfo.name} (${order.customerInfo.email})`);
            console.log(`Total: $${order.total}`);
            
            // Update to completed status
            order.paymentStatus = 'succeeded';
            order.status = 'confirmed';
            order.completedAt = new Date();
            
            await order.save();
            updated++;
            console.log(`✅ Updated to succeeded\n`);
        }
        
        console.log(`🎉 Successfully updated ${updated} orders!`);
        console.log('\n📊 Now you should see rich customer data:');
        console.log('- Multiple customers');
        console.log('- Varied order amounts');
        console.log('- Different customer types (VIP, Regular, etc.)');
        
        console.log('\n🧪 Test commands:');
        console.log('curl http://localhost:3000/api/ecom/customers/analytics');
        console.log('# Should show multiple customers and higher revenue');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error updating orders:', error);
        process.exit(1);
    }
}

updateMultipleOrdersForTesting();
