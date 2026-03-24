const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
    language: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Compilation Error', 'Runtime Error', 'System Error'],
        default: 'Pending',
    },
    output: {
        type: String,
    },
    passedCases: {
        type: Number,
        default: 0,
    },
    totalCases: {
        type: Number,
    },
    failedCase: {
        type: Object, // Stores { input, expected, output } on failure
    },
    runtimeInMs: {
        type: Number,
    },
    memoryInKb: {
        type: Number,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Submission', SubmissionSchema);