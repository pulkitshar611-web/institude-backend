const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Events - All authenticated users can view
router.get('/', verifyToken, calendarController.getAllEvents);
router.get('/upcoming', verifyToken, calendarController.getUpcomingEvents);
router.get('/birthdays', verifyToken, calendarController.getUpcomingBirthdays);
router.get('/export/ics', verifyToken, calendarController.exportICS);
router.get('/:eventId', verifyToken, calendarController.getEvent);

// Create/Update/Delete - Admin only
router.post('/', authorize(ROLES.ADMIN), calendarController.createEvent);
router.put('/:eventId', authorize(ROLES.ADMIN), calendarController.updateEvent);
router.delete('/:eventId', authorize(ROLES.ADMIN), calendarController.deleteEvent);

module.exports = router;
