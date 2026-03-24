// backend/routes/questionRoutes.js
const express = require('express');
const router = express.Router();
// FIX: Import adminAuth middleware
const { authMiddleware, adminAuth } = require('../utils/authMiddleware');
const {
    createQuestion,
    createBulkQuestions,
    getAllQuestions,
    getQuestionById,
    updateQuestion,
    deleteQuestion,
    // FIX: Import the new controller function
    getQuestionByIdForAdmin,
} = require('../controllers/questionController');

// --- Admin Routes ---
router.post('/', adminAuth, createQuestion);
router.post('/bulk', adminAuth, createBulkQuestions);
router.put('/:id', adminAuth, updateQuestion);
router.delete('/:id', adminAuth, deleteQuestion);
// FIX: Add the new admin-only route for getting full question details
router.get('/admin/:id', adminAuth, getQuestionByIdForAdmin);


// --- Public Routes ---
// These are accessed by regular users
router.get('/', getAllQuestions);
router.get('/:id', getQuestionById);

module.exports = router;