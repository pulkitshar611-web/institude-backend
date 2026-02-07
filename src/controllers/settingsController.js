const { pool } = require('../config/database');

// Get all settings
const getSettings = async (req, res) => {
    try {
        const [settings] = await pool.query('SELECT * FROM system_settings');

        // Convert array to object
        const settingsObj = settings.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {});

        res.json({
            success: true,
            data: settingsObj
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

// Update settings
const updateSettings = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const settings = req.body;

        // Loop through keys and update
        for (const [key, value] of Object.entries(settings)) {
            // Check if key exists
            const [existing] = await connection.query(
                'SELECT id FROM system_settings WHERE setting_key = ?',
                [key]
            );

            if (existing.length > 0) {
                await connection.query(
                    'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
                    [String(value), req.user.id, key]
                );
            } else {
                await connection.query(
                    'INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)',
                    [key, String(value), req.user.id]
                );
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Settings updated successfully.'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    } finally {
        connection.release();
    }
};

// Upload Logo
const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const filePath = req.file.path.replace(/\\/g, '/'); // Normalize path

        // Update setting
        await pool.query(
            "INSERT INTO system_settings (setting_key, setting_value, updated_by) VALUES ('institution_logo', ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?",
            [filePath, req.user.id, filePath, req.user.id]
        );

        res.json({
            success: true,
            message: 'Logo uploaded successfully.',
            data: { path: filePath }
        });

    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
}

module.exports = {
    getSettings,
    updateSettings,
    uploadLogo
};
