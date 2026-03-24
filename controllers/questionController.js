// backend/controllers/questionController.js
const Question = require('../models/Question');
const Course = require('../models/Course');
const Topic = require('../models/Topic');

exports.createQuestion = async (req, res) => {
    try {
        const newQuestion = new Question({
            ...req.body,
            createdBy: req.user.id
        });
        const question = await newQuestion.save();
        res.status(201).json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await Question.find()
            .populate('course', 'title')
            .populate('topic', 'title')
            // Keep hiding solutions from the main list to keep the payload light
            .select('-hiddenTestCases -solutions') 
            .sort({ createdAt: -1 });
        res.json(questions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// FIX: This is the function responsible for the single problem page
exports.getQuestionById = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('course', 'title')
            .populate('topic', 'title')
            // FIX: Only hide 'hiddenTestCases'. Removed '-solutions' so they are visible.
            .select('-hiddenTestCases'); 
            
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        res.json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getQuestionByIdForAdmin = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id)
            .populate('course')
            .populate('topic');
            
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        res.json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        let question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        question = await Question.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        res.json(question);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        await Question.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Question removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
exports.createBulkQuestions = async (req, res) => {
    try {
        const questionsData = req.body;
        
        if (!Array.isArray(questionsData)) {
            return res.status(400).json({ msg: 'Input must be an array of question objects.' });
        }

        const processedQuestions = [];
        const errors = [];

        // Process each question one by one to find matching IDs
        for (let i = 0; i < questionsData.length; i++) {
            const q = questionsData[i];
            let courseId = q.course;
            let topicId = q.topic;

            // 1. Lookup Course by Name if ID is not provided
            if (q.courseName && !courseId) {
                const courseDoc = await Course.findOne({ title: q.courseName.trim() });
                if (courseDoc) {
                    courseId = courseDoc._id;
                } else {
                    errors.push(`Row ${i + 1}: Course "${q.courseName}" not found.`);
                    continue; // Skip this question
                }
            }

            // 2. Lookup Topic by Name if ID is not provided
            if (q.topicName && !topicId) {
                const topicDoc = await Topic.findOne({ title: q.topicName.trim() });
                if (topicDoc) {
                    topicId = topicDoc._id;
                } else {
                    errors.push(`Row ${i + 1}: Topic "${q.topicName}" not found.`);
                    continue;
                }
            }

            if (!courseId || !topicId) {
                errors.push(`Row ${i + 1}: Missing Course ID or Topic ID.`);
                continue;
            }

            // 3. Construct the final object
            processedQuestions.push({
                ...q,
                course: courseId,
                topic: topicId,
                createdBy: req.user.id
            });
        }

        if (errors.length > 0) {
            // If there were errors, return them and DO NOT save anything (transactional-like safety)
            return res.status(400).json({ msg: 'Bulk upload failed.', errors });
        }

        const questions = await Question.insertMany(processedQuestions);
        res.status(201).json({ msg: `Successfully added ${questions.length} questions.` });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
};