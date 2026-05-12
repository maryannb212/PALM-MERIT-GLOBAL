import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import pool from './config/db.js';

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────────────────────
// Crash-safe: catch unhandled promise rejections and uncaught exceptions
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit — Railway will restart the container if it crashes
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
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
      console.log(`[startup] Database connected at ${res.rows[0].now}`);

      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`[startup] Palm Merit Global API`);
        console.log(`[startup] Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log(`[startup] Port: ${PORT}`);
        console.log(`[startup] Ready to accept connections`);
      });

      // Graceful shutdown for Railway SIGTERM
      const gracefulShutdown = (signal) => {
        console.log(`[shutdown] Received ${signal}, shutting down gracefully...`);
        server.close(() => {
          console.log('[shutdown] HTTP server closed');
          pool.end().then(() => {
            console.log('[shutdown] Database pool closed');
            process.exit(0);
          });
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          console.error('[shutdown] Forced shutdown — connections did not close in time');
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
