'use strict';
require('dotenv').config();

const express   = require('express');
const path      = require('path');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const session        = require('express-session');
const MySQLStore     = require('express-mysql-session')(session);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── SECURITY ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'"],
    }
  }
}));

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.SITE_URL || true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── SESSION ───────────────────────────────────────────────────
const sessionStore = new MySQLStore({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  createDatabaseTable: true
});

app.use(session({
  secret:            process.env.SESSION_SECRET || 'dahari-change-me',
  store:             sessionStore,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   8 * 60 * 60 * 1000
  },
  proxy: true
}));

// ── RATE LIMITS ───────────────────────────────────────────────
app.use('/api', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/orders', rateLimit({ windowMs: 15*60*1000, max: 20 }));

// ── STATIC ────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API ROUTES ────────────────────────────────────────────────
app.use('/api/products',  require('./backend/routes/products'));
app.use('/api/orders',    require('./backend/routes/orders'));
app.use('/api/admin',     require('./backend/routes/admin'));
app.use('/api/payments',  require('./backend/routes/payments'));

// ── CATEGORIES (static) ───────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json([
    { slug:'board-books',    name:'Board Books (0–3 yrs)',       emoji:'🍼' },
    { slug:'age-4-9',        name:'Ages 4–9',                    emoji:'🎠' },
    { slug:'age-8-12',       name:'Ages 8–12',                   emoji:'🎒' },
    { slug:'teen',           name:'Teen Books (13+ yrs)',         emoji:'📓' },
    { slug:'phonic-books',   name:'Phonic & Reading Readiness',  emoji:'🔊' },
    { slug:'dictionary',     name:'Dictionary & Encyclopedia',   emoji:'📘' },
    { slug:'craft-books',    name:'Craft & Activity Books',      emoji:'🎨' },
    { slug:'kiswahili',      name:'Kiswahili Books',             emoji:'🌍' },
    { slug:'devotional',     name:'Devotional Books',            emoji:'🙏' },
    { slug:'christmas',      name:'Christmas Books',             emoji:'🎄' },
    { slug:'story-books',    name:'Story Books',                 emoji:'📖' },
    { slug:'kenyan-authors', name:'Kenyan Authors #Ubuntu',      emoji:'🇰🇪' },
    { slug:'animal-books',   name:'African Wildlife',            emoji:'🦁' },
    { slug:'stationery',     name:'Stationery',                  emoji:'✏️' },
    { slug:'board-games',    name:'Board Games',                 emoji:'♟️' },
    { slug:'fathers-day',    name:"Father's Day",                emoji:'👨‍👧' },
  ]);
});

// ── HEALTH ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Dahari Books', time: new Date().toISOString() }));

// ── ADMIN SPA ─────────────────────────────────────────────────
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── PAYMENT COMPLETE ──────────────────────────────────────────
app.get('/payment-complete', (req, res) => res.sendFile(path.join(__dirname, 'public', 'payment-complete.html')));

// ── FALLBACK ──────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n📚 Dahari Books running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Admin:  http://localhost:${PORT}/admin\n`);
});

module.exports = app;
