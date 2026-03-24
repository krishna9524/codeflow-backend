const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { adminAuth } = require('../utils/authMiddleware');

// UPDATED: Add getCourseWithDetails to the import list
const { 
    createCourse, 
    getAllCourses, 
    updateCourse, 
    deleteCourse,
    getCourseWithDetails 
} = require('../controllers/courseController');

router.post(
    '/', 
    [ adminAuth, check('title', 'Title is required').not().isEmpty() ], 
    createCourse
);

router.get('/', getAllCourses);

router.put(
    '/:id',
    [ adminAuth, check('title', 'Title is required').not().isEmpty() ],
    updateCourse
);

router.delete('/:id', adminAuth, deleteCourse);

// This route will now work correctly
router.get('/:id', getCourseWithDetails);

module.exports = router;