const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Payments - Admin and Finance can access
router.get('/payments', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.getAllPayments);
router.get('/payments/pending', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.getPendingPayments);
router.post('/payments', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.createPayment);
router.put('/payments/:paymentId', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.updatePaymentStatus);

// Donations
router.get('/donations', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.getAllDonations);
router.put('/donations/:donationId', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.updateDonationStatus);

// Stats
router.get('/stats', authorize(ROLES.ADMIN, ROLES.FINANCE), paymentController.getPaymentStats);

module.exports = router;
