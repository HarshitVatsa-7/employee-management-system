// app.js
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

const { sequelize } = require('./config/database'); // expects DB env vars set
require('./config/passport')(passport); // passport configuration (uses bcryptjs in your repo)

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const attendanceRoutes = require('./routes/attendance');

const app = express();
const DEFAULT_PORT = 3000;
const PORT = process.env.PORT || DEFAULT_PORT;

/* ---------------- SECURITY & PERFORMANCE ---------------- */

// Secure HTTP headers (tune options as necessary)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS - restrict in production via CLIENT_URL env var
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiter (simple sliding window)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
}));

// Basic XSS sanitization
app.use(xssClean());

// Response compression
app.use(compression());

// Force HTTPS on production behind a proxy (Render sets x-forwarded-proto)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'];
    if (proto && proto !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
  }
  next();
});

/* ---------------- VIEW ENGINE ---------------- */

app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------------- STATIC & BODY PARSING ---------------- */

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ---------------- SESSION, FLASH & PASSPORT ---------------- */

// NOTE: For production, replace the default MemoryStore with a persistent store (Redis, MySQL store)
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // only send cookie over HTTPS in prod
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

/* ---------------- GLOBAL HELPERS (available in EJS) ---------------- */

app.locals.formatDuration = (seconds) => {
  if (seconds === null || typeof seconds === 'undefined') return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

app.locals.formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

app.locals.formatTime = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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

// Middleware: ensure profile completed before allowing access to attendance pages
function ensureProfileComplete(req, res, next) {
  if (req.user && !req.user.profile_completed) {
    return res.redirect('/profile/complete');
  }
  return next();
}

app.use('/attendance', ensureProfileComplete, attendanceRoutes);

// Simple home redirect
app.get('/', (req, res) => {
  if (!req.user) return res.redirect('/signin');
  res.redirect('/home');
});

/* ---------------- HEALTH CHECK ---------------- */

// health route for Render / load balancers
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

/* ---------------- DATABASE START & SERVER (robust) ---------------- */

/**
 * Robust start logic:
 *  - Retry DB connection several times (Render may need a moment)
 *  - Run sequelize.sync only in non-production (use migrations in prod)
 *  - Start HTTP server and handle graceful shutdown
 */

const MAX_DB_RETRIES = Number(process.env.DB_MAX_RETRIES || 8);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 5000);

async function startServer() {
  // Retry DB connection
  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connected');
      // In production you should use migrations instead of sync({ alter: true })
      if (process.env.NODE_ENV !== 'production') {
        await sequelize.sync({ alter: true });
        console.log('✅ Sequelize sync complete (dev mode)');
      }
      break;
    } catch (err) {
      console.error(`DB connect attempt ${attempt} failed:`, err.message || err);
      if (attempt === MAX_DB_RETRIES) {
        console.error('❌ Unable to connect to DB after retries. Exiting.');
        process.exit(1);
      }
      console.log(`Waiting ${DB_RETRY_DELAY_MS}ms before next DB attempt...`);
      await new Promise(r => setTimeout(r, DB_RETRY_DELAY_MS));
    }
  }

  const server = app.listen(process.env.PORT || PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${process.env.PORT || PORT}`);
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log('⚠️  Received shutdown signal — closing server...');
    server.close(async () => {
      try {
        await sequelize.close();
        console.log('🧹 DB connection closed. Exiting.');
        process.exit(0);
      } catch (err) {
        console.error('Error while closing DB connection', err);
        process.exit(1);
      }
    });

    // Force close after 10s
    setTimeout(() => {
      console.error('⚠️  Forced shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

startServer();

/* ---------------- EXPORT app (for tests) ---------------- */

module.exports = app;
