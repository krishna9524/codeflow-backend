const Topic = require('../models/Topic');
const Question = require('../models/Question');

const getAllTopics = async (req, res) => {
    try {
        const topics = await Topic.find().sort({ title: 1 });
        res.json(topics);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const createTopic = async (req, res) => {
    const { title, description, course } = req.body;
    try {
        const newTopic = new Topic({ title, description, course });
        const topic = await newTopic.save();
        res.json(topic);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const updateTopic = async (req, res) => {
    try {
        const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!topic) return res.status(404).json({ msg: 'Topic not found' });
        res.json(topic);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

const deleteTopic = async (req, res) => {
    try {
        const topic = await Topic.findById(req.params.id);
        if (!topic) return res.status(404).json({ msg: 'Topic not found' });

        await Question.deleteMany({ topic: req.params.id });
        await topic.deleteOne();
        res.json({ msg: 'Topic and associated questions removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

module.exports = {
    getAllTopics,
    createTopic,
    updateTopic,
    deleteTopic,
};