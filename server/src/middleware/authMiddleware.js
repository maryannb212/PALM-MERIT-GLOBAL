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

      req.user = await findUserById(decoded.id);

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
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
