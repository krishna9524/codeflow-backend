const Message = require('../models/Message');
const User    = require('../models/User');

// ─────────────────────────────────────────────────────────────
// HELPER — enforce delete-for-everyone rules
// ─────────────────────────────────────────────────────────────
const canDeleteForEveryone = (msg, requesterId) => {
    if (msg.sender.toString() !== requesterId) return false;  // only the sender
    if (msg.deletedForEveryone)                return false;  // already deleted
    if (!msg.read)                             return true;   // never seen → no limit
    if (msg.readAt) {
        const diffMins = (Date.now() - new Date(msg.readAt)) / 60000;
        return diffMins <= 5;                                 // seen but within 5 min
    }
    return false;
};

// ─────────────────────────────────────────────────────────────
// 1. GET CONVERSATIONS
// ─────────────────────────────────────────────────────────────
exports.getConversations = async (req, res) => {
    try {
        const myId = req.user.id;
        const messages = await Message.find({
            $or: [{ sender: myId }, { recipient: myId }]
        }).sort({ createdAt: -1 });

        const uniqueMap = new Map();
        messages.forEach(msg => {
            const otherId = msg.sender.toString() === myId
                ? msg.recipient.toString()
                : msg.sender.toString();
            if (!uniqueMap.has(otherId)) {
                uniqueMap.set(otherId, {
                    userId:      otherId,
                    lastMessage: msg.deletedForEveryone ? 'This message was deleted' : msg.content,
                    createdAt:   msg.createdAt,
                    unread:      !msg.read && msg.recipient.toString() === myId
                });
            }
        });

        const conversations = [];
        for (const [id, data] of uniqueMap) {
            const user = await User.findById(id, 'name avatar lastSeen');
            if (user) conversations.push({ ...data, user });
        }
        res.json(conversations);
    } catch (err) {
        console.error('getConversations:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 2. GET MESSAGES
// ─────────────────────────────────────────────────────────────
exports.getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const myId = req.user.id;

        const messages = await Message
            .find({
                $or: [
                    { sender: myId,   recipient: userId },
                    { sender: userId, recipient: myId   }
                ],
                deletedFor: { $nin: [myId] }
            })
            .populate('replyTo', 'content sender deletedForEveryone')
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error('getMessages:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 3. SEND MESSAGE
// ─────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
    try {
        const { recipientId, content, replyToId } = req.body;
        const newMessage = new Message({
            sender:    req.user.id,
            recipient: recipientId,
            content,
            read:      false,
            replyTo:   replyToId || null
        });
        await newMessage.save();
        await newMessage.populate('replyTo', 'content sender deletedForEveryone');
        res.json(newMessage);
    } catch (err) {
        console.error('sendMessage:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 4. MARK AS READ  — stamps readAt for the 5-min window
// ─────────────────────────────────────────────────────────────
exports.markMessagesAsRead = async (req, res) => {
    try {
        await Message.updateMany(
            { sender: req.params.userId, recipient: req.user.id, read: false },
            { $set: { read: true, readAt: new Date() } }
        );
        res.status(200).json({ msg: 'Messages marked as read' });
    } catch (err) {
        console.error('markMessagesAsRead:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// 5. DELETE FOR ME
// ─────────────────────────────────────────────────────────────
exports.deleteMessageForMe = async (req, res) => {
    try {
        const msg  = await Message.findById(req.params.messageId);
        if (!msg)  return res.status(404).json({ msg: 'Message not found' });
        const myId = req.user.id;

        if (msg.sender.toString() !== myId && msg.recipient.toString() !== myId)
            return res.status(403).json({ msg: 'Not authorized' });

        if (!msg.deletedFor.map(id => id.toString()).includes(myId)) {
            msg.deletedFor.push(myId);
            await msg.save();
        }
        res.json({ msg: 'Deleted for you', messageId: msg._id });
    } catch (err) {
        console.error('deleteForMe:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 6. DELETE FOR EVERYONE
//    • Not seen → no time limit
//    • Seen     → must be within 5 minutes of readAt
// ─────────────────────────────────────────────────────────────
exports.deleteMessageForEveryone = async (req, res) => {
    try {
        const msg = await Message.findById(req.params.messageId);
        if (!msg) return res.status(404).json({ msg: 'Message not found' });

        if (!canDeleteForEveryone(msg, req.user.id)) {
            const reason = msg.sender.toString() !== req.user.id
                ? 'Only the sender can delete for everyone'
                : 'Cannot delete — more than 5 minutes have passed since it was seen';
            return res.status(400).json({ msg: reason });
        }

        msg.deletedForEveryone = true;
        await msg.save();
        res.json({ msg: 'Deleted for everyone', messageId: msg._id });
    } catch (err) {
        console.error('deleteForEveryone:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 7. BULK DELETE  (multi-select)
//    body: { messageIds: [...], deleteType: 'forMe' | 'forEveryone' }
// ─────────────────────────────────────────────────────────────
exports.bulkDeleteMessages = async (req, res) => {
    try {
        const { messageIds, deleteType } = req.body;
        const myId = req.user.id;

        if (!Array.isArray(messageIds) || !messageIds.length)
            return res.status(400).json({ msg: 'No message IDs provided' });

        const messages = await Message.find({ _id: { $in: messageIds } });
        const results  = { success: [], failed: [] };

        for (const msg of messages) {
            const isParticipant =
                msg.sender.toString() === myId || msg.recipient.toString() === myId;
            if (!isParticipant) { results.failed.push(msg._id); continue; }

            if (deleteType === 'forEveryone') {
                if (!canDeleteForEveryone(msg, myId)) { results.failed.push(msg._id); continue; }
                msg.deletedForEveryone = true;
            } else {
                if (!msg.deletedFor.map(id => id.toString()).includes(myId))
                    msg.deletedFor.push(myId);
            }

            await msg.save();
            results.success.push(msg._id);
        }

        res.json(results);
    } catch (err) {
        console.error('bulkDelete:', err.message);
        res.status(500).send('Server Error');
    }
};

// ─────────────────────────────────────────────────────────────
// 8. TOGGLE REACTION
//    body: { emoji: '❤️' }
//    Same emoji → remove (toggle off) | Different → replace | None → add
// ─────────────────────────────────────────────────────────────
exports.toggleReaction = async (req, res) => {
    try {
        const { emoji } = req.body;
        const myId = req.user.id;
        if (!emoji) return res.status(400).json({ msg: 'Emoji required' });

        const msg = await Message.findById(req.params.messageId);
        if (!msg)  return res.status(404).json({ msg: 'Message not found' });

        if (msg.sender.toString() !== myId && msg.recipient.toString() !== myId)
            return res.status(403).json({ msg: 'Not authorized' });

        const idx = msg.reactions.findIndex(r => r.user.toString() === myId);
        if (idx !== -1) {
            if (msg.reactions[idx].emoji === emoji) msg.reactions.splice(idx, 1);
            else msg.reactions[idx].emoji = emoji;
        } else {
            msg.reactions.push({ user: myId, emoji });
        }

        await msg.save();
        res.json({ reactions: msg.reactions });
    } catch (err) {
        console.error('toggleReaction:', err.message);
        res.status(500).send('Server Error');
    }
};