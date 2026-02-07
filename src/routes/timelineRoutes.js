const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timelineController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Timeline - Admin and Staff can access
router.get('/student/:studentId', authorize(ROLES.ADMIN, ROLES.STAFF), timelineController.getStudentTimeline);
router.post('/student/:studentId', authorize(ROLES.ADMIN, ROLES.STAFF), timelineController.addTimelineEntry);
router.put('/:entryId', authorize(ROLES.ADMIN, ROLES.STAFF), timelineController.updateTimelineEntry);
router.delete('/:entryId', authorize(ROLES.ADMIN), timelineController.deleteTimelineEntry);

module.exports = router;
