const { validationResult } = require('express-validator');
const Course = require('../models/Course');
const Topic = require('../models/Topic');
const Question = require('../models/Question');

exports.createCourse = async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, imageUrl } = req.body;
    try {
        const newCourse = new Course({ title, description, imageUrl });
        const course = await newCourse.save();
        res.status(201).json(course);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateCourse = async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!course) return res.status(404).json({ msg: 'Course not found' });
        res.json(course);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ msg: 'Course not found' });

        // Cascade delete: remove all topics and questions associated with this course
        await Topic.deleteMany({ course: req.params.id });
        await Question.deleteMany({ course: req.params.id });

        await course.deleteOne();
        res.json({ msg: 'Course and all associated content removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getCourseWithDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        const topics = await Topic.find({ course: req.params.id }).sort('title');
        const topicIds = topics.map(t => t._id);

        // THE FIX IS HERE: We must explicitly include '_id' in the select() statement.
        const questions = await Question.find({ topic: { $in: topicIds } })
            .select('_id title difficulty topic'); // <-- ADD '_id' HERE
        
        // Structure the data by nesting problems within their topics
        const populatedTopics = topics.map(topic => ({
            ...topic.toObject(),
            problems: questions.filter(q => q.topic.toString() === topic._id.toString())
        }));

        res.json({ course, topics: populatedTopics });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
