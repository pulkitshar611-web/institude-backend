const { pool } = require('../config/database');
const { formatDateForDB } = require('../utils/helpers');

// Dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        // Total students
        const [studentsCount] = await pool.query(
            "SELECT COUNT(*) as total FROM students WHERE status = 'active'"
        );

        // Total donors
        const [donorsCount] = await pool.query(
            "SELECT COUNT(*) as total FROM donors WHERE status = 'active'"
        );

        // Total payments
        const [paymentsStats] = await pool.query(`
            SELECT
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
            FROM payments
        `);

        // Total donations
        const [donationsStats] = await pool.query(`
            SELECT SUM(amount) as total FROM donations WHERE status = 'completed'
        `);

        // Upcoming events (next 7 days)
        const [upcomingEvents] = await pool.query(`
            SELECT COUNT(*) as total FROM calendar_events
            WHERE event_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `);

        // Upcoming birthdays (next 30 days)
        const [upcomingBirthdays] = await pool.query(`
            SELECT COUNT(*) as total FROM students
            WHERE status = 'active'
            AND DATE_FORMAT(dob, '%m-%d') BETWEEN DATE_FORMAT(CURDATE(), '%m-%d')
            AND DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 30 DAY), '%m-%d')
        `);

        res.json({
            success: true,
            data: {
                totalStudents: studentsCount[0].total,
                totalDonors: donorsCount[0].total,
                totalMataraPayments: paymentsStats[0].total_collected || 0,
                pendingPayments: {
                    count: paymentsStats[0].pending_count || 0,
                    amount: paymentsStats[0].total_pending || 0
                },
                totalDonations: donationsStats[0].total || 0,
                upcomingEvents: upcomingEvents[0].total,
                upcomingBirthdays: upcomingBirthdays[0].total
            }
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Student report
const getStudentReport = async (req, res) => {
    try {
        const { class: studentClass, academicYear, status } = req.query;

        let query = `
            SELECT s.*,
                   (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'present') as present_days,
                   (SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'absent') as absent_days,
                   (SELECT AVG(score/max_score * 100) FROM grades g WHERE g.student_id = s.id) as avg_grade
            FROM students s
            WHERE 1=1
        `;
        const params = [];

        if (studentClass) {
            query += ' AND s.class = ?';
            params.push(studentClass);
        }

        if (academicYear) {
            query += ' AND s.academic_year = ?';
            params.push(academicYear);
        }

        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }

        query += ' ORDER BY s.full_name';

        const [students] = await pool.query(query, params);

        // Summary
        const summary = {
            totalStudents: students.length,
            byClass: {},
            byStatus: {}
        };

        students.forEach(s => {
            summary.byClass[s.class] = (summary.byClass[s.class] || 0) + 1;
            summary.byStatus[s.status] = (summary.byStatus[s.status] || 0) + 1;
        });

        res.json({
            success: true,
            data: {
                summary,
                students: students.map(s => ({
                    id: s.student_id,
                    name: s.full_name,
                    class: s.class,
                    academicYear: s.academic_year,
                    status: s.status,
                    presentDays: s.present_days || 0,
                    absentDays: s.absent_days || 0,
                    averageGrade: s.avg_grade ? parseFloat(s.avg_grade).toFixed(2) : null
                }))
            }
        });
    } catch (error) {
        console.error('Get student report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Attendance report
const getAttendanceReport = async (req, res) => {
    try {
        const { startDate, endDate, class: studentClass, month, year } = req.query;

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND a.date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (month && year) {
            dateFilter = 'AND MONTH(a.date) = ? AND YEAR(a.date) = ?';
            params.push(parseInt(month), parseInt(year));
        }

        let classFilter = '';
        if (studentClass) {
            classFilter = 'AND s.class = ?';
            params.push(studentClass);
        }

        // Overall summary
        const [summary] = await pool.query(`
            SELECT
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as total_present,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as total_absent,
                COUNT(CASE WHEN a.status = 'late' THEN 1 END) as total_late,
                COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as total_excused,
                COUNT(*) as total_records
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE 1=1 ${dateFilter} ${classFilter}
        `, params);

        // By class breakdown
        const [byClass] = await pool.query(`
            SELECT s.class,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
                COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
                COUNT(*) as total
            FROM attendance a
            JOIN students s ON a.student_id = s.id
            WHERE 1=1 ${dateFilter} ${classFilter}
            GROUP BY s.class
            ORDER BY s.class
        `, params);

        // Students with low attendance
        const [lowAttendance] = await pool.query(`
            SELECT s.student_id, s.full_name, s.class,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
                COUNT(*) as total_days,
                (COUNT(CASE WHEN a.status = 'present' THEN 1 END) / COUNT(*) * 100) as attendance_rate
            FROM students s
            LEFT JOIN attendance a ON s.id = a.student_id
            WHERE s.status = 'active' ${dateFilter.replace(/a\./g, '')} ${classFilter}
            GROUP BY s.id
            HAVING attendance_rate < 75 OR attendance_rate IS NULL
            ORDER BY attendance_rate ASC
            LIMIT 20
        `, params);

        res.json({
            success: true,
            data: {
                summary: {
                    present: summary[0].total_present || 0,
                    absent: summary[0].total_absent || 0,
                    late: summary[0].total_late || 0,
                    excused: summary[0].total_excused || 0,
                    total: summary[0].total_records || 0,
                    attendanceRate: summary[0].total_records > 0
                        ? ((summary[0].total_present / summary[0].total_records) * 100).toFixed(2)
                        : 0
                },
                byClass: byClass.map(c => ({
                    class: c.class,
                    present: c.present,
                    absent: c.absent,
                    total: c.total,
                    rate: ((c.present / c.total) * 100).toFixed(2)
                })),
                lowAttendanceStudents: lowAttendance.map(s => ({
                    studentId: s.student_id,
                    name: s.full_name,
                    class: s.class,
                    presentDays: s.present_days || 0,
                    totalDays: s.total_days || 0,
                    rate: s.attendance_rate ? parseFloat(s.attendance_rate).toFixed(2) : 0
                }))
            }
        });
    } catch (error) {
        console.error('Get attendance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Grade report
const getGradeReport = async (req, res) => {
    try {
        const { subject, examType, class: studentClass } = req.query;

        let filters = '';
        const params = [];

        if (subject) {
            filters += ' AND g.subject = ?';
            params.push(subject);
        }

        if (examType) {
            filters += ' AND g.exam_type = ?';
            params.push(examType);
        }

        if (studentClass) {
            filters += ' AND s.class = ?';
            params.push(studentClass);
        }

        // Subject-wise average
        const [bySubject] = await pool.query(`
            SELECT g.subject,
                AVG(g.score / g.max_score * 100) as avg_percentage,
                MAX(g.score / g.max_score * 100) as highest,
                MIN(g.score / g.max_score * 100) as lowest,
                COUNT(DISTINCT g.student_id) as student_count
            FROM grades g
            JOIN students s ON g.student_id = s.id
            WHERE 1=1 ${filters}
            GROUP BY g.subject
            ORDER BY avg_percentage DESC
        `, params);

        // Top performers
        const [topPerformers] = await pool.query(`
            SELECT s.student_id, s.full_name, s.class,
                AVG(g.score / g.max_score * 100) as avg_percentage
            FROM students s
            JOIN grades g ON s.id = g.student_id
            WHERE 1=1 ${filters}
            GROUP BY s.id
            ORDER BY avg_percentage DESC
            LIMIT 10
        `, params);

        // Students needing attention (below 50%)
        const [needingAttention] = await pool.query(`
            SELECT s.student_id, s.full_name, s.class,
                AVG(g.score / g.max_score * 100) as avg_percentage
            FROM students s
            JOIN grades g ON s.id = g.student_id
            WHERE 1=1 ${filters}
            GROUP BY s.id
            HAVING avg_percentage < 50
            ORDER BY avg_percentage ASC
            LIMIT 10
        `, params);

        res.json({
            success: true,
            data: {
                bySubject: bySubject.map(s => ({
                    subject: s.subject,
                    average: parseFloat(s.avg_percentage).toFixed(2),
                    highest: parseFloat(s.highest).toFixed(2),
                    lowest: parseFloat(s.lowest).toFixed(2),
                    studentCount: s.student_count
                })),
                topPerformers: topPerformers.map(s => ({
                    studentId: s.student_id,
                    name: s.full_name,
                    class: s.class,
                    average: parseFloat(s.avg_percentage).toFixed(2)
                })),
                needingAttention: needingAttention.map(s => ({
                    studentId: s.student_id,
                    name: s.full_name,
                    class: s.class,
                    average: parseFloat(s.avg_percentage).toFixed(2)
                }))
            }
        });
    } catch (error) {
        console.error('Get grade report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Payment report
const getPaymentReport = async (req, res) => {
    try {
        const { startDate, endDate, month, year, paymentType } = req.query;

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND (p.paid_date BETWEEN ? AND ? OR p.due_date BETWEEN ? AND ?)';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate), formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (month && year) {
            dateFilter = 'AND (MONTH(p.paid_date) = ? AND YEAR(p.paid_date) = ? OR MONTH(p.due_date) = ? AND YEAR(p.due_date) = ?)';
            params.push(parseInt(month), parseInt(year), parseInt(month), parseInt(year));
        }

        let typeFilter = '';
        if (paymentType) {
            typeFilter = 'AND p.payment_type = ?';
            params.push(paymentType);
        }

        // Summary
        const [summary] = await pool.query(`
            SELECT
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_collected,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
                SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
                SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) as total_overdue,
                COUNT(*) as total_count
            FROM payments p
            WHERE 1=1 ${dateFilter} ${typeFilter}
        `, params);

        // By payment type
        const [byType] = await pool.query(`
            SELECT payment_type,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as collected,
                SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
                COUNT(*) as count
            FROM payments p
            WHERE 1=1 ${dateFilter} ${typeFilter}
            GROUP BY payment_type
        `, params);

        // By payment method
        const [byMethod] = await pool.query(`
            SELECT payment_method,
                SUM(amount) as total,
                COUNT(*) as count
            FROM payments p
            WHERE status = 'paid' ${dateFilter} ${typeFilter}
            GROUP BY payment_method
        `, params);

        res.json({
            success: true,
            data: {
                summary: {
                    collected: summary[0].total_collected || 0,
                    pending: summary[0].total_pending || 0,
                    failed: summary[0].total_failed || 0,
                    overdue: summary[0].total_overdue || 0,
                    totalTransactions: summary[0].total_count || 0
                },
                byType: byType.map(t => ({
                    type: t.payment_type,
                    collected: t.collected || 0,
                    pending: t.pending || 0,
                    count: t.count
                })),
                byMethod: byMethod.map(m => ({
                    method: m.payment_method,
                    total: m.total || 0,
                    count: m.count
                }))
            }
        });
    } catch (error) {
        console.error('Get payment report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Donor report
const getDonorReport = async (req, res) => {
    try {
        const { startDate, endDate, year } = req.query;

        let dateFilter = '';
        const params = [];

        if (startDate && endDate) {
            dateFilter = 'AND d.donation_date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (year) {
            dateFilter = 'AND YEAR(d.donation_date) = ?';
            params.push(parseInt(year));
        }

        // Summary
        const [summary] = await pool.query(`
            SELECT
                COUNT(DISTINCT d.donor_id) as total_donors,
                SUM(d.amount) as total_donated,
                AVG(d.amount) as avg_donation,
                MAX(d.amount) as highest_donation,
                COUNT(*) as total_donations
            FROM donations d
            WHERE d.status = 'completed' ${dateFilter}
        `, params);

        // Top donors
        const [topDonors] = await pool.query(`
            SELECT dn.donor_id, dn.name, dn.email,
                SUM(d.amount) as total_donated,
                COUNT(*) as donation_count
            FROM donors dn
            JOIN donations d ON dn.id = d.donor_id
            WHERE d.status = 'completed' ${dateFilter}
            GROUP BY dn.id
            ORDER BY total_donated DESC
            LIMIT 10
        `, params);

        // By purpose
        const [byPurpose] = await pool.query(`
            SELECT purpose,
                SUM(amount) as total,
                COUNT(*) as count
            FROM donations d
            WHERE status = 'completed' ${dateFilter}
            GROUP BY purpose
            ORDER BY total DESC
        `, params);

        // Monthly trend
        const [monthlyTrend] = await pool.query(`
            SELECT
                DATE_FORMAT(donation_date, '%Y-%m') as month,
                SUM(amount) as total,
                COUNT(*) as count
            FROM donations d
            WHERE status = 'completed' ${dateFilter}
            GROUP BY DATE_FORMAT(donation_date, '%Y-%m')
            ORDER BY month
        `, params);

        res.json({
            success: true,
            data: {
                summary: {
                    totalDonors: summary[0].total_donors || 0,
                    totalDonated: summary[0].total_donated || 0,
                    averageDonation: summary[0].avg_donation ? parseFloat(summary[0].avg_donation).toFixed(2) : 0,
                    highestDonation: summary[0].highest_donation || 0,
                    totalDonations: summary[0].total_donations || 0
                },
                topDonors: topDonors.map(d => ({
                    donorId: d.donor_id,
                    name: d.name,
                    email: d.email,
                    totalDonated: d.total_donated,
                    donationCount: d.donation_count
                })),
                byPurpose: byPurpose.map(p => ({
                    purpose: p.purpose || 'General',
                    total: p.total,
                    count: p.count
                })),
                monthlyTrend: monthlyTrend.map(m => ({
                    month: m.month,
                    total: m.total,
                    count: m.count
                }))
            }
        });
    } catch (error) {
        console.error('Get donor report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getDashboardStats,
    getStudentReport,
    getAttendanceReport,
    getGradeReport,
    getPaymentReport,
    getDonorReport
};
