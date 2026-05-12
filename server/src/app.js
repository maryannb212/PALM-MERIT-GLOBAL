import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'express-async-errors';
import rateLimit from 'express-rate-limit';

import { startCronJobs } from './jobs/penaltyJob.js';
import './jobs/maturityCron.js';
import { startStaffDeactivationJob } from './jobs/staffDeactivationJob.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import savingsRoutes from './routes/savingsRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import membershipRoutes from './routes/membershipRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import ambassadorRoutes from './routes/ambassadorRoutes.js';
import payoutRoutes from './routes/payoutRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import bankRoutes from './routes/bankRoutes.js';

dotenv.config();

import healthRoutes from './routes/healthRoutes.js';

const app = express();

// Trust proxy for Render/Vercel
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://palmmeritglobal.com',
  credentials: true
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

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/OTP attempts per hour
  message: 'Too many authentication attempts, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to sensitive routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/otp', authLimiter);
app.use('/api/transactions/initiate', generalLimiter);

// Raw body parser for Paystack webhook (must be before express.json())
app.use('/api/transactions/webhook/paystack', express.raw({ type: 'application/json' }));
app.use('/api/transactions/webhook/virtual-account', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (only for development, production should use Cloudinary)
app.use('/uploads', express.static('uploads'));

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
app.use('/api/payouts', payoutRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bank-details', bankRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// Initialize scheduled tasks
startCronJobs();
startStaffDeactivationJob();

export default app;
