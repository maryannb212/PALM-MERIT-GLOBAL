import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';

// Import extracted job logic
import { applyDailyInterest } from '../services/interestEngine.js';
import { runPenaltyCheck } from '../jobs/penaltyJob.js';
import { runDeductionJob } from '../jobs/deductionJob.js';
import { runMaturityCheck } from '../jobs/maturityCron.js';
import { runStaffDeactivation } from '../jobs/staffDeactivationJob.js';

const router = express.Router();

// Apply protect and admin middlewares to all routes in this file
router.use(protect, admin);

/**
 * Trigger Daily Interest Calculation
 */
router.post('/interest', async (req, res) => {
  try {
    await applyDailyInterest();
    res.json({ message: 'Daily interest calculation triggered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger interest calculation', error: error.message });
  }
});

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
 * Trigger Penalty Check
 */
router.post('/penalties', async (req, res) => {
  try {
    const result = await runPenaltyCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger penalty check', error: error.message });
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
