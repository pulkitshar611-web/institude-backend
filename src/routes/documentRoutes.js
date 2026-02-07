const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { verifyToken, authorize, ROLES } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(verifyToken);

// Documents - Admin and Staff can access
router.get('/', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.FINANCE), documentController.getAllDocuments);
router.get('/:documentId', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.FINANCE), documentController.getDocument);
router.get('/:documentId/download', authorize(ROLES.ADMIN, ROLES.STAFF, ROLES.FINANCE), documentController.downloadDocument);

// Upload - Admin and Staff can upload
router.post('/', authorize(ROLES.ADMIN, ROLES.STAFF), upload.single('file'), documentController.uploadDocument);

// Delete - Admin only
router.delete('/:documentId', authorize(ROLES.ADMIN), documentController.deleteDocument);

// Get documents by entity
router.get('/student/:studentId', authorize(ROLES.ADMIN, ROLES.STAFF), documentController.getStudentDocuments);
router.get('/donor/:donorId', authorize(ROLES.ADMIN, ROLES.FINANCE), documentController.getDonorDocuments);

module.exports = router;
