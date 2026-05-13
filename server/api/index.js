/**
 * Vercel Serverless Entry Point
 *
 * Wraps the existing Express app as a single serverless function.
 * All routes, middleware, and business logic remain unchanged.
 *
 * For VPS/Railway deployment, this file is simply ignored —
 * server.js is used instead.
 */
import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app.js';

export default app;
