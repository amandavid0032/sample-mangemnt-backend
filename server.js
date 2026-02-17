require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./config/database');
const routes = require('./routes');
const { errorHandler } = require('./middleware');
const config = require('./config');
const { seedParameters, seedAdmin, seedTeamMember, seedSampleData } = require('./utils/seedParameters');

const app = express();

// Connect to database and seed data
const initializeDB = async () => {
  await connectDB();
  await seedParameters();
  await seedAdmin();
  await seedTeamMember();
  await seedSampleData();
};

initializeDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - MUST be before rate limiter to handle preflight requests
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - skip OPTIONS requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // increased limit for development
  skip: (req) => req.method === 'OPTIONS', // skip preflight requests
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later'
  }
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found'
  });
});

// Error handler
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

module.exports = app;
