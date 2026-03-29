const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // --- BASIC AUTH & PROFILE ---
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String },
    bio: { type: String },
    location: { type: String },

    // --- SOCIAL LINKS ---
    socials: {
        github: String,
        linkedin: String,
        website: String
    },

    // --- PLATFORM PROGRESS ---
    points: { type: Number, default: 0 },
    solvedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    progress: {
        solvedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]
    },

    // --- SOCIAL GRAPH ---
    connections: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: {
            type: String,
            enum: ['pending', 'connected', 'sent'],
            default: 'pending'
        }
    }],

    // --- CONTENT INTERACTION ---
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Discussion' }],
    profileViews: { type: Number, default: 0 },

    // ✅ FIX: lastSeen field — updated every time user pings or logs in.
    // null means the user has never been seen (brand new account).
    lastSeen: { type: Date, default: null },

    // --- RECOMMENDATION ENGINE & TRUST SYSTEM ---
    interestVector: {
        type: Map,
        of: Number,
        default: {}
    },

    behaviorStats: {
        avgReadTime: { type: Number, default: 0 },
        likeRate: { type: Number, default: 0 },
        commentRate: { type: Number, default: 0 }
    },

    trustScore: { type: Number, default: 50 },
    isShadowBanned: { type: Boolean, default: false },

    dailyActionCount: { type: Number, default: 0 },
    lastActionTime: { type: Date, default: Date.now },

    // --- ROLE ---
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);