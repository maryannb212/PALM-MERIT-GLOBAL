import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../models/notificationModel.js';

/**
 * Get notifications for the logged-in user
 */
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await getUserNotifications(userId);
    res.json(notifications);
  } catch (error) {
    console.error('Error in getMyNotifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

/**
 * Mark a notification as read
 */
export const readNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const notification = await markNotificationRead(id, userId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error in readNotification:', error);
    res.status(500).json({ message: 'Server error updating notification' });
  }
};

/**
 * Mark all notifications as read
 */
export const readAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    await markAllNotificationsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error in readAllNotifications:', error);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
};
