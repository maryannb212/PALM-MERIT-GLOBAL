import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Handle CEO Admin login using environment credentials
 */
export const ceoLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Strict Input Validation: Block blank or missing credentials
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Officer username and password are required' });
    }

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (trimmedUser === '' || trimmedPass === '') {
      return res.status(400).json({ message: 'Officer username and password cannot be empty' });
    }

    // Strict Server Configuration Check: Default to 'admin'/'admin123' only if they are not defined.
    // If they are explicitly defined as empty strings in env, reject and throw configuration alert.
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();

    if (adminUsername === '' || adminPassword === '') {
      console.error('[SECURITY ALERT] Administrative credentials are left blank in environment configurations!');
      return res.status(500).json({ message: 'Administrative authentication is currently offline. Please configure server credentials.' });
    }

    if (trimmedUser === adminUsername && trimmedPass === adminPassword) {
      // Create token
      const token = jwt.sign(
        { id: 'ceo-admin-id', role: 'admin' },
        process.env.JWT_SECRET || 'secret',
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
