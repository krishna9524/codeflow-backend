const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // This is why we use 'auth' instead of 'authMiddleware'

const {
    registerUser, 
    loginUser, 
    getProfile, 
    updateProfile,
    getDashboardStats, 
    getAllUsers, 
    getSuggestions,
    getUserById, 
    sendConnectionRequest, 
    acceptConnectionRequest,
    getConnectionStatus, 
    getConnectionRequests, 
    getAllConnections, 
    removeConnection,
    updateLastSeen // 👉 FIX 1: Added updateLastSeen to your imports!
} = require('../controllers/userController');

// ==========================================
// 1. AUTHENTICATION
// ==========================================
router.post('/register', registerUser);
router.post('/login', loginUser);

// ==========================================
// 2. STATIC ROUTES (Must be above /:id)
// ==========================================
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/dashboard/stats', auth, getDashboardStats);
router.get('/suggestions', auth, getSuggestions);

// ==========================================
// 3. NETWORK & CONNECTIONS (Must be above /:id)
// ==========================================
router.get('/connections', auth, getAllConnections);
router.get('/connections/requests', auth, getConnectionRequests);
router.delete('/connections/:id', auth, removeConnection);

router.post('/connect/:userId', auth, sendConnectionRequest);
router.post('/connect/accept/:userId', auth, acceptConnectionRequest);
router.get('/connect/status/:userId', auth, getConnectionStatus);

// 👉 FIX 2: Uses 'auth' and 'updateLastSeen' directly!
router.put('/ping', auth, updateLastSeen); 

// ==========================================
// 4. GENERAL USERS 
// ==========================================
router.get('/', auth, getAllUsers);

// ==========================================
// 5. DYNAMIC ROUTE (MUST BE AT THE VERY BOTTOM!)
// ==========================================
router.get('/:id', auth, getUserById);

module.exports = router;