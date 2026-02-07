const express = require('express');
const router = express.Router();
const donorController = require('../controllers/donorController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Donor CRUD - Admin and Finance can access
router.get('/', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.getAllDonors);
router.get('/follow-ups', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.getUpcomingFollowUps);
router.get('/:donorId', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.getDonor);
router.post('/', authorize(ROLES.ADMIN), donorController.createDonor);
router.put('/:donorId', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.updateDonor);
router.delete('/:donorId', authorize(ROLES.ADMIN), donorController.deleteDonor);

// Donations
router.post('/:donorId/donations', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.addDonation);
router.get('/:donorId/donations', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.getDonations);

// Student linking
router.post('/:donorId/link-student', authorize(ROLES.ADMIN), donorController.linkStudent);

// Follow-up
router.put('/:donorId/follow-up', authorize(ROLES.ADMIN, ROLES.FINANCE), donorController.updateFollowUp);

module.exports = router;
