import jsonwebtoken from 'jsonwebtoken';
import { findUserById } from '../models/userModel.js';
import dotenv from 'dotenv';

dotenv.config();

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET || 'secret');

      // Handle CEO admin token (uses string ID, not in database)
      if (decoded.id === 'ceo-admin-id' && decoded.role === 'admin') {
        req.user = {
          id: 'ceo-admin-id',
          first_name: 'System',
          last_name: 'Admin',
          email: 'admin@palmmerit.com',
          role: 'admin',
          has_paid_membership: true,
          kyc_status: 'verified'
        };
        return next();
      }

      req.user = await findUserById(decoded.id);

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

export const checkMembership = (req, res, next) => {
  if (req.user && (req.user.has_paid_membership || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ 
      message: 'Membership fee required', 
      requiresMembership: true 
    });
  }
};
