const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Get token from the 'x-auth-token' header
    const token = req.header('x-auth-token');
    console.log('[Auth Middleware] Checking for token...');

    // Check if no token is found
    if (!token) {
        console.log('[Auth Middleware] ❌ No token found in header. Denying access.');
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify the token
    try {
        // Decode the token using your JWT_SECRET from the .env file
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('[Auth Middleware] ✅ Token is valid.');
        
        // Attach the user's info from the token to the request object
        req.user = decoded.user;
        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        // If jwt.verify fails, it will throw an error
        console.log('[Auth Middleware] ❌ Token is NOT valid. Denying access.');
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

// This is a higher-order middleware for routes that require an admin user
const adminAuth = (req, res, next) => {
    authMiddleware(req, res, () => {
        if (req.user.role !== 'admin') {
            console.log(`[Auth Middleware] ❌ Access denied. User is not an admin. Role: ${req.user.role}`);
            return res.status(403).json({ msg: 'Access denied. Admin role required.' });
        }
        console.log('[Auth Middleware] ✅ Admin access granted.');
        next();
    });
};

module.exports = authMiddleware;
module.exports.adminAuth = adminAuth;