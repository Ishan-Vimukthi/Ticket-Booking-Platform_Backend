require('dotenv').config();
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const venueRoutes = require('./routes/venue.route');
const { errorHandler } = require('./middleware/errorMiddleware.js');


// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin-portal';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Create public/images directory if it doesn't exist
const uploadDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false // Keep if needed, or configure as per specific requirements
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Consolidated CORS configuration
app.use(cors({
  origin: CLIENT_URL, // Using the environment variable for the client URL
  credentials: true,
  exposedHeaders: ['Content-Type', 'Authorization', 'Cross-Origin-Resource-Policy'] // Keep if needed
}));

// Serve static files with proper headers
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), {
  setHeaders: (res) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allows images to be embedded
    res.set('Access-Control-Allow-Origin', CLIENT_URL); // Restrict to client URL
  }
}));

// Routes
const eventRoutes = require('./routes/event.route');
const adminRoutes = require('./routes/admin.route');

app.use('/api/events', eventRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/venues', venueRoutes);
app.use(errorHandler);


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.send('Admin API is running...');
});

// Database connection
let server;
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Start server only if not in test environment or if run directly
    if (process.env.NODE_ENV !== 'test' || require.main === module) {
      server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if DB connection fails at start
  });

// Export the app and server for testing and graceful shutdown
export { app, server };