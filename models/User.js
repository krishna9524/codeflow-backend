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
    // Legacy support for progress object if used in some controllers
    progress: {
        solvedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]
    },

    // --- SOCIAL GRAPH ---
    connections: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { 
            type: String, 
            enum: ['pending', 'connected', 'sent'], // 'sent' helps UI know I sent it
            default: 'pending' 
        }
    }],
    
    // --- CONTENT INTERACTION ---
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Discussion' }],
    profileViews: { type: Number, default: 0 },

    // =========================================================
    // 🧠 RECOMMENDATION ENGINE & TRUST SYSTEM (NEW)
    // =========================================================

    // 1. Interest Embeddings (The "Brain")
    // Map of "Topic" -> "Affinity Score (0-1.0)"
    // e.g. { "react": 0.9, "python": 0.2, "career": 0.5 }
    // This learns from every click, like, and dwell time.
    interestVector: {
        type: Map,
        of: Number,
        default: {}
    },

    // 2. Behavior Vector (The "Style")
    // Tracks how they consume content to detect bots or hyper-active users
    behaviorStats: {
        avgReadTime: { type: Number, default: 0 },
        likeRate: { type: Number, default: 0 }, // % of posts liked vs viewed
        commentRate: { type: Number, default: 0 }
    },

    // 3. Authority / Trust System
    // Used to filter spam and boost high-quality authors in the feed
    trustScore: { type: Number, default: 50 }, // 0-100. <20 = Ghostban.
    isShadowBanned: { type: Boolean, default: false }, // If true, posts exist but aren't recommended

    // 4. Anti-Gaming Counters
    // Used to rate-limit signals so a bot can't "spam like" to train the algorithm
    dailyActionCount: { type: Number, default: 0 },
    lastActionTime: { type: Date, default: Date.now },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);