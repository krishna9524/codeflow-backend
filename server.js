// MUST BE AT THE VERY TOP to ensure API keys load before anything else runs!
require('dotenv').config();

const http = require('http');
const { WebSocketServer } = require('ws'); 
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const { createInitialAdmin } = require('./utils/startup');
const { handlePlaygroundConnection } = require('./services/playgroundExecutionService');

// 1. Setup Temp Directory for Code Execution (Crucial for Playground)
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Created temp directory for code execution.');
}

// 2. Connect to Database
connectDB();

const app = express();

// 3. Middleware
app.use(cors());

// Increased body limit to 50MB to handle High-Res Profile Images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Serve Static Files (Profile Pictures)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. Run Startup Tasks
createInitialAdmin();

// 6. Define Routes
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));          
app.use('/api/discussions', require('./routes/discussionRoutes')); 
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));       
app.use('/api/ai', require('./routes/aiRoutes')); // 👉 Your AI Routes are mounted here!
app.use('/api/social', require('./routes/socialRoutes'));
app.use('/api/utils', require('./routes/utilRoutes'));          

// Basic Root Route
app.get('/', (req, res) => {
    res.send('CodeFlow API is running...');
});

// 7. Initialize HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Handle Real-time Playground Connections 
wss.on('connection', handlePlaygroundConnection);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ msg: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));