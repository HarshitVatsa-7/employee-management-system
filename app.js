require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const xssClean = require('xss-clean');
const { sequelize } = require('./config/database');

require('./config/passport')(passport);

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- SECURITY & PERFORMANCE ---------------- */

// 🧱 Secure HTTP headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// 🌐 Allow only your domain (edit CLIENT_URL in .env for production)
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// ⚡ Limit excessive requests (prevent DDoS / brute force)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Please try again later."
}));

// 🧼 Sanitize input to prevent XSS
app.use(xssClean());

// 🗜️ Gzip responses
app.use(compression());

// 🔒 Enforce HTTPS in production only
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect("https://" + req.headers.host + req.url);
    }
  }
  next();
});

/* ---------------- VIEW ENGINE SETUP ---------------- */

app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------------- STATIC & BODY PARSING ---------------- */

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ---------------- SESSION, FLASH & PASSPORT ---------------- */

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

/* ---------------- GLOBAL HELPERS ---------------- */

app.locals.formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

app.locals.formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
};

app.locals.formatTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

/* ---------------- FLASH & USER LOCALS ---------------- */

app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

/* ---------------- ROUTES ---------------- */

app.use('/', authRoutes);
app.use('/profile', profileRoutes);

// ✅ Ensure profile completion before accessing attendance routes
function ensureProfileComplete(req, res, next) {
  if (req.user && !req.user.profile_completed) {
    return res.redirect('/profile/complete');
  }
  next();
}

app.use('/attendance', ensureProfileComplete, attendanceRoutes);

// Home redirect
app.get('/', (req, res) => {
  if (!req.user) return res.redirect('/signin');
  res.redirect('/home');
});

/* ---------------- DATABASE & SERVER START ---------------- */

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`)
    );
  })
  .catch(err => console.error('❌ Unable to connect to DB:', err));
