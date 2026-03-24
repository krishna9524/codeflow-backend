const mongoose = require('mongoose');

/* ================= REPLY SCHEMA ================= */
const ReplySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/* ================= COMMENT SCHEMA ================= */
const CommentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [ReplySchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/* ================= DISCUSSION SCHEMA ================= */
const DiscussionSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  media: {
    type: String
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Classification
  category: {
    type: String,
    default: 'General'
  },
  tags: [{ type: String }],
  topics: [{ type: String }],

  // Engagement
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Add this inside your DiscussionSchema
reactions: [
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: { 
            type: String, 
            enum: ['like', 'celebrate', 'support', 'love', 'insightful', 'funny'],
            default: 'like'
        }
    }
],
  saves: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },

  // Comments with replies
  comments: [CommentSchema],

  // Viral / Ranking Pipeline
  distributionStage: {
    type: String,
    enum: ['test', 'evaluation', 'distribution', 'viral'],
    default: 'test'
  },
  qualityScore: {
    type: Number,
    default: 0.5
  },
  engagementScore: {
    type: Number,
    default: 0
  },
  trendScore: {
    type: Number,
    default: 0
  },

  // Moderation
  isFlagged: {
    type: Boolean,
    default: false
  },
  isPromotional: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

/* ================= INDEXES ================= */
DiscussionSchema.index({ distributionStage: 1, trendScore: -1 });
DiscussionSchema.index({ tags: 1 });

module.exports = mongoose.model('Discussion', DiscussionSchema);