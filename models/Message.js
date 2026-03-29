const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content:   { type: String, required: true },

    // ── Read receipts ───────────────────────────────────────────
    read:   { type: Boolean, default: false },
    readAt: { type: Date,    default: null },  // stamped when recipient opens the chat

    // ── Soft deletes ────────────────────────────────────────────
    // "Delete for me"       → push userId into deletedFor array
    // "Delete for everyone" → set flag; content replaced with placeholder on both sides
    deletedFor:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedForEveryone: { type: Boolean, default: false },

    // ── Emoji reactions ─────────────────────────────────────────
    // One reaction per user — upserted by userId
    reactions: [{
        user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
    }],

    // ── Reply / quote ────────────────────────────────────────────
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }

}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);