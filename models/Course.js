const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' }, // Path to the single course image
    // content field can be removed if courses are just containers for topics
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);