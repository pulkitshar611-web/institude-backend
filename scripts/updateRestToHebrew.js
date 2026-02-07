const { pool } = require('../src/config/database');

const updateRestToHebrew = async () => {
    try {
        console.log('Connecting to database...');
        const connection = await pool.getConnection();
        console.log('Connected!');

        const queries = [
            // Users
            "UPDATE users SET full_name = 'מנהל מערכת' WHERE email = 'admin@school.edu'",
            "UPDATE users SET full_name = 'חבר צוות' WHERE email = 'staff@school.edu'",
            "UPDATE users SET full_name = 'מנהל כספים' WHERE email = 'finance@school.edu'",

            // System Settings
            "UPDATE system_settings SET setting_value = 'מערכת ניהול מוסד' WHERE setting_key = 'institution_name'",

            // Donations
            "UPDATE donations SET purpose = 'שדרוג ספרי ספרייה' WHERE purpose = 'Library Books Upgrade'",
            "UPDATE donations SET purpose = 'חגיגת יום העצמאות' WHERE purpose = 'Independence Day Celebration'",
            "UPDATE donations SET purpose = 'קרן מלגות' WHERE purpose = 'Scholarship Fund'",

            // Calendar Events
            "UPDATE calendar_events SET title = 'יום ספורט שנתי', description = 'כל הכיתות להתאסף במגרש המשחקים עד השעה 8 בבוקר.' WHERE title = 'Annual Sports Day'",
            "UPDATE calendar_events SET title = 'אספת הורים', description = 'סקירת תוצאות אמצע סמסטר.' WHERE title = 'Parent Teacher Meeting'",
            "UPDATE calendar_events SET title = 'ערב גאלה לתורמים', description = 'אירוע למוזמנים בלבד לתורמים מובילים.' WHERE title = 'Donor Gala Dinner'"
        ];

        for (const query of queries) {
            await connection.query(query);
            console.log('Executed update.');
        }

        console.log('All remaining English data updated to Hebrew successfully.');
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('Error updating data:', error);
        process.exit(1);
    }
};

updateRestToHebrew();
