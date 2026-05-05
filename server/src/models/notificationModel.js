import { query } from '../config/db.js';

/**
 * Create a new notification
 */
export const createNotification = async (userId, type, title, message) => {
  const sql = `
    INSERT INTO notifications (user_id, type, title, message)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const result = await query(sql, [userId, type, title, message]);
  return result.rows[0];
};

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (userId) => {
  const sql = `
    SELECT * FROM notifications 
    WHERE user_id = $1 
    ORDER BY created_at DESC;
  `;
  const result = await query(sql, [userId]);
  return result.rows;
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId, userId) => {
  const sql = `
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE id = $1 AND user_id = $2
    RETURNING *;
  `;
  const result = await query(sql, [notificationId, userId]);
  return result.rows[0];
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsRead = async (userId) => {
  const sql = `
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE user_id = $1
    RETURNING *;
  `;
  const result = await query(sql, [userId]);
  return result.rows;
};
