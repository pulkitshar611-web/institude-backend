const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/profile', verifyToken, authController.getProfile);
router.put('/change-password', verifyToken, authController.changePassword);

// Admin only routes
router.post('/users', verifyToken, authorize(ROLES.ADMIN), authController.createUser);
router.get('/users', verifyToken, authorize(ROLES.ADMIN), authController.getAllUsers);
router.put('/users/:userId', verifyToken, authorize(ROLES.ADMIN), authController.updateUser);
router.delete('/users/:userId', verifyToken, authorize(ROLES.ADMIN), authController.deleteUser);

module.exports = router;
