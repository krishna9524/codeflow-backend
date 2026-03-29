const User = require('../models/User');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Discussion = require('../models/Discussion');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==========================================
// 1. CONNECTION MANAGEMENT
// ==========================================

exports.sendConnectionRequest = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;

        if (targetUserId === currentUserId) return res.status(400).json({ msg: "Cannot connect to self" });

        const targetUser = await User.findById(targetUserId);
        const currentUser = await User.findById(currentUserId);

        if (!targetUser || !currentUser) return res.status(404).json({ msg: "User not found" });

        // Check if already connected or pending
        const existing = currentUser.connections.find(c => c.user.toString() === targetUserId);
        if (existing) return res.status(400).json({ msg: "Request already sent or connected" });

        // Add to Current User as 'sent'
        currentUser.connections.push({ user: targetUserId, status: 'sent' });
        
        // Add to Target User as 'pending'
        targetUser.connections.push({ user: currentUserId, status: 'pending' });

        await currentUser.save();
        await targetUser.save();

        res.json({ msg: "Connection request sent" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.acceptConnectionRequest = async (req, res) => {
    try {
        const requesterId = req.params.userId; 
        const accepterId = req.user.id; 

        const requester = await User.findById(requesterId);
        const accepter = await User.findById(accepterId);

        // Update Accepter: pending -> connected
        const accepterConn = accepter.connections.find(c => c.user.toString() === requesterId);
        if (!accepterConn || accepterConn.status !== 'pending') {
            return res.status(400).json({ msg: "No pending request from this user" });
        }
        accepterConn.status = 'connected';

        // Update Requester: sent -> connected
        const requesterConn = requester.connections.find(c => c.user.toString() === accepterId);
        if (requesterConn) {
            requesterConn.status = 'connected';
        } else {
            requester.connections.push({ user: accepterId, status: 'connected' });
        }

        await accepter.save();
        await requester.save();

        res.json({ msg: "Connection accepted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getConnectionStatus = async (req, res) => {
    try {
        const targetId = req.params.userId;
        const myId = req.user.id;
        
        const me = await User.findById(myId);
        const connection = me.connections.find(c => c.user.toString() === targetId);

        res.json({ status: connection ? connection.status : 'none' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getConnectionRequests = async (req, res) => {
    try {
        // 👉 FIX: Added lastSeen to populate
        const user = await User.findById(req.user.id).populate('connections.user', 'name username avatar bio position company lastSeen');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const requests = user.connections
            .filter(c => c.status === 'pending' && c.user)
            .map(c => ({
                _id: c.user._id,
                name: c.user.name,
                username: c.user.username,
                avatar: c.user.avatar,
                bio: c.user.bio,
                lastSeen: c.user.lastSeen
            }));

        res.json(requests);
    } catch (err) {
        console.error("Requests Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.getAllConnections = async (req, res) => {
    try {
        // 👉 FIX: Added lastSeen to populate
        const user = await User.findById(req.user.id).populate('connections.user', 'name username avatar bio lastSeen');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const connections = user.connections
            .filter(c => c.status === 'connected' && c.user)
            .map(c => ({
                _id: c.user._id,
                name: c.user.name,
                username: c.user.username,
                avatar: c.user.avatar,
                bio: c.user.bio,
                lastSeen: c.user.lastSeen,
                connectedAt: (c._id && typeof c._id.getTimestamp === 'function') ? c._id.getTimestamp() : new Date() 
            }));

        res.json(connections);
    } catch (err) {
        console.error("Connections Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.removeConnection = async (req, res) => {
    try {
        const targetId = req.params.id;
        const myId = req.user.id;

        const me = await User.findById(myId);
        const other = await User.findById(targetId);

        if (!me || !other) return res.status(404).json({ msg: 'User not found' });

        me.connections = me.connections.filter(c => c.user.toString() !== targetId);
        other.connections = other.connections.filter(c => c.user.toString() !== myId);

        await me.save();
        await other.save();

        res.json({ msg: 'Disconnected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// ==========================================
// 2. USER STATS & LEADERBOARD LOGIC
// ==========================================

const calculateUserScores = async () => {
    const allQuestions = await Question.find({}, '_id').lean();
    const validQuestionIds = new Set(allQuestions.map(q => q._id.toString()));
    const allAccepted = await Submission.find({ status: 'Accepted' }, 'userId questionId').lean();
    const users = await User.find({}, '_id solvedProblems').lean();
    const userScoreMap = {}; 

    allAccepted.forEach(sub => {
        if(sub.userId && sub.questionId && validQuestionIds.has(sub.questionId.toString())) {
            const uid = sub.userId.toString();
            if(!userScoreMap[uid]) userScoreMap[uid] = new Set();
            userScoreMap[uid].add(sub.questionId.toString());
        }
    });

    users.forEach(u => {
        const uid = u._id.toString();
        if(u.solvedProblems?.length) {
            if(!userScoreMap[uid]) userScoreMap[uid] = new Set();
            u.solvedProblems.forEach(pid => {
                if(validQuestionIds.has(pid.toString())) userScoreMap[uid].add(pid.toString());
            });
        }
    });
    return userScoreMap;
};

// ==========================================
// 3. CORE USER PROFILES & AUTHENTICATION
// ==========================================

exports.getUserById = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        
        // 1. Fetch Target User
        const user = await User.findById(targetUserId)
            .populate('connections.user', 'name avatar lastSeen') // 👉 FIX: Populating lastSeen for friends
            .select('-password -interestVector')
            .lean();

        if (!user) return res.status(404).json({ msg: 'User not found' });

        // 2. Calculate Total Connections
        const connectedFriends = user.connections ? user.connections.filter(c => c.status === 'connected') : [];
        const connectionCount = connectedFriends.length;

        // 3. Calculate Mutual Connections & Status
        let mutualUsers = [];
        let connectionStatus = 'none';

        if (req.user && req.user.id !== targetUserId) {
            const myId = req.user.id;
            const me = await User.findById(myId).lean();
            
            if (me && me.connections) {
                const myNetworkIds = new Set(
                    me.connections
                        .filter(c => c.status === 'connected')
                        .map(c => c.user.toString())
                );

                mutualUsers = connectedFriends
                    .filter(c => c.user && myNetworkIds.has(c.user._id.toString()))
                    .map(c => ({ _id: c.user._id, name: c.user.name, avatar: c.user.avatar }));

                const conn = me.connections.find(c => c.user.toString() === targetUserId);
                if (conn) connectionStatus = conn.status;
            }
        }

        // --- FIXED RANK LOGIC ---
        const userScoreMap = await calculateUserScores();
        const solvedCount = userScoreMap[targetUserId] ? userScoreMap[targetUserId].size : 0;
        const discussionCount = await Discussion.countDocuments({ author: targetUserId });

        const allDiscussions = await Discussion.aggregate([
            { $group: { _id: "$author", count: { $sum: 1 } } }
        ]);
        const discussMap = {};
        allDiscussions.forEach(d => { if (d._id) discussMap[d._id.toString()] = d.count; });

        const myTotalPoints = (solvedCount * 10) + discussionCount;
        let rank = 1;
        
        const allActiveUsers = new Set([...Object.keys(userScoreMap), ...Object.keys(discussMap)]);
        allActiveUsers.forEach(uid => {
            if (uid !== targetUserId) {
                const uSolved = userScoreMap[uid] ? userScoreMap[uid].size : 0;
                const uDiscuss = discussMap[uid] || 0;
                const uPoints = (uSolved * 10) + uDiscuss;
                if (uPoints > myTotalPoints) rank++;
            }
        });
        // ------------------------

        // Advanced Stats
        const allQuestions = await Question.find({}, 'topic difficulty').lean();
        const submissions = await Submission.find({ userId: targetUserId }).sort({ createdAt: -1 }).lean();
        
        const activityMap = {};
        submissions.forEach(sub => {
            if (sub.createdAt) {
                const date = new Date(sub.createdAt).toISOString().split('T')[0];
                activityMap[date] = (activityMap[date] || 0) + 1;
            }
        });

        // Streak
        let currentStreak = 0;
        let maxStreak = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (activityMap[todayStr] || activityMap[yesterdayStr]) {
            let checkDate = new Date();
            if (!activityMap[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
            while (activityMap[checkDate.toISOString().split('T')[0]]) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }
        maxStreak = Math.max(currentStreak, user.stats?.maxStreak || 0);

        // Difficulty
        const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
        const totalDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
        const questionLookup = new Map(allQuestions.map(q => [q._id.toString(), q]));

        allQuestions.forEach(q => {
            if (totalDifficulty[q.difficulty] !== undefined) totalDifficulty[q.difficulty]++;
        });

        if (userScoreMap[targetUserId]) {
            userScoreMap[targetUserId].forEach(qid => {
                const q = questionLookup.get(qid);
                if (q && difficultyCounts[q.difficulty] !== undefined) {
                    difficultyCounts[q.difficulty]++;
                }
            });
        }

        const fullProfile = {
            ...user,
            connectionCount,       
            mutualUsers,           
            connectionStatus,      
            stats: {
                rank,
                points: myTotalPoints,
                solvedCount,
                discuss: discussionCount,
                views: user.profileViews || 0,
                streak: currentStreak,
                maxStreak: maxStreak,
                totalActiveDays: Object.keys(activityMap).length,
                activity: activityMap,
                difficulty: {
                    Easy: { solved: difficultyCounts.Easy, total: totalDifficulty.Easy },
                    Medium: { solved: difficultyCounts.Medium, total: totalDifficulty.Medium },
                    Hard: { solved: difficultyCounts.Hard, total: totalDifficulty.Hard }
                }
            }
        };

        res.json(fullProfile);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        user = new User({ name, email, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.json({ 
                token, 
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    avatar: user.avatar,
                    lastSeen: user.lastSeen,
                    savedPosts: user.savedPosts || [] 
                } 
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Update last seen automatically on login
        user.lastSeen = Date.now();
        await user.save();

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.json({ 
                token, 
                user: { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    avatar: user.avatar,
                    lastSeen: user.lastSeen,
                    savedPosts: user.savedPosts || [] 
                } 
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.updateProfile = async (req, res) => {
    const { name, bio, location, socialGithub, socialLinkedin, socialWebsite, avatar } = req.body;
    try {
        let user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (name !== undefined) user.name = name;
        if (bio !== undefined) user.bio = bio;
        if (location !== undefined) user.location = location;
        if (avatar !== undefined) user.avatar = avatar;

        if (!user.socials) user.socials = {};
        if (socialGithub !== undefined) user.socials.github = socialGithub;
        if (socialLinkedin !== undefined) user.socials.linkedin = socialLinkedin;
        if (socialWebsite !== undefined) user.socials.website = socialWebsite;

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // --- FIXED RANK LOGIC ---
        const userScoreMap = await calculateUserScores();
        const mySolvedCount = userScoreMap[userId] ? userScoreMap[userId].size : 0;
        const discussionCount = await Discussion.countDocuments({ author: userId });

        const allDiscussions = await Discussion.aggregate([
            { $group: { _id: "$author", count: { $sum: 1 } } }
        ]);
        const discussMap = {};
        allDiscussions.forEach(d => { if (d._id) discussMap[d._id.toString()] = d.count; });

        const myTotalPoints = (mySolvedCount * 10) + discussionCount;
        let rank = 1;
        
        const allActiveUsers = new Set([...Object.keys(userScoreMap), ...Object.keys(discussMap)]);
        allActiveUsers.forEach(uid => {
            if (uid !== userId) {
                const uSolved = userScoreMap[uid] ? userScoreMap[uid].size : 0;
                const uDiscuss = discussMap[uid] || 0;
                const uPoints = (uSolved * 10) + uDiscuss;
                if (uPoints > myTotalPoints) rank++;
            }
        });
        // ------------------------

        // 3. Fetch Data for Activity, Topics and Difficulty
        const allQuestions = await Question.find({}, 'topic difficulty title').populate('topic').lean();
        const submissions = await Submission.find({ userId: userId }).sort({ createdAt: -1 }).lean();
        
        const activityMap = {};
        const recentActivity = [];
        const questionLookup = new Map(allQuestions.map(q => [q._id.toString(), q]));
        
        submissions.forEach(sub => {
            if (sub.createdAt) {
                const date = new Date(sub.createdAt).toISOString().split('T')[0];
                activityMap[date] = (activityMap[date] || 0) + 1;
            }
            const qDetails = questionLookup.get(sub.questionId?.toString());
            recentActivity.push({
                title: qDetails ? qDetails.title : 'Problem Unavailable',
                questionId: sub.questionId,
                difficulty: qDetails ? qDetails.difficulty : 'Medium',
                status: sub.status,
                createdAt: sub.createdAt
            });
        });

        // 4. Calculate Streak
        let currentStreak = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (activityMap[todayStr] || activityMap[yesterdayStr]) {
            let checkDate = new Date();
            if (!activityMap[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
            while (activityMap[checkDate.toISOString().split('T')[0]]) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }

        // 5. Calculate Difficulty Stats and Topics
        const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
        const totalDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
        const topicStats = {};

        allQuestions.forEach(q => {
            if (totalDifficulty[q.difficulty] !== undefined) totalDifficulty[q.difficulty]++;
            const tName = q.topic?.title || q.topic || 'General';
            if (!topicStats[tName]) topicStats[tName] = { title: tName, solved: 0, total: 0 };
            topicStats[tName].total++;
        });

        if (userScoreMap[userId]) {
            userScoreMap[userId].forEach(qid => {
                const q = questionLookup.get(qid);
                if (q) {
                    if (difficultyCounts[q.difficulty] !== undefined) difficultyCounts[q.difficulty]++;
                    const tName = q.topic?.title || q.topic || 'General';
                    if (topicStats[tName]) topicStats[tName].solved++;
                }
            });
        }

        const courses = Object.values(topicStats).map(t => ({
            _id: t.title,
            title: t.title,
            solved: t.solved,
            total: t.total,
            percentage: t.total > 0 ? Math.round((t.solved / t.total) * 100) : 0
        })).sort((a, b) => b.percentage - a.percentage);

        res.json({
            stats: {
                rank,
                points: myTotalPoints,
                streak: currentStreak,
                solvedCount: mySolvedCount,
                discuss: discussionCount,
                totalSubmissions: submissions.length,
                totalQuestions: allQuestions.length,
                totalActiveDays: Object.keys(activityMap).length,
                activity: activityMap,
                difficulty: {
                    Easy: { solved: difficultyCounts.Easy, total: totalDifficulty.Easy },
                    Medium: { solved: difficultyCounts.Medium, total: totalDifficulty.Medium },
                    Hard: { solved: difficultyCounts.Hard, total: totalDifficulty.Hard }
                }
            },
            courses,
            recentActivity: recentActivity.slice(0, 5)
        });
    } catch (err) {
        console.error("Dashboard Error:", err.message);
        res.status(500).send('Server Error');
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const userScoreMap = await calculateUserScores();
        
        // Include discussions so leaderboard logic matches user points
        const allDiscussions = await Discussion.aggregate([{ $group: { _id: "$author", count: { $sum: 1 } } }]);
        const discussMap = {};
        allDiscussions.forEach(d => { if (d._id) discussMap[d._id.toString()] = d.count; });
        
        const users = await User.find({ 
            _id: { $ne: req.user.id },
            role: { $ne: 'admin' } 
        })
        .select('-password -interestVector') // 👉 FIX: lastSeen isn't excluded, so it comes through!
        .lean();

        const userList = users.map(user => {
            const uid = user._id.toString();
            const solved = userScoreMap[uid] ? userScoreMap[uid].size : 0;
            const discuss = discussMap[uid] || 0;
            const totalPoints = (solved * 10) + discuss;
            
            return {
                ...user,
                stats: { solvedCount: solved, totalPoints }
            };
        });

        // Sort by total points to match rank system
        userList.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);

        res.json(userList);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getSuggestions = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const currentUser = await User.findById(currentUserId).populate('connections.user');
        
        const myNetworkIds = new Set(
            currentUser.connections
            .filter(c => c.status === 'connected')
            .map(c => c.user._id.toString())
        );

        const excludeIds = new Set([
            ...Array.from(myNetworkIds),
            currentUserId
        ]);

        // 👉 FIX: Added 'lastSeen' to the select query
        const candidates = await User.find({
            _id: { $nin: Array.from(excludeIds) },
            role: { $ne: 'admin' }
        })
        .select('name username avatar bio connections location interestVector solvedProblems lastSeen')
        .populate('connections.user', 'name avatar')
        .lean();

        const suggestions = candidates.map(candidate => {
            let score = 0;
            let reason = "Suggested for you";

            // 1. MUTUAL CONNECTIONS
            const mutualUsers = candidate.connections
                .map(c => c.user)
                .filter(u => u && myNetworkIds.has(u._id.toString()))
                .map(u => ({ _id: u._id, name: u.name, avatar: u.avatar })); 

            if (mutualUsers.length > 0) {
                score += (mutualUsers.length * 15);
                reason = mutualUsers.length === 1 ? `1 mutual connection` : `${mutualUsers.length} mutual connections`;
            }

            // 2. LOCATION MATCH
            if (currentUser.location && candidate.location && currentUser.location.toLowerCase() === candidate.location.toLowerCase()) {
                score += 10;
                if (mutualUsers.length === 0) {
                    reason = `Based in ${candidate.location}`;
                }
            }

            // 3. SHARED INTERESTS
            let sharedInterests = 0;
            if (currentUser.interestVector && candidate.interestVector) {
                for (const [topic, value] of Object.entries(currentUser.interestVector)) {
                    if (candidate.interestVector[topic] > 0.5) sharedInterests++;
                }
            }
            if (sharedInterests > 0) {
                score += (sharedInterests * 5);
                if (mutualUsers.length === 0 && score < 10) {
                    reason = "Similar interests";
                }
            }

            // 4. "FAME" / POPULARITY
            const fameScore = (candidate.connections?.length || 0) + (candidate.solvedProblems?.length || 0);
            score += (fameScore * 0.2);

            if (mutualUsers.length === 0 && fameScore > 10 && reason === "Suggested for you") {
                reason = "Popular in CodeFlow";
            }

            return {
                ...candidate,
                score,
                mutualUsers, 
                mutualCount: mutualUsers.length,
                reason
            };
        });

        // Sort by highest score first
        suggestions.sort((a, b) => b.score - a.score);
        res.json(suggestions.slice(0, 30));

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// ==========================================
// 4. LAST SEEN UTILITY
// ==========================================

exports.updateLastSeen = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { lastSeen: Date.now() });
        res.status(200).json({ msg: 'Ping successful' });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};