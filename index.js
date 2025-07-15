require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs'); // Only declare this once at the top
// app.js or server.js
const venueRoutes = require('./routes/venue.route');

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin-portal';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Create public/images directory if it doesn't exist
const uploadDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create e-commerce uploads directory if it doesn't exist
const ecomUploadDir = path.join(__dirname, 'public', 'uploads', 'ecom');
if (!fs.existsSync(ecomUploadDir)) {
  fs.mkdirSync(ecomUploadDir, { recursive: true });
}

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false // or { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: CLIENT_URL }));
app.use(cors({
  origin: true, // or specify your frontend URL
  credentials: true,
  exposedHeaders: ['Content-Type', 'Authorization', 'Cross-Origin-Resource-Policy']
}));

// Serve static files with proper headers
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Serve e-commerce uploads
app.use('/uploads/ecom', express.static(path.join(__dirname, 'public', 'uploads', 'ecom'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Routes
const eventRoutes = require('./routes/event.route');
const adminRoutes = require('./routes/admin.route');
const ecomRoutes = require('./routes/ecom/index');

app.use('/api/events', eventRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/venues', venueRoutes);

// Initialize e-commerce routes
ecomRoutes(app);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// Database connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});