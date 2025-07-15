import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
let stripePromise = null;

const getStripe = async () => {
  if (!stripePromise) {
    try {
      const response = await fetch('http://localhost:3000/api/ecom/payments/config');
      const result = await response.json();
      
      if (result.status === 'SUCCESS') {
        stripePromise = loadStripe(result.data.publishableKey);
      }
    } catch (error) {
      console.error('Failed to load Stripe configuration:', error);
    }
  }
  return stripePromise;
};

// Card styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      '::placeholder': {
        color: '#aab7c4',
      },
      iconColor: '#666ee8',
    },
    invalid: {
      color: '#9e2146',
      iconColor: '#fa755a',
    },
  },
  hidePostalCode: false,
};

// Checkout Form Component
const CheckoutForm = ({ cartItems, customerInfo, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 50 ? 0.00 : 5.00; // Free shipping over $50, otherwise $5
    return {
      subtotal: subtotal.toFixed(2),
      shipping: shipping.toFixed(2),
      total: (subtotal + shipping).toFixed(2) // No tax for Australian customers
    };
  };

  const totals = calculateTotal();

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      setError('Stripe not loaded yet. Please try again.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Step 1: Create Payment Intent
      const paymentResponse = await fetch('http://localhost:3000/api/ecom/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartItems: cartItems.map(item => ({
            productId: item.productId || item._id,
            quantity: item.quantity,
            size: item.size || 'M',
            color: item.color || 'Default'
          })),
          customerInfo,
          shipping: parseFloat(totals.shipping)
          // No tax for Australian customers
        }),
      });

      const paymentResult = await paymentResponse.json();
      
      if (paymentResult.status !== 'SUCCESS') {
        throw new Error(paymentResult.message || 'Failed to create payment intent');
      }

      setOrderDetails(paymentResult.data);

      // Step 2: Confirm Payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentResult.data.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: customerInfo.name,
              email: customerInfo.email,
              phone: customerInfo.phone,
              address: {
                line1: customerInfo.address.street,
                city: customerInfo.address.city,
                state: customerInfo.address.state,
                postal_code: customerInfo.address.postalCode,
                country: customerInfo.address.country || 'AU',
              },
            },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Step 3: Confirm with Backend
      const confirmResponse = await fetch('http://localhost:3000/api/ecom/payments/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
        }),
      });

      const confirmResult = await confirmResponse.json();
      
      if (confirmResult.status === 'SUCCESS') {
        onSuccess && onSuccess(confirmResult.data);
      } else {
        throw new Error(confirmResult.message || 'Payment confirmation failed');
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      onError && onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
      <h2>Complete Your Order</h2>
      
      {/* Order Summary */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <h3>Order Summary</h3>
        {cartItems.map((item, index) => (
          <div key={index} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '10px' 
          }}>
            <span>{item.name} x {item.quantity}</span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <hr />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>${totals.subtotal}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Shipping:</span>
          <span>${totals.shipping}</span>
        </div>
        <hr />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontWeight: 'bold', 
          fontSize: '1.2em' 
        }}>
          <span>Total:</span>
          <span>${totals.total}</span>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
            Card Details
          </label>
          <div style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '12px',
            backgroundColor: 'white'
          }}>
            <CardElement options={cardElementOptions} />
          </div>
        </div>

        {error && (
          <div style={{
            color: '#e74c3c',
            backgroundColor: '#fadbd8',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || processing}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: processing ? '#95a5a6' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: processing ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          {processing ? 'Processing...' : `Pay $${totals.total}`}
        </button>
      </form>
    </div>
  );
};

// Main E-commerce Checkout Component
const EcommerceCheckout = () => {
  const [stripePromise, setStripePromise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState(null);

  // Sample cart items - replace with your actual cart data
  const [cartItems] = useState([
    {
      _id: '6873b74a2c989ce53b4687e4', // Replace with actual product ID
      name: 'Sample Product 1',
      price: 29.99,
      quantity: 2,
      size: 'M',
      color: 'Blue'
    },
    {
      _id: '6873b74a2c989ce53b4687e5', // Replace with actual product ID
      name: 'Sample Product 2',
      price: 15.00,
      quantity: 1,
      size: 'L',
      color: 'Red'
    }
  ]);

  // Sample customer info - Australian address format
  const customerInfo = {
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+61 2 1234 5678',
    address: {
      street: '123 Collins Street',
      city: 'Melbourne',
      state: 'VIC', // Australian state code
      postalCode: '3000', // 4-digit Australian postal code
      country: 'AU'
    }
  };

  useEffect(() => {
    const loadStripeInstance = async () => {
      try {
        const stripe = await getStripe();
        setStripePromise(stripe);
      } catch (error) {
        console.error('Failed to load Stripe:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStripeInstance();
  }, []);

  const handlePaymentSuccess = (data) => {
    setSuccess(true);
    setOrderData(data);
    console.log('Payment successful:', data);
  };

  const handlePaymentError = (error) => {
    console.error('Payment failed:', error);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Loading Stripe...</h2>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>Error Loading Payment System</h2>
        <p>Unable to connect to payment system. Please try again later.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2 style={{ color: '#27ae60' }}>🎉 Payment Successful!</h2>
        <p>Thank you for your order!</p>
        {orderData && (
          <div style={{ 
            backgroundColor: '#d5f4e6', 
            padding: '20px', 
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '20px auto'
          }}>
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> {orderData.orderNumber}</p>
            <p><strong>Total:</strong> ${orderData.total}</p>
            <p><strong>Status:</strong> {orderData.orderStatus}</p>
          </div>
        )}
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Place Another Order
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        cartItems={cartItems}
        customerInfo={customerInfo}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </Elements>
  );
};

export default EcommerceCheckout;
