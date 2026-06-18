import { query } from '../config/db.js';

/**
 * Log an admin action
 */
export const logAudit = async (adminId, action, entityType, entityId, details) => {
  try {
    // Skip audit logging if adminId is not a valid UUID (e.g. CEO 'ceo-admin-id')
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(adminId)) {
      console.info(`[Audit] Skipping DB log for non-UUID admin: ${adminId} | action: ${action}`);
      return null;
    }

    // Also validate entityId is a valid UUID if provided
    const safeEntityId = (entityId && uuidRegex.test(entityId)) ? entityId : null;

    const sql = `
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(sql, [adminId, action, entityType, safeEntityId, JSON.stringify(details)]);
    return result.rows[0];
  } catch (err) {
    console.error('[Audit] Failed to write audit log (non-blocking):', err.message);
    return null;
  }
};


