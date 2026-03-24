const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Defines the structure for a single test case.
const TestCaseSchema = new Schema({
    // FIX: Change both types from String to Mixed. This allows any valid JSON data.
    input: { type: mongoose.Schema.Types.Mixed, required: true },
    output: { type: mongoose.Schema.Types.Mixed, required: true },
}, { _id: false, strict: false }); // strict: false allows extra fields like 'target' or 'k'

// Defines the structure for a complete solution with explanations.
const SolutionSchema = new Schema({
    language: { type: String, required: true, enum: ['cpp', 'java', 'python'] },
    approach: { type: String, required: true, enum: ['Bruteforce', 'Better', 'Optimal'] },
    code: { type: String, required: true },
    explanation: { type: String, required: true },
}, { _id: false });

// This is the main schema for a question document.
const QuestionSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Easy'
    },
    course: { 
        type: Schema.Types.ObjectId, 
        ref: 'Course', 
        required: true 
    },
    topic: { 
        type: Schema.Types.ObjectId, 
        ref: 'Topic', 
        required: true 
    },
    sampleTestCases: [TestCaseSchema],
    hiddenTestCases: [TestCaseSchema],
    
    // --- Starter Code ---
    starter_cpp: { type: String },
    starter_java: { type: String },
    starter_python: { type: String }, // <-- ADD THIS LINE

    // --- Driver Code ---
    driver_cpp: { type: String },
    driver_java: { type: String },
    driver_python: { type: String }, // <-- ADD THIS LINE
    
    solutions: [SolutionSchema],
    // ... createdBy, etc.

    solutions: [SolutionSchema],

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('Question', QuestionSchema);