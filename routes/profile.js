// routes/profile.js
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// auth check
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/signin');
}

// GET complete profile page
router.get('/complete', ensureAuth, profileController.getCompleteProfile);

// POST complete profile - uses multer middleware exported from controller
// If you ever change the middleware name, update this line.
router.post('/complete', ensureAuth, profileController.uploadMiddleware, profileController.postCompleteProfile);

module.exports = router;
