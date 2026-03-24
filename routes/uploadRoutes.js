const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Replace spaces with underscores for safer URLs
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${file.fieldname}-${Date.now()}-${safeName}`);
    }
});

// Original Single Image Upload (Keep for Profile/Article Covers)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Not an image!'), false);
};
const uploadSingle = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

// Multi-File Upload for Chat (Allows 15 files, any type, 25MB max each)
const uploadMultiple = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ==========================================
// 1. SINGLE UPLOAD ROUTE
// ==========================================
router.post('/', uploadSingle.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ msg: 'Please upload a file' });
        res.json({ url: `/uploads/${req.file.filename}` });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// 2. MULTIPLE UPLOAD ROUTE
// ==========================================
router.post('/multiple', uploadMultiple.array('files', 15), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ msg: 'Please upload files' });
        }
        const fileData = req.files.map(file => ({
            url: `/uploads/${file.filename}`,
            name: file.originalname,
            type: file.mimetype.startsWith('image/') ? 'image' : 'file'
        }));
        res.json({ files: fileData });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;