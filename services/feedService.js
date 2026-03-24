const Discussion = require('../models/Discussion');
const User = require('../models/User');
const Interaction = require('../models/Interaction');

// --- 1. SCORING CONSTANTS ---
const SIGNALS = {
    LIKE: 1.0,
    COMMENT: 2.5,
    SHARE: 3.5,
    SAVE: 3.0,
    DWELL_5S: 0.2,  // Small boost for reading
    DWELL_30S: 1.5, // Massive boost for deep reading
    HIDE: -5.0,     // Heavy penalty
    REPORT: -50.0   // Kill signal
};

const DECAY_FACTOR = 1.5; // Gravity
const EXPLORATION_RATE = 0.15; // 15% of feed is random "Discovery" content

// --- 2. HELPER: VECTOR DOT PRODUCT (Similarity) ---
const calculateUserRelevance = (userVector, postTags) => {
    if (!userVector || userVector.size === 0 || !postTags || postTags.length === 0) return 0.1; // Default low relevancy
    
    let score = 0;
    let matches = 0;
    
    postTags.forEach(tag => {
        const affinity = userVector.get(tag) || 0;
        if (affinity > 0) {
            score += affinity;
            matches++;
        }
    });

    // Normalize: Average affinity for the matched tags
    return matches > 0 ? (score / matches) : 0; 
};

// --- 3. HELPER: SPAM FILTER ---
const isSpam = (post, author) => {
    if (author.trustScore < 20) return true; // Bot account
    if (post.isFlagged) return true;
    
    // Keyword filters
    const spamKeywords = ['buy now', 'crypto', 'giveaway', '100% free'];
    const contentLower = post.content.toLowerCase();
    if (spamKeywords.some(w => contentLower.includes(w))) return true;

    return false;
};

// =================================================================
// MAIN PIPELINE
// =================================================================

/**
 * STEP 1: SIGNAL PROCESSOR
 * Updates the user's vector and the post's global score real-time.
 */
exports.processInteraction = async (userId, postId, type) => {
    const user = await User.findById(userId);
    const post = await Discussion.findById(postId);
    if (!user || !post) return;

    const signalWeight = SIGNALS[type.toUpperCase()] || 0;

    // A. Update User Vector (Personalization)
    // "If I like a React post, my affinity for React goes up"
    if (post.tags && post.tags.length > 0) {
        if (!user.interestVector) user.interestVector = new Map();
        
        post.tags.forEach(tag => {
            const current = user.interestVector.get(tag) || 0;
            const learningRate = 0.05;
            // Sigmoid-like clamp between 0 and 1
            let next = current + (signalWeight * learningRate);
            next = Math.max(0, Math.min(1, next)); 
            user.interestVector.set(tag, next);
        });
        await user.save();
    }

    // B. Update Post Score (Global Popularity)
    // Move post through Viral Pipeline stages
    post.engagementScore += signalWeight;
    
    if (post.engagementScore > 100) post.distributionStage = 'viral';
    else if (post.engagementScore > 30) post.distributionStage = 'distribution';
    else if (post.engagementScore > 5) post.distributionStage = 'evaluation';
    
    // Recalculate Trend Score
    // Trend = Log(Engagement) / TimeDecay
    const hoursOld = Math.max(1, (Date.now() - post.createdAt) / 36e5);
    post.trendScore = Math.log10(Math.max(1, post.engagementScore)) / Math.pow(hoursOld, 0.5);
    
    await post.save();

    // Log Raw Interaction
    await Interaction.create({ user: userId, post: postId, type, weight: signalWeight });
};

/**
 * STEP 2: FEED GENERATOR
 * Generates a unique feed for every user ID.
 */
exports.generateFeed = async (userId, page = 1) => {
    const user = await User.findById(userId).populate('connections');
    const userVector = user.interestVector || new Map();
    const connections = user.connections.filter(c => c.status === 'connected').map(c => c.user);

    // 1. FETCH CANDIDATES (The Mix)
    // We grab 3 buckets of content:
    // A. Network (Friends) - High Priority
    // B. Viral (Global Hits) - Medium Priority
    // C. Discovery (Random Topics) - Low Priority (Exploration)
    
const candidates = await Discussion.find({
    $or: [
        { author: { $in: connections } }, 
        { distributionStage: { $in: ['distribution', 'viral'] } }, 
        {} // Fallback
    ]
})
.sort({ createdAt: -1 })
.limit(100)
.populate('author', 'name avatar username trustScore')
.populate('likes', 'name avatar bio') // <-- ADD THIS LINE
// 👇 ADD THIS LINE TO FIX "UNKNOWN USER"
.populate('comments.author', 'name avatar bio') 
.populate('comments.replies.author', 'name avatar bio') // If you add replies
.lean();

    // 2. SCORING & RANKING
    let feed = candidates.map(post => {
        // Filter Spam
        if (isSpam(post, post.author)) return null;

        // A. Relevance Score (0 to 1)
        // How much does this match my interest vector?
        const relevance = calculateUserRelevance(userVector, post.tags);

        // B. Social Score (0 to 1)
        // Is this from a friend?
        const isConnection = connections.some(id => id.toString() === post.author._id.toString());
        const socialScore = isConnection ? 1.0 : 0.0;

        // C. Quality/Viral Score (Normalized)
        const viralScore = Math.min(1, post.trendScore / 5); 

        // D. Freshness Decay
        const hoursOld = (Date.now() - new Date(post.createdAt)) / 36e5;
        const freshness = 1.0 / Math.pow(hoursOld + 1, DECAY_FACTOR);

        // E. Random Noise (The "Shuffle" Factor)
        // This ensures two users with same interests see slightly different orders
        const noise = Math.random() * 0.1;

        // --- FINAL FORMULA ---
        // LinkedIn leans heavy on Social (0.4) and Relevance (0.3)
        const finalRank = 
            (socialScore * 0.40) +
            (relevance * 0.30) +
            (viralScore * 0.15) +
            (freshness * 0.15) +
            noise;

        return { ...post, rank: finalRank, debugRelevance: relevance };
    }).filter(Boolean); // Remove nulls

    // 3. SORT
    feed.sort((a, b) => b.rank - a.rank);

    // 4. PAGINATE
    const limit = 10;
    const startIndex = (page - 1) * limit;
    return feed.slice(startIndex, startIndex + limit);
};

/**
 * STEP 3: PERSONALIZED NEWS ENGINE
 * Generates news based on what the USER likes, not just global trends.
 */
exports.getPersonalizedNews = async (userId) => {
    const user = await User.findById(userId);
    
    // Get top 3 interests of the user
    // Convert Map to Array -> Sort by Score -> Take Top 3
    const topInterests = Array.from(user.interestVector || [])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(i => i[0]); // ['react', 'system-design']

    // If no interests, fallback to generic tags
    const searchTags = topInterests.length > 0 ? topInterests : ['tech', 'coding', 'career'];

    // Find top posts in these categories from last 48h
    const news = await Discussion.find({
        tags: { $in: searchTags },
        createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
        engagementScore: { $gt: 5 } // Must have some engagement
    })
    .sort({ engagementScore: -1 })
    .limit(5)
    .select('title engagementScore tags');

    return news.map(n => ({
        title: n.title,
        time: "Trending for you", // UI Display
        readers: `${Math.floor(n.engagementScore * 50 + 100)} readers`, // Synthetic reader count
        tag: n.tags[0] // Context
    }));
};