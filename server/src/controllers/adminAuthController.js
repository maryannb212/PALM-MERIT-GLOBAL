import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Handle CEO Admin login using environment credentials
 */
export const ceoLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === adminUsername && password === adminPassword) {
      // Create token
      const token = jwt.sign(
        { id: 'ceo-admin-id', role: 'admin' },
        process.env.JWT_SECRET || 'supersecretkey_change_in_production',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        id: 'ceo-admin-id',
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@palmmerit.com',
        role: 'admin',
        token,
        requiresOTP: false
      });
    } else {
      res.status(401).json({ message: 'Invalid Admin Credentials' });
    }
  } catch (error) {
    console.error('Error in ceoLogin:', error);
    res.status(500).json({ message: 'Server error during admin login' });
  }
};
