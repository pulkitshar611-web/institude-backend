const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const setupDatabase = async () => {
    let connection;

    try {
        // Connect without database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });

        console.log('Connected to MySQL server');

        // Read schema file
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        console.log('Executing schema...');
        await connection.query(schema);

        console.log('✅ Database setup completed successfully!');
        console.log('\nDefault users created:');
        console.log('  - admin@school.edu / password (Admin)');
        console.log('  - staff@school.edu / password (Staff)');
        console.log('  - finance@school.edu / password (Finance)');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

setupDatabase();
