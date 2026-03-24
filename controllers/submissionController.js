const Submission = require('../models/Submission');
const Question = require('../models/Question');
const {
    normalizeLanguage,
    combineCode,
    executeCodeOnce,
    processSubmission
} = require('../services/compilerService');

exports.runCode = async (req, res) => {
    const { questionId, code, language, input } = req.body;
    try {
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        const normalizedLang = normalizeLanguage(language);
        const driverCode = question[`driver_${normalizedLang}`];
        if (!driverCode) {
            return res.status(400).json({ msg: `Driver code for '${language}' not found.` });
        }
        const fullCode = combineCode(driverCode, code);
        const result = await executeCodeOnce(fullCode, normalizedLang, input);
        res.json(result);
    } catch (err) {
        console.error("Run code server error:", err);
        res.status(500).json({ status: 'Error', error: 'An internal server error occurred.' });
    }
};

exports.submitCode = async (req, res) => {
    const { questionId } = req.params;
    const { code, language } = req.body;
    const userId = req.user.id;
    try {
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ msg: 'Question not found' });
        }
        const submission = new Submission({
            userId, questionId, code, language,
            status: 'Pending',
            totalCases: question.hiddenTestCases.length,
        });
        await submission.save();
        processSubmission(submission, question, code, language);
        res.status(202).json({ submissionId: submission.id });
    } catch (err) {
        console.error("Submit code error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.getSubmissionResult = async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ msg: 'Submission not found' });
        }
        if (submission.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getUserSubmissionsForQuestion = async (req, res) => {
    try {
        const submissions = await Submission.find({
            userId: req.user.id,
            questionId: req.params.questionId,
        }).sort({ createdAt: -1 }).select('status language createdAt code runtimeInMs memoryInKb');
        res.json(submissions);
    } catch (err) {
        console.error("Get user submissions error:", err.message);
        res.status(500).send('Server Error');
    }
};