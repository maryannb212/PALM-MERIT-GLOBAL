import express from 'express';
import { 
  getAllAmbassadors, 
  createAmbassador, 
  updateAmbassador, 
  deleteAmbassador 
} from '../controllers/ambassadorController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route
router.get('/', getAllAmbassadors);

// Admin routes
router.post('/', protect, admin, createAmbassador);
router.put('/:id', protect, admin, updateAmbassador);
router.delete('/:id', protect, admin, deleteAmbassador);

export default router;
