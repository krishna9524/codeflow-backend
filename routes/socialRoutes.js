const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Use your auth middleware
const Connection = require('../models/Connection');
const Message = require('../models/Message');
const User = require('../models/User');

// --- CONNECTIONS ---

// Send Request
router.post('/connect/:userId', auth, async (req, res) => {
    try {
        const existing = await Connection.findOne({
            $or: [
                { requester: req.user.id, recipient: req.params.userId },
                { requester: req.params.userId, recipient: req.user.id }
            ]
        });
        if (existing) return res.status(400).json({ msg: 'Connection already exists' });

        const newConn = new Connection({ requester: req.user.id, recipient: req.params.userId });
        await newConn.save();
        res.json(newConn);
    } catch (err) { res.status(500).send('Server Error'); }
});

// Get Status
router.get('/status/:userId', auth, async (req, res) => {
    try {
        const conn = await Connection.findOne({
            $or: [
                { requester: req.user.id, recipient: req.params.userId },
                { requester: req.params.userId, recipient: req.user.id }
            ]
        });
        if (!conn) return res.json({ status: 'none' });
        res.json({ status: conn.status, requester: conn.requester });
    } catch (err) { res.status(500).send('Server Error'); }
});

// Accept Request
router.put('/accept/:userId', auth, async (req, res) => {
    try {
        const conn = await Connection.findOneAndUpdate(
            { requester: req.params.userId, recipient: req.user.id, status: 'pending' },
            { status: 'accepted' },
            { new: true }
        );
        res.json(conn);
    } catch (err) { res.status(500).send('Server Error'); }
});

// --- CHAT ---

// Get Messages between current user and target user
router.get('/messages/:userId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: req.params.userId },
                { sender: req.params.userId, recipient: req.user.id }
            ]
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) { res.status(500).send('Server Error'); }
});

// Send Message
router.post('/messages/:userId', auth, async (req, res) => {
    try {
        const msg = new Message({
            sender: req.user.id,
            recipient: req.params.userId,
            content: req.body.content
        });
        await msg.save();
        res.json(msg);
    } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;