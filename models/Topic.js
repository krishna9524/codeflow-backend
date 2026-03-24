const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TopicSchema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    images: [{ type: String }], // Array of image paths
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);