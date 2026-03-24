const mongoose = require('mongoose');

const InteractionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion', index: true },
    type: { 
        type: String, 
        enum: ['impression', 'dwell_5s', 'dwell_30s', 'like', 'comment', 'share', 'save', 'hide', 'report'],
        required: true 
    },
    weight: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: '60d' } // Keep 60 days history
});

module.exports = mongoose.model('Interaction', InteractionSchema);