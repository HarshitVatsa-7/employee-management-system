const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');

exports.getSignup = (req, res) => {
  // Always send variables the EJS file expects (even empty)
  res.render('signup', {
    errors: [],
    email: '',
    username: ''
  });
};

exports.postSignup = async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  const errors = [];

  if (!email || !username || !password || !confirmPassword) errors.push('All fields required');
  if (password !== confirmPassword) errors.push('Passwords do not match');

  // Send back the same values so the form stays filled after error
  if (errors.length) return res.render('signup', { errors, email, username });

  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/signup');
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, username, password: hashed });

    req.flash('success_msg', 'Registered successfully. Please sign in.');
    res.redirect('/signin');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error');
    res.redirect('/signup');
  }
};

exports.getSignin = (req, res) => {
  res.render('signin', {
    errors: [],
    email: ''
  });
};

exports.postSignin = (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/signin',
    failureFlash: true
  })(req, res, next);
};

exports.logout = (req, res) => {
  req.logout(err => {
    if (err) console.error(err);
    req.flash('success_msg', 'Logged out');
    res.redirect('/signin');
  });
};
