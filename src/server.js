const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const donorRoutes = require('./routes/donorRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const timelineRoutes = require('./routes/timelineRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/finance', paymentRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Institute Management API is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds limit (10MB max)'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    // Test database connection
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.error('Failed to connect to database. Please check your configuration.');
        console.log('\nMake sure to:');
        console.log('1. Create a .env file based on .env.example');
        console.log('2. Run the database setup: npm run db:setup');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🏫 Institute Management System API                       ║
║                                                            ║
║   Server running on: http://localhost:${PORT}                ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                            ║
║   API Endpoints:                                           ║
║   • Auth:      /api/auth                                   ║
║   • Students:  /api/students                               ║
║   • Donors:    /api/donors                                 ║
║   • Finance:   /api/finance                                ║
║   • Timeline:  /api/timeline                               ║
║   • Calendar:  /api/calendar                               ║
║   • Documents: /api/documents                              ║
║   • Reports:   /api/reports                                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
        `);
    });
};

startServer();
