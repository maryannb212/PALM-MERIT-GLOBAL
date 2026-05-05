import { query } from '../config/db.js';

/**
 * Log an admin action
 */
export const logAudit = async (adminId, action, entityType, entityId, details) => {
  const sql = `
    INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const result = await query(sql, [adminId, action, entityType, entityId, JSON.stringify(details)]);
  return result.rows[0];
};

/**
 * Get all audit logs
 */
export const getAllAuditLogs = async () => {
  const sql = `
    SELECT a.*, u.first_name, u.last_name, u.email 
    FROM audit_logs a
    JOIN users u ON a.admin_id = u.id
    ORDER BY a.created_at DESC;
  `;
  const result = await query(sql);
  return result.rows;
};
