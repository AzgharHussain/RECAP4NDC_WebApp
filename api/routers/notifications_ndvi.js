const express = require('express');
const notificationRoutes = require('./notificationRoutes');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api', notificationRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'NDVI Alert Notification Service',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});

module.exports = app;