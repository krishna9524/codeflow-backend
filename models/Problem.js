const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: { 
        type: String, 
        required: true 
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    slug: {
        type: String
    },
    // Test cases shown to user
    sampleTestCases: [
        {
            input: mongoose.Schema.Types.Mixed,
            output: mongoose.Schema.Types.Mixed
        }
    ],
    // Starter code for the editor
    starter_cpp: { type: String, default: "" },
    starter_java: { type: String, default: "" },
    starter_python: { type: String, default: "" },

    // Real test cases for judging (Hidden)
    testCases: [
        {
            input: mongoose.Schema.Types.Mixed,
            output: mongoose.Schema.Types.Mixed
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Problem', problemSchema);