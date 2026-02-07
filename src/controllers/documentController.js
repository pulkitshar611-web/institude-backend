const { pool } = require('../config/database');
const { generateId, getPagination, paginatedResponse, sanitizeSearch } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');

// Get all documents
const getAllDocuments = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { search, type, studentId, donorId } = req.query;

        let query = `
            SELECT d.*, s.student_id as student_code, s.full_name as student_name,
            dn.donor_id as donor_code, dn.name as donor_name
            FROM documents d
            LEFT JOIN students s ON d.student_id = s.id
            LEFT JOIN donors dn ON d.donor_id = dn.id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM documents WHERE 1=1';
        const params = [];

        if (search) {
            const searchTerm = `%${sanitizeSearch(search)}%`;
            query += ' AND (d.title LIKE ? OR d.file_name LIKE ?)';
            countQuery += ' AND (title LIKE ? OR file_name LIKE ?)';
            params.push(searchTerm, searchTerm);
        }

        if (type) {
            query += ' AND d.document_type = ?';
            countQuery += ' AND document_type = ?';
            params.push(type);
        }

        if (studentId) {
            query += ' AND s.student_id = ?';
            countQuery += ' AND student_id = (SELECT id FROM students WHERE student_id = ?)';
            params.push(studentId);
        }

        if (donorId) {
            query += ' AND dn.donor_id = ?';
            countQuery += ' AND donor_id = (SELECT id FROM donors WHERE donor_id = ?)';
            params.push(donorId);
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY d.uploaded_at DESC LIMIT ? OFFSET ?';
        const [documents] = await pool.query(query, [...params, limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                documents.map(d => ({
                    id: d.document_id,
                    title: d.title,
                    type: d.document_type,
                    fileName: d.file_name,
                    fileSize: d.file_size,
                    mimeType: d.mime_type,
                    studentId: d.student_code,
                    studentName: d.student_name,
                    donorId: d.donor_code,
                    donorName: d.donor_name,
                    description: d.description,
                    uploadedAt: d.uploaded_at
                })),
                total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Upload document
const uploadDocument = async (req, res) => {
    try {
        const { title, type, studentId, donorId, description } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'File is required.'
            });
        }

        if (!title || !type) {
            return res.status(400).json({
                success: false,
                message: 'Title and type are required.'
            });
        }

        if (!['health_declaration', 'parent_id', 'donation_receipt', 'transfer_certificate', 'report_card', 'test_paper', 'letter', 'other'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid document type.'
            });
        }

        let studentDbId = null;
        let donorDbId = null;

        if (studentId) {
            const [students] = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId]);
            if (students.length > 0) studentDbId = students[0].id;
        }

        if (donorId) {
            const [donors] = await pool.query('SELECT id FROM donors WHERE donor_id = ?', [donorId]);
            if (donors.length > 0) donorDbId = donors[0].id;
        }

        const documentId = generateId('DOC');

        await pool.query(
            `INSERT INTO documents (document_id, title, document_type, file_path, file_name, file_size, mime_type, student_id, donor_id, description, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [documentId, title, type, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype, studentDbId, donorDbId, description, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully.',
            data: {
                documentId,
                fileName: req.file.originalname,
                fileSize: req.file.size
            }
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get document details
const getDocument = async (req, res) => {
    try {
        const { documentId } = req.params;

        const [documents] = await pool.query(
            `SELECT d.*, s.student_id as student_code, s.full_name as student_name,
             dn.donor_id as donor_code, dn.name as donor_name
             FROM documents d
             LEFT JOIN students s ON d.student_id = s.id
             LEFT JOIN donors dn ON d.donor_id = dn.id
             WHERE d.document_id = ?`,
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found.'
            });
        }

        const doc = documents[0];

        res.json({
            success: true,
            data: {
                id: doc.document_id,
                title: doc.title,
                type: doc.document_type,
                fileName: doc.file_name,
                fileSize: doc.file_size,
                mimeType: doc.mime_type,
                studentId: doc.student_code,
                studentName: doc.student_name,
                donorId: doc.donor_code,
                donorName: doc.donor_name,
                description: doc.description,
                uploadedAt: doc.uploaded_at
            }
        });
    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Download document
const downloadDocument = async (req, res) => {
    try {
        const { documentId } = req.params;

        const [documents] = await pool.query(
            'SELECT file_path, file_name FROM documents WHERE document_id = ?',
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found.'
            });
        }

        const filePath = path.join(process.env.UPLOAD_PATH || './uploads', documents[0].file_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server.'
            });
        }

        res.download(filePath, documents[0].file_name);
    } catch (error) {
        console.error('Download document error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Delete document
const deleteDocument = async (req, res) => {
    try {
        const { documentId } = req.params;

        const [documents] = await pool.query(
            'SELECT file_path FROM documents WHERE document_id = ?',
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found.'
            });
        }

        // Delete file from disk
        const filePath = path.join(process.env.UPLOAD_PATH || './uploads', documents[0].file_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        await pool.query('DELETE FROM documents WHERE document_id = ?', [documentId]);

        res.json({
            success: true,
            message: 'Document deleted successfully.'
        });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get student documents
const getStudentDocuments = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { type } = req.query;

        const [students] = await pool.query(
            'SELECT id FROM students WHERE student_id = ?',
            [studentId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        let query = 'SELECT * FROM documents WHERE student_id = ?';
        const params = [students[0].id];

        if (type) {
            query += ' AND document_type = ?';
            params.push(type);
        }

        query += ' ORDER BY uploaded_at DESC';

        const [documents] = await pool.query(query, params);

        res.json({
            success: true,
            data: documents.map(d => ({
                id: d.document_id,
                title: d.title,
                type: d.document_type,
                fileName: d.file_name,
                fileSize: d.file_size,
                description: d.description,
                uploadedAt: d.uploaded_at
            }))
        });
    } catch (error) {
        console.error('Get student documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get donor documents
const getDonorDocuments = async (req, res) => {
    try {
        const { donorId } = req.params;

        const [donors] = await pool.query(
            'SELECT id FROM donors WHERE donor_id = ?',
            [donorId]
        );

        if (donors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donor not found.'
            });
        }

        const [documents] = await pool.query(
            'SELECT * FROM documents WHERE donor_id = ? ORDER BY uploaded_at DESC',
            [donors[0].id]
        );

        res.json({
            success: true,
            data: documents.map(d => ({
                id: d.document_id,
                title: d.title,
                type: d.document_type,
                fileName: d.file_name,
                fileSize: d.file_size,
                description: d.description,
                uploadedAt: d.uploaded_at
            }))
        });
    } catch (error) {
        console.error('Get donor documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getAllDocuments,
    uploadDocument,
    getDocument,
    downloadDocument,
    deleteDocument,
    getStudentDocuments,
    getDonorDocuments
};
