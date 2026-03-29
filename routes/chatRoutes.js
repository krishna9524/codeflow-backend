const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
    getConversations,
    getMessages,
    sendMessage,
    markMessagesAsRead,
    deleteMessageForMe,
    deleteMessageForEveryone,
    bulkDeleteMessages,
    toggleReaction
} = require('../controllers/chatController');

// Conversations & messages
router.get('/conversations',  auth, getConversations);
router.get('/:userId',        auth, getMessages);
router.post('/',              auth, sendMessage);

// Read receipts
router.put('/:userId/read',   auth, markMessagesAsRead);

// Delete — single
router.delete('/message/:messageId/me',       auth, deleteMessageForMe);
router.delete('/message/:messageId/everyone', auth, deleteMessageForEveryone);

// Delete — bulk (multi-select)
// body: { messageIds: [...], deleteType: 'forMe' | 'forEveryone' }
router.delete('/messages/bulk',               auth, bulkDeleteMessages);

// Reactions
router.post('/message/:messageId/react',      auth, toggleReaction);

module.exports = router;