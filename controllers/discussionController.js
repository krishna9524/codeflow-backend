const Discussion = require('../models/Discussion');
const feedService = require('../services/feedService');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.getAllDiscussions = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        
        // 1. Get current user and their connections
        const currentUser = await User.findById(currentUserId).populate('connections.user');
        const myConnectionIds = new Set(
            currentUser.connections
                ?.filter(c => c.status === 'connected')
                .map(c => c.user._id ? c.user._id.toString() : c.user.toString()) || []
        );

        // 2. Fetch the latest 100 posts to process through the algorithm
        const posts = await Discussion.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('author', 'name avatar bio username')
            .populate('reactions.user', 'name avatar bio username')
            .populate('comments.author', 'name avatar bio username')
            .lean();

        // 3. Apply your advanced scoring algorithm
        const now = new Date();
        
        const scoredPosts = posts.map(post => {
            const reactionCount = post.reactions?.length || 0;
            const commentCount = post.comments?.length || 0;
            const shareCount = post.shares?.length || 0;

            const postDate = post.createdAt ? new Date(post.createdAt) : now;
            const ageInHours = Math.max(0, (now - postDate) / 3600000);

            const authorId = post.author?._id?.toString();

            // ---------------------------
            // 🔹 1. Engagement (log scaled)
            // ---------------------------
            const rawEngagement = (reactionCount * 1.5) + (commentCount * 3) + (shareCount * 5);
            const engagementScore = Math.log1p(rawEngagement);

            // ---------------------------
            // 🔹 2. Relationship Strength
            // ---------------------------
            let relationshipScore = 0;
            if (myConnectionIds.has(authorId)) {
                relationshipScore += 20;
                // If you track interaction history in the future
                const interactions = post.author?.interactionCountWithUser || 0;
                relationshipScore += Math.log1p(interactions) * 10;
            }

            // ---------------------------
            // 🔹 3. Interest Matching
            // ---------------------------
            let interestScore = 0;
            if (post.tags && currentUser.interests) {
                const commonTags = post.tags.filter(tag => currentUser.interests.includes(tag));
                interestScore = commonTags.length * 10;
            }

            // ---------------------------
            // 🔹 4. Content Quality
            // ---------------------------
            let qualityScore = 0;
            if (post.content?.length > 150) qualityScore += 10;
            if (post.media) qualityScore += 10;
            if (commentCount > 5) qualityScore += 10; // discussion quality

            // ---------------------------
            // 🔹 5. Virality Boost (TRENDING DETECTION)
            // ---------------------------
            const engagementRate = rawEngagement / (ageInHours + 1);
            let viralityScore = 0;
            if (engagementRate > 10) viralityScore = 20;
            else if (engagementRate > 5) viralityScore = 10;

            // ---------------------------
            // 🔹 6. Freshness Decay (Improved)
            // ---------------------------
            const freshnessDecay = 1 / Math.pow(ageInHours + 2, 1.3);

            // ---------------------------
            // 🔹 7. Penalty System (VERY IMPORTANT)
            // ---------------------------
            let penalty = 0;
            if (ageInHours > 72) penalty += 20; // Too old → penalty
            if (rawEngagement < 2 && ageInHours > 10) penalty += 15; // Low engagement spam
            if (post.author?.postFrequency > 5) penalty += 10; // Repetitive author spam

            // ---------------------------
            // 🔹 8. FINAL SCORE
            // ---------------------------
            const baseScore =
                (0.35 * engagementScore) +
                (0.25 * relationshipScore) +
                (0.20 * interestScore) +
                (0.10 * qualityScore) +
                (0.10 * viralityScore);

            const finalScore = (baseScore * freshnessDecay) - penalty;

            return {
                ...post,
                feedScore: finalScore
            };
        });

        // 4. Sort by the highest score (with a tie-breaker to stop UI shaking)
        scoredPosts.sort((a, b) => {
            if (b.feedScore === a.feedScore) {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA; 
            }
            return b.feedScore - a.feedScore;
        });
        
        // 5. Apply pagination for infinite scroll
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 10; 
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        res.json(scoredPosts.slice(startIndex, endIndex));

    } catch (err) {
        console.error("Feed Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.recordInteraction = async (req, res) => {
    try {
        await feedService.processInteraction(req.user.id, req.body.postId, req.body.type);
        res.status(200).send();
    } catch (err) {
        console.error("Tracking Error:", err.message);
        res.status(200).send();
    }
};

exports.getNews = async (req, res) => {
    try {
        let news = [];

        // 1. Try to fetch personalized news first
        if (req.user && feedService.getPersonalizedNews) {
            try {
                news = await feedService.getPersonalizedNews(req.user.id);
            } catch (e) {
                console.log("Personalized news failed, falling back to trending...");
            }
        }

        // 2. THE ULTIMATE TRENDING ALGORITHM
        if (!news || news.length === 0) {
            news = await Discussion.aggregate([
                // Step A: Calculate basic counts and how many hours old the post is
                { 
                    $addFields: { 
                        reactionCount: { $size: { $ifNull: ["$reactions", []] } },
                        commentCount: { $size: { $ifNull: ["$comments", []] } },
                        ageInHours: {
                            $divide: [
                                { $subtract: [new Date(), "$createdAt"] },
                                3600000 // Milliseconds in an hour
                            ]
                        }
                    } 
                },
                // Step B: Calculate Weighted Engagement (Comments > Likes > Views)
                {
                    $addFields: {
                        engagementScore: {
                            $add: [
                                { $multiply: ["$reactionCount", 5] },  // 1 Reaction = 5 points
                                { $multiply: ["$commentCount", 10] },  // 1 Comment = 10 points
                                { $ifNull: ["$views", 0] }             // 1 View = 1 point
                            ]
                        }
                    }
                },
                // Step C: Apply Time Decay (The "Gravity" Formula)
                {
                    $addFields: {
                        trendingScore: {
                            $divide: [
                                "$engagementScore",
                                // (AgeInHours + 2) ^ 1.5 forces older posts down the list
                                { $pow: [ { $add: ["$ageInHours", 2] }, 1.5 ] } 
                            ]
                        }
                    }
                },
                // Step D: Sort by highest trending score and limit to top 5
                { $sort: { trendingScore: -1 } },
                { $limit: 5 },
                { $project: { title: 1, content: 1, views: 1, reactionCount: 1, createdAt: 1 } }
            ]);
        }

        res.json(news);
    } catch (err) {
        console.error("News Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.getDiscussionById = async (req, res) => {
    try {
        let discussion = await Discussion.findById(req.params.id);
        if (!discussion) return res.status(404).json({ msg: 'Post not found' });

        const token = req.header('x-auth-token');
        let userId = null;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.user.id;
            } catch (e) {
                console.log("Invalid token for view counting");
            }
        }

        if (userId && !discussion.viewedBy.includes(userId)) {
            discussion = await Discussion.findByIdAndUpdate(
                req.params.id,
                {
                    $inc: { views: 1 },
                    $push: { viewedBy: userId }
                },
                { new: true }
            );
        }

        await discussion.populate('author', 'name avatar username');
        await discussion.populate({
            path: 'comments.author',
            select: 'name avatar username'
        });
        // ✅ FIX: was missing — causes "Unknown" in reactions modal
        await discussion.populate('reactions.user', 'name avatar bio username');

        res.json(discussion);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Post not found' });
        res.status(500).send('Server Error');
    }
};

exports.createPost = async (req, res) => {
    try {
        const newPost = new Discussion({
            ...req.body,
            author: req.user.id
        });
        const post = await newPost.save();
        await post.populate('author', 'name avatar username');
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.likePost = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.likes.includes(req.user.id)) {
            post.likes = post.likes.filter(id => id.toString() !== req.user.id);
        } else {
            post.likes.push(req.user.id);
        }

        await post.save();
        await post.populate('likes', 'name avatar bio');
        res.json(post.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.addComment = async (req, res) => {
    try {
        if (!req.body.content) return res.status(400).json({ msg: "Content is required" });

        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const newComment = {
            author: req.user.id,
            content: req.body.content,
            createdAt: new Date(),
            likes: []
        };

        post.comments.push(newComment);
        await post.save();

        await post.populate('author', 'name avatar username');
        await post.populate({
            path: 'comments.author',
            select: 'name avatar username'
        });

        res.json(post);
    } catch (err) {
        console.error("Comment Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.likeComment = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (!comment.likes) comment.likes = [];

        if (comment.likes.includes(req.user.id)) {
            comment.likes = comment.likes.filter(id => id.toString() !== req.user.id);
        } else {
            comment.likes.push(req.user.id);
        }

        await post.save();
        res.json(comment.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
exports.likeReply = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        const reply = comment.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ msg: 'Reply not found' });

        if (!reply.likes) reply.likes = [];

        const alreadyLiked = reply.likes.some(id => id.toString() === req.user.id);
        if (alreadyLiked) {
            reply.likes = reply.likes.filter(id => id.toString() !== req.user.id);
        } else {
            reply.likes.push(req.user.id);
        }

        await post.save();
        res.json(reply.likes);
    } catch (err) {
        console.error("Like Reply Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.replyToComment = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (!comment.replies) comment.replies = [];

        const newReply = {
            author: req.user.id,
            content: req.body.content,
            createdAt: new Date()
        };

        comment.replies.push(newReply);
        await post.save();
        await post.populate('comments.replies.author', 'name avatar bio');

        const savedReply = post.comments.id(req.params.commentId).replies.slice(-1)[0];
        res.json(savedReply);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.savePost = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const postId = req.params.id;

        if (!user.savedPosts) {
            user.savedPosts = [];
        }

        if (user.savedPosts.includes(postId)) {
            user.savedPosts = user.savedPosts.filter(id => id.toString() !== postId);
        } else {
            user.savedPosts.push(postId);
        }
        await user.save();
        res.json(user.savedPosts);
    } catch (err) {
        console.error("Save Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.getSavedPosts = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: 'savedPosts',
            populate: [
                {
                    path: 'author',
                    select: 'name avatar username bio'
                },
                // ✅ FIX: was missing — saved posts modal also showed "Unknown"
                {
                    path: 'reactions.user',
                    select: 'name avatar bio username'
                }
            ]
        });

        if (!user) return res.status(404).json({ msg: "User not found" });
        const activeSavedPosts = user.savedPosts.filter(post => post !== null);
        res.json(activeSavedPosts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deletePost = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await post.deleteOne();
        res.json({ msg: 'Post removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updatePost = async (req, res) => {
    try {
        const { title, content, category } = req.body;
        let post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (post.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        post.title = title || post.title;
        post.content = content || post.content;
        post.category = category || post.category;

        await post.save();
        await post.populate('author', 'name avatar username');
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (comment.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        post.comments.pull(req.params.commentId);
        await post.save();

        await post.populate('author', 'name avatar username');
        await post.populate({
            path: 'comments.author',
            select: 'name avatar username'
        });

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateComment = async (req, res) => {
    try {
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        const comment = post.comments.id(req.params.commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (comment.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        comment.content = req.body.content;
        comment.updatedAt = Date.now();

        await post.save();

        await post.populate('author', 'name avatar username');
        await post.populate({
            path: 'comments.author',
            select: 'name avatar username'
        });

        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getUserPosts = async (req, res) => {
    try {
        const posts = await Discussion.find({ author: req.params.userId })
            .sort({ createdAt: -1 })
            .populate('author', 'name avatar username bio')
            .populate('likes', 'name avatar bio')
            .populate('reactions.user', 'name avatar bio username')
            .populate('comments.author', 'name avatar bio')
            .populate('comments.replies.author', 'name avatar bio');

        res.json(posts);
    } catch (err) {
        console.error("Get User Posts Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.reactToPost = async (req, res) => {
    try {
        const { reactionType } = req.body;
        const post = await Discussion.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post not found' });

        if (!post.reactions) post.reactions = [];

        const existingIndex = post.reactions.findIndex(
            r => r.user.toString() === req.user.id
        );

        if (existingIndex >= 0) {
            if (post.reactions[existingIndex].type === reactionType) {
                // Same reaction clicked again — toggle off
                post.reactions.splice(existingIndex, 1);
            } else {
                // Different reaction — update type
                post.reactions[existingIndex].type = reactionType;
            }
        } else {
            post.reactions.push({ user: req.user.id, type: reactionType });
        }

        await post.save();
        await post.populate('reactions.user', 'name avatar bio username');

        res.json(post.reactions);
    } catch (err) {
        console.error("Reaction Error:", err.message);
        res.status(500).send('Server Error');
    }
};