import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import pool from './config/db.js';
import logger from './utils/logger.js';
import { exec } from 'child_process';
import util from 'util';
import { startDeductionJob } from './jobs/deductionJob.js';

const execPromise = util.promisify(exec);

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Crash-safe: catch unhandled promise rejections and uncaught exceptions
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[FATAL] Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Server startup with retry logic
// ─────────────────────────────────────────────────────────────────────────────
const startServer = async (retries = 5) => {
  while (retries) {
    try {
      // Test database connection
      const res = await pool.query('SELECT NOW()');
      logger.info(`[startup] Database connected at ${res.rows[0].now}`);

      // Run automatic migrations
      logger.info(`[startup] Running database migrations...`);
      const { stdout, stderr } = await execPromise('npx knex migrate:latest');
      if (stderr && !stderr.includes('warn')) {
         logger.info(`[startup] Migration warnings/errors: ${stderr}`);
      }
      logger.info(`[startup] Database migrations completed. Output: \n${stdout.trim()}`);

      const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`[startup] Palm Merit Global API`);
        logger.info(`[startup] Mode: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`[startup] Port: ${PORT}`);
        logger.info(`[startup] Ready to accept connections`);

        // Start scheduled cron jobs only when explicitly enabled.
        // Production scheduling can be handled by GitHub Actions or Render Cron.
        if (process.env.ENABLE_INTERNAL_CRON === 'true') {
          startDeductionJob();
        }
      });

      // Graceful shutdown
      const gracefulShutdown = (signal) => {
        logger.info(`[shutdown] Received ${signal}, shutting down gracefully...`);
        server.close(() => {
          logger.info('[shutdown] HTTP server closed');
          pool.end().then(() => {
            logger.info('[shutdown] Database pool closed');
            process.exit(0);
          });
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          logger.error('[shutdown] Forced shutdown — connections did not close in time');
          process.exit(1);
        }, 10000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      return; // Success
    } catch (error) {
      retries -= 1;
      console.error(`[startup] Database connection failed. Retries left: ${retries}`);
      console.error(`[startup] Error: ${error.message}`);
      if (retries === 0) {
        console.error('[startup] All retries exhausted. Exiting.');
        process.exit(1);
      }
      // Wait 5 seconds before retrying
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

startServer();
