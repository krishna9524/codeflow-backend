const express = require('express');
const router = express.Router();
const { adminAuth } = require('../utils/authMiddleware');
const { 
    getAllTopics, 
    createTopic, 
    updateTopic, 
    deleteTopic 
} = require('../controllers/topicController');

// @route   GET api/topics
// @desc    Get all topics
router.get('/', adminAuth, getAllTopics);

// @route   POST api/topics
// @desc    Create a new topic
router.post('/', adminAuth, createTopic);

// @route   PUT api/topics/:id
// @desc    Update a topic
router.put('/:id', adminAuth, updateTopic);

// @route   DELETE api/topics/:id
// @desc    Delete a topic
router.delete('/:id', adminAuth, deleteTopic);

module.exports = router;