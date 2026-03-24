const Message = require('../models/Message');
const User = require('../models/User');

// Ensure getConversations correctly populates other user's info
exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const messages = await Message.find({
            $or: [{ sender: currentUserId }, { recipient: currentUserId }]
        }).sort({ createdAt: -1 });

        const uniqueUsersMap = new Map();

        messages.forEach(msg => {
            const otherUserId = msg.sender.toString() === currentUserId 
                ? msg.recipient.toString() 
                : msg.sender.toString();
            
            if (!uniqueUsersMap.has(otherUserId)) {
                uniqueUsersMap.set(otherUserId, {
                    userId: otherUserId,
                    lastMessage: msg.content,
                    createdAt: msg.createdAt,
                    unread: !msg.read && msg.recipient.toString() === currentUserId
                });
            }
        });

        const conversations = [];
        for (const [id, data] of uniqueUsersMap) {
            const user = await User.findById(id, 'name avatar');
            if (user) {
                conversations.push({ ...data, user });
            }
        }
        res.json(conversations);
    } catch (err) { res.status(500).send("Server Error"); }
};

// 2. Get Messages with specific user
// Ensure getMessages returns the sender field properly
exports.getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const myId = req.user.id;

        const messages = await Message.find({
            $or: [
                { sender: myId, recipient: userId },
                { sender: userId, recipient: myId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

// 3. Send Message
exports.sendMessage = async (req, res) => {
    try {
        const { recipientId, content } = req.body;
        const newMessage = new Message({
            sender: req.user.id,
            recipient: recipientId,
            content
        });
        await newMessage.save();
        res.json(newMessage);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};