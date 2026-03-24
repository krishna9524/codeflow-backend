const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // Ensure this points to your correct auth middleware file
const { getAiHelp } = require('../controllers/aiController');

// @route   POST /api/ai/help
// @desc    Get AI assistance for a code snippet
// @access  Private
router.post('/help', authMiddleware, getAiHelp);

module.exports = router;