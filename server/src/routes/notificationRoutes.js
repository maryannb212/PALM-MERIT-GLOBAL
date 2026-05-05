import express from 'express';
import { getMyNotifications, readNotification, readAllNotifications } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getMyNotifications);
router.put('/:id/read', readNotification);
router.put('/read-all', readAllNotifications);

export default router;
