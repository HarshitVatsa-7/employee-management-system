// controllers/profileController.js
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const User = require('../models/User');

// ---------- Ensure upload directory exists ----------
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profile_images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ---------- Multer Storage ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Use user id + extension
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}${ext}`);
  }
});

// ---------- File Filter and Limits ----------
const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      return cb(new Error('Only JPG, JPEG and PDF files are allowed'));
    }
    cb(null, true);
  }
});

// Export middleware so routes can use it
exports.uploadMiddleware = upload.single('profile_image');

// ---------- Controller Functions ----------
exports.getCompleteProfile = (req, res) => {
  if (!req.user) return res.redirect('/signin');
  res.render('completeProfile', { user: req.user, flash: { error_msg: req.flash('error_msg') } });
};

exports.postCompleteProfile = async (req, res) => {
  if (!req.user) return res.redirect('/signin');

  // If you are using upload middleware via route, req.file will be available.
  try {
    const { full_name, address, mobile, emp_id, position, type_of_work } = req.body;

    // compute profile image path if uploaded
    let profileImagePath = req.user.profile_image || null;
    if (req.file) {
      // store as web path (served from /public)
      profileImagePath = `/public/uploads/profile_images/${req.file.filename}`;
    }

    await User.update(
      {
        full_name,
        address,
        mobile,
        emp_id,
        position,
        type_of_work,
        profile_image: profileImagePath,
        profile_completed: true
      },
      { where: { id: req.user.id } }
    );

    req.flash('success_msg', 'Profile completed successfully.');
    return res.redirect('/attendance/home');
  } catch (err) {
    console.error('Profile save error:', err);
    // If multer threw an error earlier, it should have been redirected by route level - handle gracefully
    req.flash('error_msg', err.message || 'Failed to save profile');
    return res.redirect('/profile/complete');
  }
};
