const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Question = require('../models/Question');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Submission = require('../models/Submission');

// @route   POST api/auth/signup
// @desc    Register user
const signup = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User with this email already exists' });
        }
        user = new User({ name, email, password });
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        
        // Initialize progress object
        user.progress = { solvedProblems: [] };

        await user.save();
        
        const payload = { user: { id: user.id, role: 'user' } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            console.log(`[Auth] User signed up: ${email}`);
            res.status(201).json({ token });
        });
    } catch (err) {
        console.error("[Signup Error]", err.message);
        res.status(500).send('Server error');
    }
};

// @route   POST api/auth/login
// @desc    Authenticate user & get token
const login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }
        const payload = { user: { id: user.id, role: 'user' } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            console.log(`[Auth] User logged in: ${email}`);
            res.json({ token });
        });
    } catch (err) {
        console.error("[Login Error]", err.message);
        res.status(500).send('Server error');
    }
};

// @route   POST api/auth/admin/login
// @desc    Authenticate admin & get token
const adminLogin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
        let admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = { user: { id: admin.id, role: 'admin' } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @route   GET api/auth
// @desc    Get logged in user (with Auto-Sync logic)
const getUser = async (req, res) => {
    try {
        if (req.user.role === 'admin') {
            const Admin = require('../models/Admin');
            const admin = await Admin.findById(req.user.id).select('-password');
            if (!admin) return res.status(404).json({ msg: 'Admin not found' });
            return res.json({ ...admin.toObject(), role: 'admin' });
        }

        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // 1. Find all accepted submission IDs
        const acceptedSubmissionsIds = await Submission.find({ 
            userId: user._id, 
            status: 'Accepted' 
        }).distinct('questionId');

        // 2. Fetch the actual questions to check difficulty (Easy/Medium/Hard)
        const solvedQuestions = await Question.find({ 
            _id: { $in: acceptedSubmissionsIds } 
        }).select('difficulty');

        // 3. Calculate Total Points
        let totalPoints = 0;
        solvedQuestions.forEach(q => {
            const diff = q.difficulty ? q.difficulty.toLowerCase() : 'medium';
            if (diff === 'easy') totalPoints += 10;
            else if (diff === 'medium') totalPoints += 20;
            else if (diff === 'hard') totalPoints += 30;
        });

        // 4. Update User Data
        user.solvedProblems = acceptedSubmissionsIds;
        user.points = totalPoints; // <--- SAVE POINTS TO DB
        
        // 5. Ensure 'progress' structure exists (for frontend compatibility)
        if (!user.progress) user.progress = {};
        user.progress.solvedProblems = acceptedSubmissionsIds;

        await user.save();
        
        res.json({ 
            ...user.toObject(), 
            role: 'user' 
        });

    } catch (err) {
        console.error("[Auth Error]", err.message);
        res.status(500).send('Server Error');
    }
};
module.exports = {
    signup,
    login,
    adminLogin,
    getUser,
};