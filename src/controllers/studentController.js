const { pool } = require('../config/database');
const { generateId, getPagination, paginatedResponse, formatDateForDB, sanitizeSearch } = require('../utils/helpers');

// Get all students
const getAllStudents = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req.query.page, req.query.limit);
        const { search, class: studentClass, status, academicYear } = req.query;

        let query = 'SELECT * FROM students WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
        const params = [];

        if (search) {
            const searchTerm = `%${sanitizeSearch(search)}%`;
            query += ' AND (full_name LIKE ? OR student_id LIKE ? OR city LIKE ?)';
            countQuery += ' AND (full_name LIKE ? OR student_id LIKE ? OR city LIKE ?)';
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (studentClass) {
            query += ' AND class = ?';
            countQuery += ' AND class = ?';
            params.push(studentClass);
        }

        if (status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(status);
        }

        if (academicYear) {
            query += ' AND academic_year = ?';
            countQuery += ' AND academic_year = ?';
            params.push(academicYear);
        }

        // Get total count
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Get paginated results
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const [students] = await pool.query(query, [...params, limit, offset]);

        // Get parents for each student
        const studentsWithParents = await Promise.all(
            students.map(async (student) => {
                const [parents] = await pool.query(
                    'SELECT * FROM parents WHERE student_id = ?',
                    [student.id]
                );
                return {
                    id: student.student_id,
                    fullName: student.full_name,
                    dob: student.dob,
                    address: student.address,
                    city: student.city,
                    class: student.class,
                    academicYear: student.academic_year,
                    status: student.status,
                    healthDeclaration: student.health_declaration_file,
                    photo: student.photo,
                    father: parents.find(p => p.relation === 'father') ? {
                        name: parents.find(p => p.relation === 'father').full_name,
                        id: parents.find(p => p.relation === 'father').national_id,
                        dob: parents.find(p => p.relation === 'father').dob,
                        phone: parents.find(p => p.relation === 'father').phone,
                        email: parents.find(p => p.relation === 'father').email
                    } : null,
                    mother: parents.find(p => p.relation === 'mother') ? {
                        name: parents.find(p => p.relation === 'mother').full_name,
                        id: parents.find(p => p.relation === 'mother').national_id,
                        dob: parents.find(p => p.relation === 'mother').dob,
                        phone: parents.find(p => p.relation === 'mother').phone,
                        email: parents.find(p => p.relation === 'mother').email
                    } : null,
                    createdAt: student.created_at
                };
            })
        );

        res.json({
            success: true,
            ...paginatedResponse(studentsWithParents, total, page, limit)
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get single student
const getStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [students] = await pool.query(
            'SELECT * FROM students WHERE student_id = ?',
            [studentId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        const student = students[0];

        // Get parents
        const [parents] = await pool.query(
            'SELECT * FROM parents WHERE student_id = ?',
            [student.id]
        );

        // Get timeline
        const [timeline] = await pool.query(
            'SELECT * FROM student_timeline WHERE student_id = ? ORDER BY entry_date DESC',
            [student.id]
        );

        // Get attendance summary
        const [attendance] = await pool.query(
            `SELECT status, COUNT(*) as count FROM attendance
             WHERE student_id = ? GROUP BY status`,
            [student.id]
        );

        // Get grades
        const [grades] = await pool.query(
            'SELECT * FROM grades WHERE student_id = ? ORDER BY exam_date DESC LIMIT 10',
            [student.id]
        );

        // Get payments
        const [payments] = await pool.query(
            'SELECT * FROM payments WHERE student_id = ? ORDER BY created_at DESC LIMIT 10',
            [student.id]
        );

        res.json({
            success: true,
            data: {
                id: student.student_id,
                fullName: student.full_name,
                dob: student.dob,
                address: student.address,
                city: student.city,
                class: student.class,
                academicYear: student.academic_year,
                status: student.status,
                healthDeclaration: student.health_declaration_file,
                photo: student.photo,
                father: parents.find(p => p.relation === 'father') ? {
                    name: parents.find(p => p.relation === 'father').full_name,
                    id: parents.find(p => p.relation === 'father').national_id,
                    dob: parents.find(p => p.relation === 'father').dob,
                    phone: parents.find(p => p.relation === 'father').phone,
                    email: parents.find(p => p.relation === 'father').email,
                    idDocument: parents.find(p => p.relation === 'father').id_document_file
                } : null,
                mother: parents.find(p => p.relation === 'mother') ? {
                    name: parents.find(p => p.relation === 'mother').full_name,
                    id: parents.find(p => p.relation === 'mother').national_id,
                    dob: parents.find(p => p.relation === 'mother').dob,
                    phone: parents.find(p => p.relation === 'mother').phone,
                    email: parents.find(p => p.relation === 'mother').email,
                    idDocument: parents.find(p => p.relation === 'mother').id_document_file
                } : null,
                timeline: timeline.map(t => ({
                    id: t.id,
                    type: t.entry_type,
                    title: t.title,
                    description: t.description,
                    date: t.entry_date,
                    file: t.file_path
                })),
                attendanceSummary: attendance.reduce((acc, a) => {
                    acc[a.status] = a.count;
                    return acc;
                }, {}),
                recentGrades: grades.map(g => ({
                    subject: g.subject,
                    examType: g.exam_type,
                    score: g.score,
                    maxScore: g.max_score,
                    grade: g.grade,
                    date: g.exam_date
                })),
                recentPayments: payments.map(p => ({
                    id: p.payment_id,
                    type: p.payment_type,
                    amount: p.amount,
                    status: p.status,
                    date: p.paid_date || p.due_date
                })),
                createdAt: student.created_at
            }
        });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Create student
const createStudent = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { fullName, dob, address, city, class: studentClass, academicYear, father, mother } = req.body;

        if (!fullName || !dob) {
            return res.status(400).json({
                success: false,
                message: 'Full name and date of birth are required.'
            });
        }

        const studentId = generateId('STU');

        // Insert student
        const [result] = await connection.query(
            `INSERT INTO students (student_id, full_name, dob, address, city, class, academic_year, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [studentId, fullName, formatDateForDB(dob), address, city, studentClass, academicYear || '2025-2026', req.user.id]
        );

        const insertedId = result.insertId;

        // Insert father if provided
        if (father && father.name) {
            await connection.query(
                `INSERT INTO parents (student_id, relation, full_name, national_id, dob, phone, email)
                 VALUES (?, 'father', ?, ?, ?, ?, ?)`,
                [insertedId, father.name, father.id, formatDateForDB(father.dob), father.phone, father.email]
            );
        }

        // Insert mother if provided
        if (mother && mother.name) {
            await connection.query(
                `INSERT INTO parents (student_id, relation, full_name, national_id, dob, phone, email)
                 VALUES (?, 'mother', ?, ?, ?, ?, ?)`,
                [insertedId, mother.name, mother.id, formatDateForDB(mother.dob), mother.phone, mother.email]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Student created successfully.',
            data: { studentId }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Create student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    } finally {
        connection.release();
    }
};

// Update student
const updateStudent = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { studentId } = req.params;
        const { fullName, dob, address, city, class: studentClass, academicYear, status, father, mother } = req.body;

        // Check student exists
        const [students] = await connection.query(
            'SELECT id FROM students WHERE student_id = ?',
            [studentId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        const dbId = students[0].id;

        // Update student
        await connection.query(
            `UPDATE students SET
             full_name = COALESCE(?, full_name),
             dob = COALESCE(?, dob),
             address = COALESCE(?, address),
             city = COALESCE(?, city),
             class = COALESCE(?, class),
             academic_year = COALESCE(?, academic_year),
             status = COALESCE(?, status)
             WHERE student_id = ?`,
            [fullName, formatDateForDB(dob), address, city, studentClass, academicYear, status, studentId]
        );

        // Update or insert father
        if (father) {
            const [existingFather] = await connection.query(
                'SELECT id FROM parents WHERE student_id = ? AND relation = ?',
                [dbId, 'father']
            );

            if (existingFather.length > 0) {
                await connection.query(
                    `UPDATE parents SET full_name = ?, national_id = ?, dob = ?, phone = ?, email = ?
                     WHERE student_id = ? AND relation = 'father'`,
                    [father.name, father.id, formatDateForDB(father.dob), father.phone, father.email, dbId]
                );
            } else if (father.name) {
                await connection.query(
                    `INSERT INTO parents (student_id, relation, full_name, national_id, dob, phone, email)
                     VALUES (?, 'father', ?, ?, ?, ?, ?)`,
                    [dbId, father.name, father.id, formatDateForDB(father.dob), father.phone, father.email]
                );
            }
        }

        // Update or insert mother
        if (mother) {
            const [existingMother] = await connection.query(
                'SELECT id FROM parents WHERE student_id = ? AND relation = ?',
                [dbId, 'mother']
            );

            if (existingMother.length > 0) {
                await connection.query(
                    `UPDATE parents SET full_name = ?, national_id = ?, dob = ?, phone = ?, email = ?
                     WHERE student_id = ? AND relation = 'mother'`,
                    [mother.name, mother.id, formatDateForDB(mother.dob), mother.phone, mother.email, dbId]
                );
            } else if (mother.name) {
                await connection.query(
                    `INSERT INTO parents (student_id, relation, full_name, national_id, dob, phone, email)
                     VALUES (?, 'mother', ?, ?, ?, ?, ?)`,
                    [dbId, mother.name, mother.id, formatDateForDB(mother.dob), mother.phone, mother.email]
                );
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Student updated successfully.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    } finally {
        connection.release();
    }
};

// Delete student
const deleteStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM students WHERE student_id = ?',
            [studentId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        res.json({
            success: true,
            message: 'Student deleted successfully.'
        });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Mark attendance
const markAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { date, status, remarks } = req.body;

        if (!status || !['present', 'absent', 'late', 'excused'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (present, absent, late, excused).'
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

        const attendanceDate = formatDateForDB(date) || formatDateForDB(new Date());

        // Upsert attendance
        await pool.query(
            `INSERT INTO attendance (student_id, date, status, remarks, marked_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = ?, remarks = ?, marked_by = ?`,
            [students[0].id, attendanceDate, status, remarks, req.user.id, status, remarks, req.user.id]
        );

        // Add to timeline
        await pool.query(
            `INSERT INTO student_timeline (student_id, entry_type, title, description, entry_date, created_by)
             VALUES (?, 'attendance', ?, ?, ?, ?)`,
            [students[0].id, status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : status === 'late' ? 'Late' : 'Excused', remarks || 'Attendance marked', attendanceDate, req.user.id]
        );

        res.json({
            success: true,
            message: 'Attendance marked successfully.'
        });
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Add grade
const addGrade = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { subject, examType, score, maxScore, grade, examDate, remarks } = req.body;

        if (!subject || !examType) {
            return res.status(400).json({
                success: false,
                message: 'Subject and exam type are required.'
            });
        }

        // Get student internal id
        const [students] = await pool.query(
            'SELECT id, full_name FROM students WHERE student_id = ?',
            [studentId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        // Insert grade
        const [result] = await pool.query(
            `INSERT INTO grades (student_id, subject, exam_type, score, max_score, grade, exam_date, remarks, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [students[0].id, subject, examType, score, maxScore, grade, formatDateForDB(examDate), remarks, req.user.id]
        );

        // Add to timeline
        await pool.query(
            `INSERT INTO student_timeline (student_id, entry_type, title, description, entry_date, created_by)
             VALUES (?, 'grade', ?, ?, ?, ?)`,
            [students[0].id, `${subject} - ${examType}`, `Score: ${score}/${maxScore} (${grade})`, formatDateForDB(examDate) || formatDateForDB(new Date()), req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Grade added successfully.',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Add grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get attendance for a student
const getAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { startDate, endDate, month, year } = req.query;

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

        let query = 'SELECT * FROM attendance WHERE student_id = ?';
        const params = [students[0].id];

        if (startDate && endDate) {
            query += ' AND date BETWEEN ? AND ?';
            params.push(formatDateForDB(startDate), formatDateForDB(endDate));
        } else if (month && year) {
            query += ' AND MONTH(date) = ? AND YEAR(date) = ?';
            params.push(parseInt(month), parseInt(year));
        }

        query += ' ORDER BY date DESC';

        const [attendance] = await pool.query(query, params);

        res.json({
            success: true,
            data: attendance.map(a => ({
                date: a.date,
                status: a.status,
                remarks: a.remarks
            }))
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get grades for a student
const getGrades = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { subject, examType } = req.query;

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

        let query = 'SELECT * FROM grades WHERE student_id = ?';
        const params = [students[0].id];

        if (subject) {
            query += ' AND subject = ?';
            params.push(subject);
        }

        if (examType) {
            query += ' AND exam_type = ?';
            params.push(examType);
        }

        query += ' ORDER BY exam_date DESC';

        const [grades] = await pool.query(query, params);

        res.json({
            success: true,
            data: grades.map(g => ({
                id: g.id,
                subject: g.subject,
                examType: g.exam_type,
                score: g.score,
                maxScore: g.max_score,
                grade: g.grade,
                examDate: g.exam_date,
                testPhoto: g.test_photo_file,
                remarks: g.remarks
            }))
        });
    } catch (error) {
        console.error('Get grades error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    getAllStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    markAttendance,
    addGrade,
    getAttendance,
    getGrades
};
