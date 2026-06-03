// server/src/middleware/authMiddleware.js

/**
 * Authentication and Role‑Based Access Control Middleware
 * -----------------------------------------------------
 * This middleware verifies the Firebase ID token (or any JWT) sent via the
 * `Authorization: Bearer <token>` header and attaches the decoded user payload
 * to `req.user`. It also provides a helper `requireRoles(...allowedRoles)` that
 * can be used in route definitions to restrict access based on the user's role.
 *
 * The platform already uses Firebase for authentication (`firebaseAdmin`).
 * If the project uses a different JWT secret, replace the verification logic
 * accordingly.
 */

import { firebaseAdmin } from '../config/firebaseAdmin.js'; // Adjust path if needed

/** Verify Firebase ID token and attach user info */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Missing auth token' });
    }
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    // Expected payload contains at least uid and custom claims like `role`
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || 'STANDARD_USER',
    };
    next();
  } catch (err) {
    console.error('[authMiddleware] Token verification failed', err);
    return res.status(401).json({ error: 'Invalid auth token' });
  }
};

/**
 * Role guard – usage in routes:
 *   router.get('/finance/summary', verifyToken, requireRoles('SUPER_ADMIN', 'FINANCE_ACCOUNTANT'), handler);
 */
export const requireRoles = (...allowedRoles) => {
  const permitted = new Set(allowedRoles);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!permitted.has(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
};
