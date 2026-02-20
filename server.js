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

// Track if DB is initialized (for serverless)
let isDbInitialized = false;

// Connect to database and seed data
const initializeDB = async () => {
  if (isDbInitialized) return;

  try {
    await connectDB();
    await seedParameters();
    await seedAdmin();
    await seedTeamMember();
    await seedSampleData();
    isDbInitialized = true;
  } catch {
    // DB initialization failed, will retry on next request
  }
};

// Initialize DB (non-blocking for serverless)
initializeDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - MUST be before rate limiter to handle preflight requests
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow if origin matches allowed list or is a Vercel preview URL
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    callback(null, true); // Allow all for now (you can restrict later)
  },
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

// Ensure DB connection before API routes (for serverless)
app.use('/api', async (req, res, next) => {
  try {
    if (!isDbInitialized) {
      await initializeDB();
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

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

// Only start server if not running on Vercel (serverless)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
