const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const EcomOrder = require('../../models/ecom/Order');
const EcomProduct = require('../../models/ecom/Product');
const mongoose = require('mongoose');

/**
 * Get Stripe Configuration (Publishable Key)
 */
const getStripeConfig = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        });
    } catch (error) {
        console.error('Stripe config error:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Configuration error" 
        });
    }
};

/**
 * Create Payment Intent for E-commerce Checkout
 */
const createPaymentIntent = async (req, res) => {
    try {
        console.log('=== Payment Intent Request ===');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { cartItems, customerInfo, shipping = 0 } = req.body;

        // Validation
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            console.log('❌ Cart items validation failed:', cartItems);
            return res.status(400).json({ 
                success: false, 
                message: "Cart items are required" 
            });
        }

        // Handle both name formats: {name} or {firstName, lastName}
        const customerName = customerInfo?.name || `${customerInfo?.firstName || ''} ${customerInfo?.lastName || ''}`.trim();
        
        if (!customerInfo || !customerName || !customerInfo.email) {
            console.log('❌ Customer info validation failed:', { customerInfo, customerName });
            return res.status(400).json({ 
                success: false, 
                message: "Customer name and email are required" 
            });
        }

        // Validate Australian address structure
        const validStates = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
        const addressInfo = customerInfo.address;
        
        if (addressInfo) {
            // Check state code
            if (addressInfo.state && !validStates.includes(addressInfo.state)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid Australian state code '${addressInfo.state}'. Must be one of: ${validStates.join(', ')}`
                });
            }
            
            // Check postal code format
            if (addressInfo.postalCode && !/^\d{4}$/.test(addressInfo.postalCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid Australian postal code. Must be 4 digits (e.g., 2000)"
                });
            }
        }

        console.log('✅ Basic validation passed');
        console.log('Customer name:', customerName);
        console.log('Cart items count:', cartItems.length);
        
        // Generate unique order number
        const timestamp = Date.now();
        const orderCount = await EcomOrder.countDocuments();
        const uniqueOrderNumber = `ORD-${timestamp}-${(orderCount + 1).toString().padStart(4, '0')}`;
        console.log('✅ Order number generated:', uniqueOrderNumber);

        // Validate and calculate order totals
        let subtotal = 0;
        const validatedItems = [];

        for (const item of cartItems) {
            // Validate product exists and has sufficient stock
            const product = await EcomProduct.findOne({ 
                _id: item.productId, 
                isDeleted: false, 
                isActive: true 
            });

            if (!product) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Product not found: ${item.productId}` 
                });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` 
                });
            }

            // Validate size if provided
            if (item.size && product.sizes.length > 0 && !product.sizes.includes(item.size)) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Invalid size '${item.size}' for product ${product.name}` 
                });
            }

            // Validate color if provided
            if (item.color && product.colors.length > 0 && !product.colors.includes(item.color)) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Invalid color '${item.color}' for product ${product.name}` 
                });
            }

            const itemSubtotal = product.price * item.quantity;
            subtotal += itemSubtotal;

            validatedItems.push({
                product: product._id,
                productName: product.name,
                productCode: product.productCode,
                price: product.price,
                quantity: item.quantity,
                size: item.size || '',
                color: item.color || '',
                subtotal: itemSubtotal
            });
        }

        const totalAmount = subtotal + shipping;
        console.log('✅ Totals calculated - Subtotal:', subtotal, 'Shipping:', shipping, 'Total:', totalAmount);

        // Create Stripe Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Amount in cents
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            },
            description: `E-commerce Order - ${validatedItems.length} items`,
            metadata: {
                customer_name: customerName,
                customer_email: customerInfo.email,
                item_count: validatedItems.length.toString(),
                subtotal: subtotal.toString(),
                shipping: shipping.toString(),
                total: totalAmount.toString()
            }
        });

        console.log('✅ Stripe Payment Intent created:', paymentIntent.id);

        // Create pending order in database
        const newOrder = new EcomOrder({
            orderNumber: uniqueOrderNumber,
            customerInfo: {
                name: customerName,
                email: customerInfo.email,
                phone: customerInfo.phone || '',
                address: {
                    street: customerInfo.address?.street || customerInfo.address || '',
                    city: customerInfo.address?.city || customerInfo.city || '',
                    state: customerInfo.address?.state || customerInfo.state || '',
                    postalCode: customerInfo.address?.postalCode || customerInfo.postalCode || customerInfo.zipCode || '',
                    country: 'AU'
                }
            },
            items: validatedItems,
            subtotal: subtotal,
            shipping: shipping,
            total: totalAmount,
            paymentIntentId: paymentIntent.id,
            paymentStatus: 'pending',
            status: 'pending'
        });

        const savedOrder = await newOrder.save();
        console.log('✅ Order saved successfully with ID:', savedOrder._id);

        return res.status(200).json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                orderId: savedOrder._id,
                orderNumber: uniqueOrderNumber
            }
        });

    } catch (error) {
        console.error('Payment Intent creation error:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Payment processing failed", 
            error: error.message 
        });
    }
};

/**
 * Confirm Payment and Complete Order
 */
const confirmPayment = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ 
                success: false, 
                message: "Payment Intent ID is required" 
            });
        }

        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ 
                success: false, 
                message: "Payment not completed successfully" 
            });
        }

        // Find and update order
        const order = await EcomOrder.findOne({ paymentIntentId: paymentIntentId })
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        // Update product stock
        for (const item of order.items) {
            await EcomProduct.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Update order status
        order.paymentStatus = 'succeeded';
        order.status = 'confirmed';
        order.completedAt = new Date();
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Payment confirmed and order completed",
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: order.status
            }
        });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Payment confirmation failed", 
            error: error.message 
        });
    }
};

/**
 * Get Order by Order Number
 */
const getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await EcomOrder.findOne({ orderNumber: orderNumber })
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        return res.status(200).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error('Get order error:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve order", 
            error: error.message 
        });
    }
};

/**
 * Get All Orders (Admin)
 */
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const filter = {};
        if (status) {
            filter.status = status;
        }

        const orders = await EcomOrder.find(filter)
            .populate('items.product')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await EcomOrder.countDocuments(filter);

        return res.status(200).json({
            success: true,
            data: {
                orders,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all orders error:', error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve orders", 
            error: error.message 
        });
    }
};

module.exports = {
    getStripeConfig,
    createPaymentIntent,
    confirmPayment,
    getOrderByNumber,
    getAllOrders
};
