import express from 'express';
import {
  authAdmin,
  registerAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  getAdmins,
} from '../controllers/auth.controller.js';
import { protect, superAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, superAdmin, registerAdmin)
  .get(protect, superAdmin, getAdmins);
router.post('/logout', logoutAdmin);
router.post('/login', authAdmin);
router
  .route('/profile')
  .get(protect, getAdminProfile)
  .put(protect, updateAdminProfile);

export default router;