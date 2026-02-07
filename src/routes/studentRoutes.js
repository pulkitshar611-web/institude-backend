const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(verifyToken);

// Student CRUD - Admin and Staff can access
router.get('/', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.getAllStudents);
router.get('/:studentId', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.getStudent);
router.post('/', authorize(ROLES.ADMIN), studentController.createStudent);
router.put('/:studentId', authorize(ROLES.ADMIN), studentController.updateStudent);
router.delete('/:studentId', authorize(ROLES.ADMIN), studentController.deleteStudent);

// Attendance - Admin and Staff can mark
router.post('/:studentId/attendance', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.markAttendance);
router.get('/:studentId/attendance', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.getAttendance);

// Grades - Admin and Staff can manage
router.post('/:studentId/grades', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.addGrade);
router.get('/:studentId/grades', authorize(ROLES.ADMIN, ROLES.STAFF), studentController.getGrades);

module.exports = router;
