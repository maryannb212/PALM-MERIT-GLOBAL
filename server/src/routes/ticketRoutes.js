import express from 'express';
import { createTicket, getMyTickets, getTicketById } from '../controllers/ticketController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, createTicket).get(protect, getMyTickets);
router.route('/:id').get(protect, getTicketById);

export default router;
