const { pool } = require('../config/database');
const { generateId, getPagination, paginatedResponse, formatDateForDB } = require('../utils/helpers');

// Get all events
const getAllEvents = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { type, startDate, endDate, month, year } = req.query;

        let query = 'SELECT * FROM calendar_events WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM calendar_events WHERE 1=1';
        const params = [];

        if (type) {
            query += ' AND event_type = ?';
            countQuery += ' AND event_type = ?';
            params.push(type);
        }

        if (startDate && endDate) {
            query += ' AND event_date BETWEEN ? AND ?';
            countQuery += ' AND event_date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (month && year) {
            query += ' AND MONTH(event_date) = ? AND YEAR(event_date) = ?';
            countQuery += ' AND MONTH(event_date) = ? AND YEAR(event_date) = ?';
            params.push(parseInt(month), parseInt(year));
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY event_date ASC LIMIT ? OFFSET ?';
        const [events] = await pool.query(query, [...params, limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                events.map(e => ({
                    id: e.event_id,
                    title: e.title,
                    description: e.description,
                    type: e.event_type,
                    date: e.event_date,
                    startTime: e.start_time,
                    endTime: e.end_time,
                    isAllDay: e.is_all_day,
                    isRecurring: e.is_recurring,
                    recurrencePattern: e.recurrence_pattern,
                    createdAt: e.created_at
                })),
                total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get single event
const getEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        const [events] = await pool.query(
            `SELECT ce.*, s.student_id as student_code, s.full_name as student_name,
             d.donor_id as donor_code, d.name as donor_name
             FROM calendar_events ce
             LEFT JOIN students s ON ce.related_student_id = s.id
             LEFT JOIN donors d ON ce.related_donor_id = d.id
             WHERE ce.event_id = ?`,
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found.'
            });
        }

        const event = events[0];

        res.json({
            success: true,
            data: {
                id: event.event_id,
                title: event.title,
                description: event.description,
                type: event.event_type,
                date: event.event_date,
                startTime: event.start_time,
                endTime: event.end_time,
                isAllDay: event.is_all_day,
                isRecurring: event.is_recurring,
                recurrencePattern: event.recurrence_pattern,
                relatedStudent: event.student_code ? {
                    id: event.student_code,
                    name: event.student_name
                } : null,
                relatedDonor: event.donor_code ? {
                    id: event.donor_code,
                    name: event.donor_name
                } : null,
                createdAt: event.created_at
            }
        });
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Create event
const createEvent = async (req, res) => {
    try {
        const { title, description, type, date, startTime, endTime, isAllDay, isRecurring, recurrencePattern, relatedStudentId, relatedDonorId } = req.body;

        if (!title || !type || !date) {
            return res.status(400).json({
                success: false,
                message: 'Title, type, and date are required.'
            });
        }

        if (!['school', 'academic', 'fundraiser', 'holiday', 'birthday', 'follow_up', 'reminder', 'other'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid event type.'
            });
        }

        let studentDbId = null;
        let donorDbId = null;

        if (relatedStudentId) {
            const [students] = await pool.query('SELECT id FROM students WHERE student_id = ?', [relatedStudentId]);
            if (students.length > 0) studentDbId = students[0].id;
        }

        if (relatedDonorId) {
            const [donors] = await pool.query('SELECT id FROM donors WHERE donor_id = ?', [relatedDonorId]);
            if (donors.length > 0) donorDbId = donors[0].id;
        }

        const eventId = generateId('EVT');

        await pool.query(
            `INSERT INTO calendar_events (event_id, title, description, event_type, event_date, start_time, end_time, is_all_day, is_recurring, recurrence_pattern, related_student_id, related_donor_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [eventId, title, description, type, formatDateForDB(date), startTime, endTime, isAllDay !== false, isRecurring || false, recurrencePattern, studentDbId, donorDbId, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Event created successfully.',
            data: { eventId }
        });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update event
const updateEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { title, description, type, date, startTime, endTime, isAllDay, isRecurring, recurrencePattern } = req.body;

        const [result] = await pool.query(
            `UPDATE calendar_events SET
             title = COALESCE(?, title),
             description = COALESCE(?, description),
             event_type = COALESCE(?, event_type),
             event_date = COALESCE(?, event_date),
             start_time = COALESCE(?, start_time),
             end_time = COALESCE(?, end_time),
             is_all_day = COALESCE(?, is_all_day),
             is_recurring = COALESCE(?, is_recurring),
             recurrence_pattern = COALESCE(?, recurrence_pattern)
             WHERE event_id = ?`,
            [title, description, type, formatDateForDB(date), startTime, endTime, isAllDay, isRecurring, recurrencePattern, eventId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found.'
            });
        }

        res.json({
            success: true,
            message: 'Event updated successfully.'
        });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Delete event
const deleteEvent = async (req, res) => {
    try {
        const { eventId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM calendar_events WHERE event_id = ?',
            [eventId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Event not found.'
            });
        }

        res.json({
            success: true,
            message: 'Event deleted successfully.'
        });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get upcoming events
const getUpcomingEvents = async (req, res) => {
    try {
        const { days = 7, type } = req.query;

        let query = `
            SELECT * FROM calendar_events
            WHERE event_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        `;
        const params = [parseInt(days)];

        if (type) {
            query += ' AND event_type = ?';
            params.push(type);
        }

        query += ' ORDER BY event_date ASC';

        const [events] = await pool.query(query, params);

        res.json({
            success: true,
            data: events.map(e => ({
                id: e.event_id,
                title: e.title,
                description: e.description,
                type: e.event_type,
                date: e.event_date,
                isAllDay: e.is_all_day
            }))
        });
    } catch (error) {
        console.error('Get upcoming events error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get upcoming birthdays
const getUpcomingBirthdays = async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Get students with birthdays in the next X days
        const [students] = await pool.query(`
            SELECT student_id, full_name, dob, class
            FROM students
            WHERE status = 'active'
            AND (
                DATE_FORMAT(dob, '%m-%d') BETWEEN DATE_FORMAT(CURDATE(), '%m-%d')
                AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), '%m-%d')
            )
            OR (
                DATE_FORMAT(CURDATE(), '%m-%d') > DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), '%m-%d')
                AND (
                    DATE_FORMAT(dob, '%m-%d') >= DATE_FORMAT(CURDATE(), '%m-%d')
                    OR DATE_FORMAT(dob, '%m-%d') <= DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL ? DAY), '%m-%d')
                )
            )
            ORDER BY DATE_FORMAT(dob, '%m-%d')
        `, [parseInt(days), parseInt(days), parseInt(days)]);

        res.json({
            success: true,
            data: students.map(s => ({
                studentId: s.student_id,
                name: s.full_name,
                dateOfBirth: s.dob,
                class: s.class,
                birthdayDate: `${new Date().getFullYear()}-${String(new Date(s.dob).getMonth() + 1).padStart(2, '0')}-${String(new Date(s.dob).getDate()).padStart(2, '0')}`
            }))
        });
    } catch (error) {
        console.error('Get birthdays error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Export to ICS format
const exportICS = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;

        let query = 'SELECT * FROM calendar_events WHERE 1=1';
        const params = [];

        if (startDate && endDate) {
            query += ' AND event_date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        }

        if (type) {
            query += ' AND event_type = ?';
            params.push(type);
        }

        const [events] = await pool.query(query, params);

        // Generate ICS content
        let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Institute Management System//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

        events.forEach(event => {
            const dateStr = event.event_date.toISOString().split('T')[0].replace(/-/g, '');
            icsContent += `BEGIN:VEVENT
UID:${event.event_id}@institute-management
DTSTART:${dateStr}
DTEND:${dateStr}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
CATEGORIES:${event.event_type.toUpperCase()}
END:VEVENT
`;
        });

        icsContent += 'END:VCALENDAR';

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename=events.ics');
        res.send(icsContent);
    } catch (error) {
        console.error('Export ICS error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getAllEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getUpcomingEvents,
    getUpcomingBirthdays,
    exportICS
};
