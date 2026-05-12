import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

router.get('/db', async (req, res) => {
  const startTime = Date.now();
  try {
    // Test DB connection
    const dbRes = await query('SELECT NOW() as now, version()');
    const duration = Date.now() - startTime;

    res.status(200).json({
      status: 'UP',
      database: {
        connected: true,
        responseTimeMs: duration,
        timestamp: dbRes.rows[0].now,
        version: dbRes.rows[0].version
      },
      system: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health Check Failure:', error.message);
    res.status(500).json({
      status: 'DOWN',
      error: process.env.NODE_ENV === 'production' ? 'Database connection failed' : error.message,
      system: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
