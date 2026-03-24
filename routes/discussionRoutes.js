const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); 

const {
  getAllDiscussions,
  getNews,
  recordInteraction,
  createPost,
  getSavedPosts,
  getDiscussionById,
  updatePost,
  deletePost,
  likePost,
  reactToPost,
  savePost,
  addComment,
  deleteComment,
  updateComment,
  likeComment,
  likeReply,        // ✅ ADD THIS
  replyToComment,
  getUserPosts 
} = require('../controllers/discussionController');

// ================= FEED & USER =================
router.get('/', auth, getAllDiscussions);
router.get('/news', getNews);
router.get('/user/:userId', auth, getUserPosts); 

// ================= INTERACTIONS =================
router.post('/interaction', auth, recordInteraction);
router.post('/', auth, createPost);
router.get('/saved', auth, getSavedPosts);

// ================= POST ACTIONS =================
router.get('/:id', getDiscussionById);
router.put('/:id', auth, updatePost);
router.delete('/:id', auth, deletePost);
router.post('/:id/save', auth, savePost);

// 👉 FIX: The new Reaction route your frontend is looking for!
router.put('/:id/react', auth, reactToPost);
router.put('/:id/like', auth, likePost); // Keeping just in case old code hits it

// ================= COMMENTS =================
// 👉 FIX: Catching both singular and plural comment routes to stop the 404s
router.post('/:id/comment', auth, addComment); 
router.post('/:id/comments', auth, addComment);
router.put('/:id/comments/:commentId', auth, updateComment);
router.delete('/:id/comments/:commentId', auth, deleteComment);

// ================= COMMENT INTERACTIONS =================
router.put('/:id/comments/:commentId/like', auth, likeComment);
router.post('/:id/comments/:commentId/reply', auth, replyToComment);
router.put('/:id/comments/:commentId/replies/:replyId/like', auth, likeReply); // ✅ FIXED

module.exports = router;