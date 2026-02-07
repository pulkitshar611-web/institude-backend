const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(verifyToken);

// Get settings - All authenticated users can view
router.get('/', settingsController.getSettings);

// Update settings - Admin only
router.put('/', authorize(ROLES.ADMIN), settingsController.updateSettings);

// Upload logo
router.post('/logo', authorize(ROLES.ADMIN), upload.single('logo'), settingsController.uploadLogo);

module.exports = router;
