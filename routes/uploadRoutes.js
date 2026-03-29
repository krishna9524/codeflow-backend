const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the 'uploads' directory exists before saving files!
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Creates a unique filename like: 1714717110205-123456789.png
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); 
    }
});

const upload = multer({ storage: storage });

// ==========================================
// 1. SINGLE IMAGE UPLOAD (For Admin Course Images)
// Route: POST /api/upload/image
// ==========================================
router.post('/image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
    }
    // Return the exact path the frontend expects
    res.json({ filePath: `/uploads/${req.file.filename}` });
});

// ==========================================
// 2. MULTIPLE FILES UPLOAD (For Chat Attachments)
// Route: POST /api/upload/multiple
// ==========================================
router.post('/multiple', upload.array('files', 15), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ msg: 'No files uploaded' });
    }
    
    // Format the response so the Chat component can render them properly
    const filesData = req.files.map(file => ({
        url: `/uploads/${file.filename}`,
        name: file.originalname,
        type: file.mimetype.startsWith('image/') ? 'image' : 'file'
    }));
    
    res.json({ files: filesData });
});

module.exports = router;