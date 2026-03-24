const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Question = require('../models/Question');
const User = require('../models/User'); 
const Course = require('../models/Course');
const Topic = require('../models/Topic');
const Discussion = require('../models/Discussion'); // Added Discussion model

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. Fetch Data (Parallel)
        const [user, submissions, allQuestions, allCourses, allTopics] = await Promise.all([
            User.findById(userId).select('points'),
            Submission.find({ userId })
                .sort({ createdAt: -1 })
                .populate('questionId', 'title difficulty'), 
            Question.find().select('_id title difficulty topic course'),
            Course.find().lean(),
            Topic.find().lean()
        ]);

        // 2. Process Stats
        const solvedSet = new Set();
        const activityMap = {}; 
        const uniqueSolvedDates = new Set(); 
        
        // Difficulty Counters
        const difficultyStats = {
            Easy: { total: 0, solved: 0 },
            Medium: { total: 0, solved: 0 },
            Hard: { total: 0, solved: 0 }
        };

        // Initialize Totals
        allQuestions.forEach(q => {
            const diff = q.difficulty || 'Medium';
            if (difficultyStats[diff]) difficultyStats[diff].total++;
        });

        // 3. Iterate Submissions
        submissions.forEach(sub => {
            const dateKey = new Date(sub.createdAt).toISOString().split('T')[0];
            
            // Heatmap Entry
            if (!activityMap[dateKey]) activityMap[dateKey] = [];
            
            const qTitle = sub.questionId ? sub.questionId.title : 'Deleted Problem';
            const qDiff = sub.questionId ? sub.questionId.difficulty : 'Medium';
            
            activityMap[dateKey].push({
                id: sub._id,
                title: qTitle,
                status: sub.status,
                diff: qDiff
            });

            // Solved Logic
            if (sub.status === 'Accepted') {
                uniqueSolvedDates.add(dateKey);
                
                const qId = sub.questionId ? sub.questionId._id.toString() : null;
                if (qId && !solvedSet.has(qId)) {
                    solvedSet.add(qId);
                    if (difficultyStats[qDiff]) difficultyStats[qDiff].solved++;
                }
            }
        });

        // 4. REAL STREAK CALCULATION
        let streak = 0;
        const sortedDates = Array.from(uniqueSolvedDates).sort((a, b) => new Date(b) - new Date(a)); 
        
        if (sortedDates.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            if (sortedDates[0] === today || sortedDates[0] === yesterday) {
                streak = 1;
                for (let i = 0; i < sortedDates.length - 1; i++) {
                    const current = new Date(sortedDates[i]);
                    const next = new Date(sortedDates[i+1]);
                    const diffTime = Math.abs(current - next);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    if (diffDays === 1) {
                        streak++;
                    } else {
                        break; 
                    }
                }
            }
        }

        // 5. Build Course Data
        const courseStats = allCourses.map(course => {
            const courseTopics = allTopics.filter(t => t.course.toString() === course._id.toString());
            const topicDetails = courseTopics.map(topic => {
                const topicQuestions = allQuestions.filter(q => q.topic.toString() === topic._id.toString());
                const problemsWithStatus = topicQuestions.map(q => ({
                    _id: q._id,
                    title: q.title,
                    difficulty: q.difficulty,
                    slug: q.slug,
                    status: solvedSet.has(q._id.toString()) ? 'Solved' : 'Unsolved'
                }));
                const solvedInTopic = problemsWithStatus.filter(p => p.status === 'Solved').length;
                return {
                    _id: topic._id,
                    title: topic.title,
                    total: topicQuestions.length,
                    solved: solvedInTopic,
                    percentage: topicQuestions.length === 0 ? 0 : Math.round((solvedInTopic / topicQuestions.length) * 100),
                    problems: problemsWithStatus
                };
            });

            const totalInCourse = topicDetails.reduce((acc, t) => acc + t.total, 0);
            const solvedInCourse = topicDetails.reduce((acc, t) => acc + t.solved, 0);

            return {
                _id: course._id,
                title: course.title,
                total: totalInCourse,
                solved: solvedInCourse,
                percentage: totalInCourse === 0 ? 0 : Math.round((solvedInCourse / totalInCourse) * 100),
                topics: topicDetails
            };
        });

        // =========================================================
        // ✅ 6. FIXED RECENT ACTIVITY
        // =========================================================
        const recentActivity = submissions.slice(0, 5).map(sub => ({
            id: sub._id,                                             
            questionId: sub.questionId ? sub.questionId._id : null,  
            title: sub.questionId ? sub.questionId.title : 'Unknown Problem',
            difficulty: sub.questionId ? sub.questionId.difficulty : 'Medium',
            status: sub.status,
            createdAt: sub.createdAt
        }));

        // =========================================================
        // ✅ 7. FIXED RANK CALCULATION
        // =========================================================
        const solvedCount = solvedSet.size;
        
        // Include discussions in final points calculation
        const discussionCount = await Discussion.countDocuments({ author: userId });
        const finalPoints = (solvedCount * 10) + discussionCount;

        // Save the calculated points to the DB to ensure global rank queries work correctly
        await User.findByIdAndUpdate(userId, { points: finalPoints });

        // Accurately count users with strictly greater points
        const betterUsersCount = await User.countDocuments({ points: { $gt: finalPoints } });

        res.json({
            success: true,
            stats: {
                rank: betterUsersCount + 1,
                points: finalPoints,
                solvedCount,
                totalQuestions: allQuestions.length,
                difficulty: difficultyStats,
                activity: activityMap,
                streak: streak 
            },
            courses: courseStats,
            recentActivity 
        });

    } catch (error) {
        console.error('[Dashboard Error]:', error.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};