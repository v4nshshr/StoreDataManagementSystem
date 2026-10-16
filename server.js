require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Parse incoming JSON and URL-encoded request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets from public/ folder
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'US Retail Store Management System API'
  });
});

// Middleware to ensure DB connection across serverless requests (Vercel)
app.use(async (req, res, next) => {
  // Static assets or health check bypass DB connect
  if (!req.path.startsWith('/api') || req.path === '/api/health') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed. Please ensure MONGO_URI is set in environment variables.'
    });
  }
});

// Mount Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', analyticsRoutes);

// Catch-all for API 404s
app.use('/api/*', notFoundHandler);

// Fallback to index.html for frontend single-page navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Global Error Handler
app.use(globalErrorHandler);

// Start Server locally if not running on Vercel
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(65));
    console.log(`US Retail Store Management Server running on port ${PORT}`);
    console.log(`Web Dashboard: http://localhost:${PORT}`);
    console.log(`API Base URL:  http://localhost:${PORT}/api`);
    console.log('='.repeat(65));
  });

  connectDB().catch((err) => {
    console.error('Initial MongoDB connect error:', err.message);
    console.warn('Server is active. Ensure MONGO_URI is set in Render Environment Variables.');
  });
}

module.exports = app;
