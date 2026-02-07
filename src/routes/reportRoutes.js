const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Dashboard - All authenticated users
router.get('/dashboard', verifyToken, reportController.getDashboardStats);

// Student & Attendance reports - Admin and Staff
router.get('/students', authorize(ROLES.ADMIN, ROLES.STAFF), reportController.getStudentReport);
router.get('/attendance', authorize(ROLES.ADMIN, ROLES.STAFF), reportController.getAttendanceReport);
router.get('/grades', authorize(ROLES.ADMIN, ROLES.STAFF), reportController.getGradeReport);

// Payment & Donor reports - Admin and Finance
router.get('/payments', authorize(ROLES.ADMIN, ROLES.FINANCE), reportController.getPaymentReport);
router.get('/donors', authorize(ROLES.ADMIN, ROLES.FINANCE), reportController.getDonorReport);

module.exports = router;
