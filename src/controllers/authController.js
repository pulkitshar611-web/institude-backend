const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { generateId } = require('../utils/helpers');

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Contact administrator.'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful.',
            data: {
                token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone
                }
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login.'
        });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user.user_id,
                email: req.user.email,
                fullName: req.user.full_name,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Change password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters.'
            });
        }

        // Get user with password
        const [users] = await pool.query(
            'SELECT password FROM users WHERE id = ?',
            [req.user.id]
        );

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, users[0].password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect.'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Create user (Admin only)
const createUser = async (req, res) => {
    try {
        const { email, password, fullName, role, phone } = req.body;

        if (!email || !password || !fullName || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, full name, and role are required.'
            });
        }

        if (!['admin', 'staff', 'finance'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Allowed: admin, staff, finance.'
            });
        }

        // Check if email exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId('USR');

        // Create user
        await pool.query(
            `INSERT INTO users (user_id, email, password, full_name, role, phone)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, email, hashedPassword, fullName, role, phone]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: { userId, email, fullName, role }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT user_id, email, full_name, role, phone, is_active, last_login, created_at
             FROM users ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            data: users.map(u => ({
                id: u.user_id,
                email: u.email,
                fullName: u.full_name,
                role: u.role,
                phone: u.phone,
                isActive: u.is_active,
                lastLogin: u.last_login,
                createdAt: u.created_at
            }))
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update user (Admin only)
const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, role, phone, isActive } = req.body;

        const [users] = await pool.query(
            'SELECT id FROM users WHERE user_id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        await pool.query(
            `UPDATE users SET full_name = COALESCE(?, full_name),
             role = COALESCE(?, role), phone = COALESCE(?, phone),
             is_active = COALESCE(?, is_active) WHERE user_id = ?`,
            [fullName, role, phone, isActive, userId]
        );

        res.json({
            success: true,
            message: 'User updated successfully.'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Delete user (Admin only)
const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent self-deletion
        if (req.user.user_id === userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account.'
            });
        }

        const [result] = await pool.query(
            'DELETE FROM users WHERE user_id = ?',
            [userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully.'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

module.exports = {
    login,
    getProfile,
    changePassword,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser
};
