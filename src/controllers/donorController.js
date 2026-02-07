const { pool } = require('../config/database');
const { generateId, getPagination, paginatedResponse, formatDateForDB, sanitizeSearch } = require('../utils/helpers');

// Get all donors
const getAllDonors = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { search, status } = req.query;

        let query = 'SELECT * FROM donors WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM donors WHERE 1=1';
        const params = [];

        if (search) {
            const searchTerm = `%${sanitizeSearch(search)}%`;
            query += ' AND (name LIKE ? OR donor_id LIKE ? OR email LIKE ? OR phone LIKE ?)';
            countQuery += ' AND (name LIKE ? OR donor_id LIKE ? OR email LIKE ? OR phone LIKE ?)';
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(status);
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const [donors] = await pool.query(query, [...params, limit, offset]);

        // Get donations count for each donor
        const donorsWithStats = await Promise.all(
            donors.map(async (donor) => {
                const [donations] = await pool.query(
                    `SELECT COUNT(*) as count, SUM(amount) as total FROM donations WHERE donor_id = ? AND status = 'completed'`,
                    [donor.id]
                );
                return {
                    id: donor.donor_id,
                    name: donor.name,
                    phone: donor.phone,
                    email: donor.email,
                    notes: donor.notes,
                    followUpDate: donor.follow_up_date,
                    status: donor.status,
                    donationsCount: donations[0].count || 0,
                    totalDonated: donations[0].total || 0,
                    createdAt: donor.created_at
                };
            })
        );

        res.json({
            success: true,
            ...paginatedResponse(donorsWithStats, total, page, limit)
        });
    } catch (error) {
        console.error('Get donors error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get single donor
const getDonor = async (req, res) => {
    try {
        const { donorId } = req.params;

        const [donors] = await pool.query(
            'SELECT * FROM donors WHERE donor_id = ?',
            [donorId]
        );

        if (donors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donor not found.'
            });
        }

        const donor = donors[0];

        // Get donations
        const [donations] = await pool.query(
            'SELECT * FROM donations WHERE donor_id = ? ORDER BY donation_date DESC',
            [donor.id]
        );

        // Get linked students
        const [links] = await pool.query(
            `SELECT s.student_id, s.full_name, s.class, dsl.sponsorship_type, dsl.start_date, dsl.end_date
             FROM donor_student_links dsl
             JOIN students s ON dsl.student_id = s.id
             WHERE dsl.donor_id = ?`,
            [donor.id]
        );

        res.json({
            success: true,
            data: {
                id: donor.donor_id,
                name: donor.name,
                phone: donor.phone,
                email: donor.email,
                address: donor.address,
                notes: donor.notes,
                followUpDate: donor.follow_up_date,
                status: donor.status,
                donations: donations.map(d => ({
                    id: d.donation_id,
                    amount: d.amount,
                    currency: d.currency,
                    purpose: d.purpose,
                    paymentMethod: d.payment_method,
                    date: d.donation_date,
                    status: d.status,
                    receipt: d.receipt_file
                })),
                linkedStudents: links.map(l => ({
                    studentId: l.student_id,
                    name: l.full_name,
                    class: l.class,
                    sponsorshipType: l.sponsorship_type,
                    startDate: l.start_date,
                    endDate: l.end_date
                })),
                createdAt: donor.created_at
            }
        });
    } catch (error) {
        console.error('Get donor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Create donor
const createDonor = async (req, res) => {
    try {
        const { name, phone, email, address, notes, followUpDate } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Donor name is required.'
            });
        }

        const donorId = generateId('DNR');

        await pool.query(
            `INSERT INTO donors (donor_id, name, phone, email, address, notes, follow_up_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [donorId, name, phone, email, address, notes, formatDateForDB(followUpDate), req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Donor created successfully.',
            data: { donorId }
        });
    } catch (error) {
        console.error('Create donor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update donor
const updateDonor = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { name, phone, email, address, notes, followUpDate, status } = req.body;

        const [result] = await pool.query(
            `UPDATE donors SET
             name = COALESCE(?, name),
             phone = COALESCE(?, phone),
             email = COALESCE(?, email),
             address = COALESCE(?, address),
             notes = COALESCE(?, notes),
             follow_up_date = COALESCE(?, follow_up_date),
             status = COALESCE(?, status)
             WHERE donor_id = ?`,
            [name, phone, email, address, notes, formatDateForDB(followUpDate), status, donorId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donor not found.'
            });
        }

        res.json({
            success: true,
            message: 'Donor updated successfully.'
        });
    } catch (error) {
        console.error('Update donor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Delete donor
const deleteDonor = async (req, res) => {
    try {
        const { donorId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM donors WHERE donor_id = ?',
            [donorId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donor not found.'
            });
        }

        res.json({
            success: true,
            message: 'Donor deleted successfully.'
        });
    } catch (error) {
        console.error('Delete donor error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Add donation
const addDonation = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { amount, currency, purpose, paymentMethod, paymentReference, donationDate, notes } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid donation amount is required.'
            });
        }

        // Get donor internal id
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

        const donationId = generateId('DON');

        await pool.query(
            `INSERT INTO donations (donation_id, donor_id, amount, currency, purpose, payment_method, payment_reference, donation_date, notes, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [donationId, donors[0].id, amount, currency || 'INR', purpose, paymentMethod || 'cash', paymentReference, formatDateForDB(donationDate) || formatDateForDB(new Date()), notes, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Donation added successfully.',
            data: { donationId }
        });
    } catch (error) {
        console.error('Add donation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get donations for a donor
const getDonations = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);

        // Get donor internal id
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

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM donations WHERE donor_id = ?',
            [donors[0].id]
        );

        const [donations] = await pool.query(
            `SELECT * FROM donations WHERE donor_id = ? ORDER BY donation_date DESC LIMIT ? OFFSET ?`,
            [donors[0].id, limit, offset]
        );

        res.json({
            success: true,
            ...paginatedResponse(
                donations.map(d => ({
                    id: d.donation_id,
                    amount: d.amount,
                    currency: d.currency,
                    purpose: d.purpose,
                    paymentMethod: d.payment_method,
                    paymentReference: d.payment_reference,
                    date: d.donation_date,
                    status: d.status,
                    receipt: d.receipt_file,
                    notes: d.notes
                })),
                countResult[0].total,
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

// Link donor to student
const linkStudent = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { studentId, sponsorshipType, startDate, endDate, notes } = req.body;

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required.'
            });
        }

        // Get donor internal id
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

        await pool.query(
            `INSERT INTO donor_student_links (donor_id, student_id, sponsorship_type, start_date, end_date, notes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE sponsorship_type = ?, start_date = ?, end_date = ?, notes = ?`,
            [donors[0].id, students[0].id, sponsorshipType, formatDateForDB(startDate), formatDateForDB(endDate), notes,
             sponsorshipType, formatDateForDB(startDate), formatDateForDB(endDate), notes]
        );

        res.json({
            success: true,
            message: 'Student linked successfully.'
        });
    } catch (error) {
        console.error('Link student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update follow-up date
const updateFollowUp = async (req, res) => {
    try {
        const { donorId } = req.params;
        const { followUpDate, notes } = req.body;

        if (!followUpDate) {
            return res.status(400).json({
                success: false,
                message: 'Follow-up date is required.'
            });
        }

        const updateFields = ['follow_up_date = ?'];
        const params = [formatDateForDB(followUpDate)];

        if (notes !== undefined) {
            updateFields.push('notes = ?');
            params.push(notes);
        }

        params.push(donorId);

        const [result] = await pool.query(
            `UPDATE donors SET ${updateFields.join(', ')} WHERE donor_id = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Donor not found.'
            });
        }

        res.json({
            success: true,
            message: 'Follow-up updated successfully.'
        });
    } catch (error) {
        console.error('Update follow-up error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get upcoming follow-ups
const getUpcomingFollowUps = async (req, res) => {
    try {
        const { days = 7 } = req.query;

        const [donors] = await pool.query(
            `SELECT donor_id, name, phone, email, notes, follow_up_date
             FROM donors
             WHERE follow_up_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
             AND status = 'active'
             ORDER BY follow_up_date ASC`,
            [parseInt(days)]
        );

        res.json({
            success: true,
            data: donors.map(d => ({
                id: d.donor_id,
                name: d.name,
                phone: d.phone,
                email: d.email,
                notes: d.notes,
                followUpDate: d.follow_up_date
            }))
        });
    } catch (error) {
        console.error('Get follow-ups error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getAllDonors,
    getDonor,
    createDonor,
    updateDonor,
    deleteDonor,
    addDonation,
    getDonations,
    linkStudent,
    updateFollowUp,
    getUpcomingFollowUps
};
