import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';

import { startCronJobs } from './jobs/penaltyJob.js';
import { startStaffDeactivationJob } from './jobs/staffDeactivationJob.js';
import { startDeductionJob } from './jobs/deductionJob.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import savingsRoutes from './routes/savingsRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import ambassadorRoutes from './routes/ambassadorRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import bankRoutes from './routes/bankRoutes.js';
import adminCronRoutes from './routes/adminCronRoutes.js';

// dotenv is loaded in server.js before app import

import healthRoutes from './routes/healthRoutes.js';

const app = express();

// Trust proxy for Railway / reverse proxies
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// Production-ready CORS — supports comma-separated CLIENT_URL for multi-domain
const userOrigins = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').split(',').map(o => o.trim()).filter(Boolean);
const defaultOrigins = [
  'https://palmmeritglobal.com', 
  'https://www.palmmeritglobal.com',
  'http://localhost:5173', 
  'http://localhost:3000', 
  'http://127.0.0.1:5173'
];
const allowedOrigins = [...new Set([...userOrigins, ...defaultOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in development
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Check if origin is in allowedOrigins or matches vercel.app wildcard
    const isAllowed = allowedOrigins.includes(origin) || 
                     (origin.endsWith('.vercel.app') && !origin.includes('..'));

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
// Global rate limiters can stay here
app.use('/api/transactions/initiate', generalLimiter);

// Raw body parser for Paystack webhook (must be before express.json())
app.use('/api/transactions/webhook/paystack', express.raw({ type: 'application/json' }));
app.use('/api/transactions/webhook/virtual-account', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (development only — production uses Cloudinary)
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static('uploads'));
}

// Basic health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Palm Merit Global API is running' });
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ambassadors', ambassadorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bank-details', bankRoutes);
app.use('/api/admin/trigger', adminCronRoutes);

// 404 Handler
app.use((req, res) => {
  logger.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Route not found' });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  logger.error('[Error Handler]:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Initialize scheduled tasks (Persistent mode)
import { startMaturityJob } from './jobs/maturityCron.js';
startMaturityJob();
startDeductionJob();
startCronJobs();
startStaffDeactivationJob();

export default app;
