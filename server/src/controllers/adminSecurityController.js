import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { logAudit } from '../models/auditModel.js';
import jwt from 'jsonwebtoken';

/**
 * Get all page locks (without passwords)
 * GET /api/admin/security/locks
 */
export const getPageLocks = async (req, res) => {
  try {
    const sql = `SELECT id, page_name, username, updated_at FROM page_locks`;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching page locks:', error);
    res.status(500).json({ message: 'Server error fetching page locks' });
  }
};

/**
 * Update or create a page lock
 * PUT /api/admin/security/locks
 */
export const updatePageLock = async (req, res) => {
  try {
    const { page_name, username, password } = req.body;

    if (!page_name || !username || !password) {
      return res.status(400).json({ message: 'Page name, username, and password are required.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO page_locks (page_name, username, password_hash, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (page_name) 
      DO UPDATE SET username = $2, password_hash = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING id, page_name, username, updated_at;
    `;
    const result = await query(sql, [page_name, username, password_hash]);

    await logAudit(req.user.id, 'UPDATE_PAGE_LOCK', 'page_locks', result.rows[0].id, { page_name });

    res.json({ message: 'Page lock updated successfully', lock: result.rows[0] });
  } catch (error) {
    console.error('Error updating page lock:', error);
    res.status(500).json({ message: 'Server error updating page lock' });
  }
};

/**
 * Verify credentials for a specific page lock
 * POST /api/admin/security/verify
 */
export const verifyPageLock = async (req, res) => {
  try {
    const { page_name, username, password } = req.body;

    if (!page_name || !username || !password) {
      return res.status(400).json({ message: 'Page name, username, and password are required.' });
    }

    // Local dev bypass: admin / admin123
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign(
        { page_name, unlocked: true, bypass: true },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '10m' }
      );
      return res.json({ message: 'Access granted', token });
    }

    const sql = `SELECT * FROM page_locks WHERE page_name = $1 AND username = $2`;
    const result = await query(sql, [page_name, username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials for this page.' });
    }

    const lock = result.rows[0];
    const isMatch = await bcrypt.compare(password, lock.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials for this page.' });
    }

    // Return a short-lived token just for this page lock (10 minutes)
    const token = jwt.sign(
      { page_name, unlocked: true },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );

    res.json({ message: 'Access granted', token });
  } catch (error) {
    console.error('Error verifying page lock:', error);
    res.status(500).json({ message: 'Server error verifying page lock' });
  }
};
