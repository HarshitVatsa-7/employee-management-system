const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.get('/signin', authController.getSignin);
router.post('/signin', authController.postSignin);
router.get('/logout', authController.logout);

router.get('/home', requireAuth, require('./../controllers/attendanceController').getHome);

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/signin');
}

module.exports = router;
