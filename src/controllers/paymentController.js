const { pool } = require('../config/database');
const { generateId, getPagination, paginatedResponse, formatDateForDB, sanitizeSearch } = require('../utils/helpers');

// Get all payments
const getAllPayments = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { status, paymentType, studentId, startDate, endDate } = req.query;

        let query = `
            SELECT p.*, s.student_id as student_code, s.full_name as student_name
            FROM payments p
            LEFT JOIN students s ON p.student_id = s.id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM payments p WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND p.status = ?';
            countQuery += ' AND p.status = ?';
            params.push(status);
        }

        if (paymentType) {
            query += ' AND p.payment_type = ?';
            countQuery += ' AND p.payment_type = ?';
            params.push(paymentType);
        }

        if (studentId) {
            query += ' AND s.student_id = ?';
            countQuery += ' AND p.student_id = (SELECT id FROM students WHERE student_id = ?)';
            params.push(studentId);
        }

        if (startDate && endDate) {
            query += ' AND (p.paid_date BETWEEN ? AND ? OR p.due_date BETWEEN ? AND ?)';
            countQuery += ' AND (p.paid_date BETWEEN ? AND ? OR p.due_date BETWEEN ? AND ?)';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate), formatDateForDB(startDate), formatDateForDB(endDate));
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        const [payments] = await pool.query(query, [...params, limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                payments.map(p => ({
                    id: p.payment_id,
                    studentId: p.student_code,
                    studentName: p.student_name,
                    type: p.payment_type,
                    amount: p.amount,
                    currency: p.currency,
                    dueDate: p.due_date,
                    paidDate: p.paid_date,
                    paymentMethod: p.payment_method,
                    paymentReference: p.payment_reference,
                    status: p.status,
                    receipt: p.receipt_file,
                    notes: p.notes,
                    createdAt: p.created_at
                })),
                total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get all donations
const getAllDonations = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { status, donorId, startDate, endDate } = req.query;

        let query = `
            SELECT d.*, dn.donor_id as donor_code, dn.name as donor_name
            FROM donations d
            JOIN donors dn ON d.donor_id = dn.id
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM donations d WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND d.status = ?';
            countQuery += ' AND d.status = ?';
            params.push(status);
        }

        if (donorId) {
            query += ' AND dn.donor_id = ?';
            countQuery += ' AND d.donor_id = (SELECT id FROM donors WHERE donor_id = ?)';
            params.push(donorId);
        }

        if (startDate && endDate) {
            query += ' AND d.donation_date BETWEEN ? AND ?';
            countQuery += ' AND d.donation_date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY d.donation_date DESC LIMIT ? OFFSET ?';
        const [donations] = await pool.query(query, [...params, limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                donations.map(d => ({
                    id: d.donation_id,
                    donorId: d.donor_code,
                    donorName: d.donor_name,
                    amount: d.amount,
                    currency: d.currency,
                    purpose: d.purpose,
                    paymentMethod: d.payment_method,
                    date: d.donation_date,
                    status: d.status,
                    receipt: d.receipt_file,
                    notes: d.notes
                })),
                total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get donations error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Create payment
const createPayment = async (req, res) => {
    try {
        const { studentId, paymentType, amount, currency, dueDate, paidDate, paymentMethod, paymentReference, status, notes } = req.body;

        if (!amount || amount <= 0 || !paymentType) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount and payment type are required.'
            });
        }

        let studentDbId = null;

        if (studentId) {
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
            studentDbId = students[0].id;
        }

        const paymentId = generateId('PAY');

        await pool.query(
            `INSERT INTO payments (payment_id, student_id, payment_type, amount, currency, due_date, paid_date, payment_method, payment_reference, status, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [paymentId, studentDbId, paymentType, amount, currency || 'INR', formatDateForDB(dueDate), formatDateForDB(paidDate), paymentMethod || 'cash', paymentReference, status || 'pending', notes, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Payment created successfully.',
            data: { paymentId }
        });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { status, paidDate, paymentMethod, paymentReference, notes } = req.body;

        if (!status || !['paid', 'pending', 'failed', 'overdue', 'partial'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required.'
            });
        }

        const [result] = await pool.query(
            `UPDATE payments SET
             status = ?,
             paid_date = COALESCE(?, paid_date),
             payment_method = COALESCE(?, payment_method),
             payment_reference = COALESCE(?, payment_reference),
             notes = COALESCE(?, notes)
             WHERE payment_id = ?`,
            [status, formatDateForDB(paidDate), paymentMethod, paymentReference, notes, paymentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found.'
            });
        }

        res.json({
            success: true,
            message: 'Payment updated successfully.'
        });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update donation status
const updateDonationStatus = async (req, res) => {
    try {
        const { donationId } = req.params;
        const { status, notes } = req.body;

        if (!status || !['completed', 'pending', 'failed', 'refunded'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required.'
            });
        }

        const [result] = await pool.query(
            `UPDATE donations SET status = ?, notes = COALESCE(?, notes) WHERE donation_id = ?`,
            [status, notes, donationId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donation not found.'
            });
        }

        res.json({
            success: true,
            message: 'Donation updated successfully.'
        });
    } catch (error) {
        console.error('Update donation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get payment summary/stats
const getPaymentStats = async (req, res) => {
    try {
        const { startDate, endDate, month, year } = req.query;

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND (paid_date BETWEEN ? AND ? OR due_date BETWEEN ? AND ?)';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate), formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (month && year) {
            dateFilter = 'AND (MONTH(paid_date) = ? AND YEAR(paid_date) = ? OR MONTH(due_date) = ? AND YEAR(due_date) = ?)';
            params.push(parseInt(month), parseInt(year), parseInt(month), parseInt(year));
        }

        // Payment stats
        const [paymentStats] = await pool.query(`
            SELECT
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
                SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
                SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
            FROM payments
            WHERE 1=1 ${dateFilter}
        `, params);

        // Donation stats
        const [donationStats] = await pool.query(`
            SELECT
                COUNT(*) as total_donations,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_donated,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_donations
            FROM donations
            WHERE 1=1 ${dateFilter.replace(/paid_date|due_date/g, 'donation_date')}
        `, params.length ? params.slice(0, 2) : []);

        // Today's stats
        const [todayPayments] = await pool.query(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM payments
            WHERE paid_date = CURDATE() AND status = 'paid'
        `);

        const [todayDonations] = await pool.query(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM donations
            WHERE donation_date = CURDATE() AND status = 'completed'
        `);

        res.json({
            success: true,
            data: {
                payments: {
                    total: paymentStats[0].total_payments,
                    collected: paymentStats[0].total_collected || 0,
                    pending: paymentStats[0].total_pending || 0,
                    failed: paymentStats[0].total_failed || 0,
                    overdue: paymentStats[0].total_overdue || 0,
                    counts: {
                        paid: paymentStats[0].paid_count,
                        pending: paymentStats[0].pending_count,
                        failed: paymentStats[0].failed_count,
                        overdue: paymentStats[0].overdue_count
                    }
                },
                donations: {
                    total: donationStats[0].total_donations,
                    collected: donationStats[0].total_donated || 0,
                    pending: donationStats[0].pending_donations || 0
                },
                today: {
                    payments: {
                        count: todayPayments[0].count,
                        total: todayPayments[0].total || 0
                    },
                    donations: {
                        count: todayDonations[0].count,
                        total: todayDonations[0].total || 0
                    }
                }
            }
        });
    } catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get pending payments
const getPendingPayments = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM payments WHERE status IN ('pending', 'overdue')`
        );

        const [payments] = await pool.query(`
            SELECT p.*, s.student_id as student_code, s.full_name as student_name
            FROM payments p
            LEFT JOIN students s ON p.student_id = s.id
            WHERE p.status IN ('pending', 'overdue')
            ORDER BY p.due_date ASC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            success: true,
            ...paginatedResponse(
                payments.map(p => ({
                    id: p.payment_id,
                    studentId: p.student_code,
                    studentName: p.student_name,
                    type: p.payment_type,
                    amount: p.amount,
                    dueDate: p.due_date,
                    status: p.status,
                    notes: p.notes
                })),
                countResult[0].total,
                page,
                limit
            )
        });
    } catch (error) {
        console.error('Get pending payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getAllPayments,
    getAllDonations,
    createPayment,
    updatePaymentStatus,
    updateDonationStatus,
    getPaymentStats,
    getPendingPayments
};
