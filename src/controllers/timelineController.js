const { pool } = require('../config/database');
const { getPagination, paginatedResponse, formatDateForDB } = require('../utils/helpers');

// Get student timeline
const getStudentTimeline = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { type, startDate, endDate } = req.query;

        // Get student internal id
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

        let query = 'SELECT * FROM student_timeline WHERE student_id = ?';
        let countQuery = 'SELECT COUNT(*) as total FROM student_timeline WHERE student_id = ?';
        const params = [students[0].id];

        if (type) {
            query += ' AND entry_type = ?';
            countQuery += ' AND entry_type = ?';
            params.push(type);
        }

        if (startDate && endDate) {
            query += ' AND entry_date BETWEEN ? AND ?';
            countQuery += ' AND entry_date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY entry_date DESC, created_at DESC LIMIT ? OFFSET ?';
        const [entries] = await pool.query(query, [...params, limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                entries.map(e => ({
                    id: e.id,
                    type: e.entry_type,
                    title: e.title,
                    description: e.description,
                    date: e.entry_date,
                    file: e.file_path,
                    createdAt: e.created_at
                })),
                total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get timeline error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Add timeline entry
const addTimelineEntry = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { type, title, description, date, filePath } = req.body;

        if (!type || !title) {
            return res.status(400).json({
                success: false,
                message: 'Type and title are required.'
            });
        }

        if (!['attendance', 'grade', 'event', 'note', 'document', 'letter'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid entry type.'
            });
        }

        // Get student internal id
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

        const [result] = await pool.query(
            `INSERT INTO student_timeline (student_id, entry_type, title, description, entry_date, file_path, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [students[0].id, type, title, description, formatDateForDB(date) || formatDateForDB(new Date()), filePath, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Timeline entry added successfully.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Add timeline entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update timeline entry
const updateTimelineEntry = async (req, res) => {
    try {
        const { entryId } = req.params;
        const { title, description, date, filePath } = req.body;

        const [result] = await pool.query(
            `UPDATE student_timeline SET
             title = COALESCE(?, title),
             description = COALESCE(?, description),
             entry_date = COALESCE(?, entry_date),
             file_path = COALESCE(?, file_path)
             WHERE id = ?`,
            [title, description, formatDateForDB(date), filePath, entryId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Timeline entry not found.'
            });
        }

        res.json({
            success: true,
            message: 'Timeline entry updated successfully.'
        });
    } catch (error) {
        console.error('Update timeline entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Delete timeline entry
const deleteTimelineEntry = async (req, res) => {
    try {
        const { entryId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM student_timeline WHERE id = ?',
            [entryId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Timeline entry not found.'
            });
        }

        res.json({
            success: true,
            message: 'Timeline entry deleted successfully.'
        });
    } catch (error) {
        console.error('Delete timeline entry error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getStudentTimeline,
    addTimelineEntry,
    updateTimelineEntry,
    deleteTimelineEntry
};
