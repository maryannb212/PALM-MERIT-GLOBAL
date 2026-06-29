import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';

// Import extracted job logic
import { runDeductionJob } from '../jobs/deductionJob.js';
import { runMaturityCheck } from '../jobs/maturityCron.js';
import { runStaffDeactivation } from '../jobs/staffDeactivationJob.js';

const router = express.Router();

// Apply protect and admin middlewares to all routes in this file
router.use(protect, admin);

/**
 * Trigger Deduction Check
 */
router.post('/deductions', async (req, res) => {
  try {
    const result = await runDeductionJob();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger deduction check', error: error.message });
  }
});

/**
 * Trigger Maturity Check & Settlement
 */
router.post('/maturity', async (req, res) => {
  try {
    const result = await runMaturityCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger maturity check', error: error.message });
  }
});

/**
 * Trigger Staff Deactivation Check
 */
router.post('/staff-deactivation', async (req, res) => {
  try {
    const result = await runStaffDeactivation();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger staff deactivation', error: error.message });
  }
});

export default router;
