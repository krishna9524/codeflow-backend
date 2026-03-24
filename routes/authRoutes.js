const express = require('express');
const router = express.Router();
const { signup, login, adminLogin, getUser } = require('../controllers/authController');
const { validateSignup, validateLogin } = require('../utils/validator');
const authMiddleware = require('../utils/authMiddleware');

// @route   POST api/auth/signup
// @desc    Register user
router.post('/signup', validateSignup, signup);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', validateLogin, login);

// @route   POST api/auth/admin/login
// @desc    Authenticate admin & get token
router.post('/admin/login', validateLogin, adminLogin);

// @route   GET api/auth
// @desc    Get logged in user
router.get('/', authMiddleware, getUser);

module.exports = router;