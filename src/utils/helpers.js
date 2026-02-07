const { v4: uuidv4 } = require('uuid');

// Generate unique IDs
const generateId = (prefix) => {
    const year = new Date().getFullYear();
    const uuid = uuidv4().split('-')[0].toUpperCase();
    return `${prefix}-${year}-${uuid}`;
};

// Pagination helper
const getPagination = (page = 1, limit = 10) => {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    return { page: pageNum, limit: limitNum, offset };
};

// Create pagination response
const paginatedResponse = (data, total, page, limit) => {
    return {
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        }
    };
};

// Format date for MySQL
const formatDateForDB = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

// Sanitize search query
const sanitizeSearch = (query) => {
    if (!query) return '';
    return query.replace(/[%_]/g, '\\$&');
};

module.exports = {
    generateId,
    getPagination,
    paginatedResponse,
    formatDateForDB,
    sanitizeSearch
};
