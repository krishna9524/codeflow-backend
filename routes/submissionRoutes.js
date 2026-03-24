const express = require('express');
const router = express.Router();
const authMiddleware = require('../utils/authMiddleware');

const {
    submitCode,
    runCode,
    getSubmissionResult,
    getUserSubmissionsForQuestion,
    getMySubmissions,
} = require('../controllers/submissionController');

// --- FIX STARTS HERE ---
// Specific routes must be defined BEFORE general, parameterized routes.
// Otherwise, Express will mistake "run" for a :questionId or "user" for an :id.

// @route   POST /api/submissions/run
// @desc    Run code against sample test cases
router.post('/run', authMiddleware, runCode);

// @route   GET /api/submissions/user/question/:questionId
// @desc    Get all of a user's submissions for a problem
router.get('/user/question/:questionId', authMiddleware, getUserSubmissionsForQuestion);

// @route   POST /api/submissions/:questionId
// @desc    Submit final code for judging
router.post('/:questionId', authMiddleware, submitCode);

// @route   GET /api/submissions/:id
// @desc    Get the result of a specific submission
router.get('/:id', authMiddleware, getSubmissionResult);

// --- FIX ENDS HERE ---

module.exports = router;