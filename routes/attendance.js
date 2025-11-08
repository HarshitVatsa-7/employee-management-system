const express = require('express');
const router = express.Router();
const {
  punchIn,
  punchOut,
  getHome,
  getMonthDetails,
  getWeekDetails
} = require('../controllers/attendanceController');

// This middleware protects your routes
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view this resource');
  res.redirect('/signin');
};

// Route for the dashboard
router.get('/home', ensureAuthenticated, getHome);

// Punch in/out routes
router.post('/punch-in', ensureAuthenticated, punchIn);
router.post('/punch-out', ensureAuthenticated, punchOut);

// Monthly details route
router.get('/month/:month', ensureAuthenticated, getMonthDetails);

// Weekly details route
router.get('/week', ensureAuthenticated, getWeekDetails);

module.exports = router;