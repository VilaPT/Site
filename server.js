require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isCorsOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(__dirname));

const PORT = Number(process.env.PORT) || 3000;
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const corsOrigins = (process.env.CORS_ORIGINS || [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
].join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const dbPassword = process.env.DB_PASSWORD || '';
const isDefaultJwtSecret = JWT_SECRET === 'dev_jwt_secret_change_me';
const MAX_ATTEMPTS = 5;
const QUIZ_PASS_SCORE = 4;
const EMAIL_SEND_TIMEOUT_MS = Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 5000;
const EMAIL_CONNECTION_TIMEOUT_MS = Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS) || 5000;
const EMAIL_GREETING_TIMEOUT_MS = Number(process.env.EMAIL_GREETING_TIMEOUT_MS) || 5000;
const EMAIL_SOCKET_TIMEOUT_MS = Number(process.env.EMAIL_SOCKET_TIMEOUT_MS) || 5000;
const DEFAULT_QUIZ_ANSWER_KEY = [0, 0, 0, 2, 2];
const QUIZ_ANSWER_KEYS = {
  'frontend-html': {
    1: [0, 1, 1, 2, 1],
  },
};

function isCorsOriginAllowed(origin) {
  if (!origin || typeof origin !== 'string') {
    return false;
  }

  if (corsOrigins.includes(origin)) {
    return true;
  }

  if (NODE_ENV !== 'production') {
    try {
      const parsed = new URL(origin);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch (error) {
      return false;
    }
  }

  return false;
}

function isPlaceholder(value) {
  if (!value) return true;
  const lower = String(value).trim().toLowerCase();
  return lower.includes('your_') || lower.includes('example') || lower === 'changeme';
}

const hasJwtSecret = Boolean(JWT_SECRET) && !isPlaceholder(JWT_SECRET);
const hasDbPassword = Boolean(dbPassword) && !isPlaceholder(dbPassword);
const hasEmailConfig =
  Boolean(process.env.EMAIL_HOST) &&
  !isPlaceholder(process.env.EMAIL_HOST) &&
  Boolean(process.env.EMAIL_USER) &&
  !isPlaceholder(process.env.EMAIL_USER) &&
  Boolean(process.env.EMAIL_PASS) &&
  !isPlaceholder(process.env.EMAIL_PASS);
const emailFromAddress = process.env.EMAIL_USER || 'no-reply@localhost';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: dbPassword,
});

const smtpTransporter = hasEmailConfig
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      connectionTimeout: EMAIL_CONNECTION_TIMEOUT_MS,
      greetingTimeout: EMAIL_GREETING_TIMEOUT_MS,
      socketTimeout: EMAIL_SOCKET_TIMEOUT_MS,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;
const devFallbackTransporter = !isProduction ? nodemailer.createTransport({ jsonTransport: true }) : null;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function sendVerificationEmail({ to, name, token }) {
  const verificationUrl = `${APP_BASE_URL}/auth/verify?token=${token}`;
  const message = {
    from: emailFromAddress,
    to,
    subject: 'Verify your account - Web Dev Jrs Portugal',
    text: `Hello ${name},\n\nClick this link to verify your account: ${verificationUrl}`,
  };

  if (smtpTransporter) {
    try {
      await withTimeout(
        smtpTransporter.sendMail(message),
        EMAIL_SEND_TIMEOUT_MS,
        'SMTP send'
      );
      return { sent: true, mode: 'smtp', verificationUrl };
    } catch (err) {
      console.error('[email] SMTP send failed:', err.message);
    }
  }

  if (devFallbackTransporter) {
    await devFallbackTransporter.sendMail(message);
    console.warn('[email] SMTP unavailable. Using local fallback transporter.');
    console.warn(`[email] Verification URL (dev fallback): ${verificationUrl}`);
    return { sent: true, mode: 'dev-fallback', verificationUrl };
  }

  return { sent: false, mode: 'disabled', verificationUrl };
}

function logStartupConfigWarnings() {
  if (!hasEmailConfig) {
    console.warn(
      '[config] Email service disabled (EMAIL_HOST, EMAIL_USER, EMAIL_PASS not configured).'
    );
  }

  if (!hasDbPassword) {
    console.warn(
      '[config] DB_PASSWORD is empty/placeholder. Local dev may work, but production should use a strong password.'
    );
  }

  if (!hasJwtSecret) {
    console.warn(
      '[config] JWT_SECRET is missing/placeholder. Auth token endpoints will return configuration errors.'
    );
  } else if (isDefaultJwtSecret) {
    console.warn(
      '[config] JWT_SECRET is using the default dev value. Replace it before any shared deployment.'
    );
  }
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.sendStatus(401);
  }

  if (!hasJwtSecret) {
    return res.status(500).json({ error: 'JWT secret not configured' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

function clampInteger(value, min, max, fallback = min) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function uniqueIntegerArray(values, min, max) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values)]
    .map((value) => clampInteger(value, min, max, -1))
    .filter((value) => value >= min && value <= max);
}

function sanitizeTracks(tracks) {
  return tracks.map((track) => ({
    slug: track.slug,
    title: track.title,
    modules: track.modules.map((module) => ({
      position: module.position,
      title: module.title,
      difficulty: module.difficulty,
    })),
  }));
}

function getQuizAnswerKey(trackSlug, modulePosition) {
  const custom = QUIZ_ANSWER_KEYS[trackSlug] && QUIZ_ANSWER_KEYS[trackSlug][modulePosition];
  const key = Array.isArray(custom) ? custom : DEFAULT_QUIZ_ANSWER_KEY;
  return key.slice(0, 5);
}

function getQuizBlueprint(trackSlug, modulePosition) {
  return {
    trackSlug,
    modulePosition,
    questionCount: getQuizAnswerKey(trackSlug, modulePosition).length,
    passingScore: QUIZ_PASS_SCORE,
    maxAttempts: MAX_ATTEMPTS,
  };
}

function parseQuizAnswers(rawAnswers) {
  if (!Array.isArray(rawAnswers)) {
    return null;
  }
  const parsed = rawAnswers.map((value) => Number.parseInt(value, 10));
  if (parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    return null;
  }
  return parsed;
}

async function getLearningSnapshot(client, userId) {
  const tracks = await getTracksWithModules(client);
  const progressResult = await client.query(
    'SELECT module_id, status, attempts_used FROM progress WHERE user_id = $1',
    [userId]
  );
  const scoreResult = await client.query(
    'SELECT stars FROM scores WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  const score = scoreResult.rows.length > 0 ? scoreResult.rows[0].stars : 1;
  const learningState = buildLearningState(tracks, progressResult.rows, score);
  return { tracks, learningState };
}

async function getTracksWithModules(client) {
  const tracksResult = await client.query('SELECT id, slug, title FROM tracks ORDER BY id ASC');
  const modulesResult = await client.query(
    'SELECT id, track_id, position, title, difficulty FROM modules ORDER BY track_id ASC, position ASC'
  );

  const modulesByTrackId = new Map();
  for (const module of modulesResult.rows) {
    if (!modulesByTrackId.has(module.track_id)) {
      modulesByTrackId.set(module.track_id, []);
    }
    modulesByTrackId.get(module.track_id).push(module);
  }

  return tracksResult.rows.map((track) => ({
    ...track,
    modules: modulesByTrackId.get(track.id) || [],
  }));
}

function buildLearningState(tracks, progressRows, score) {
  const progress = {};

  const progressByModuleId = new Map(progressRows.map((row) => [row.module_id, row]));

  for (const track of tracks) {
    const moduleIds = track.modules.map((item) => item.id);
    const moduleIdToIndex = new Map(moduleIds.map((id, index) => [id, index]));

    const completedModulePositions = [];
    let currentIndex = 0;
    let attempts = 0;

    for (let index = 0; index < track.modules.length; index += 1) {
      const module = track.modules[index];
      const row = progressByModuleId.get(module.id);
      if (!row) {
        continue;
      }
      if (row.status === 'completed') {
        completedModulePositions.push(index);
      }
    }

    const inProgressRow = track.modules
      .map((module) => progressByModuleId.get(module.id))
      .find((row) => row && row.status === 'in_progress');

    if (inProgressRow && moduleIdToIndex.has(inProgressRow.module_id)) {
      currentIndex = moduleIdToIndex.get(inProgressRow.module_id);
      attempts = clampInteger(inProgressRow.attempts_used, 0, MAX_ATTEMPTS - 1, 0);
    } else {
      const firstNotCompletedIndex = track.modules.findIndex(
        (_, index) => !completedModulePositions.includes(index)
      );
      currentIndex =
        firstNotCompletedIndex === -1
          ? Math.max(0, track.modules.length - 1)
          : firstNotCompletedIndex;
      attempts = 0;
    }

    const completedTrack =
      track.modules.length > 0 && completedModulePositions.length === track.modules.length;

    progress[track.slug] = {
      currentIndex,
      attempts,
      completedModulePositions,
      completedTrack,
    };
  }

  return {
    progress,
    score: clampInteger(score, 1, 7, 1),
  };
}

async function upsertLearningState(client, userId, statePayload) {
  const tracks = await getTracksWithModules(client);
  const progressPayload = statePayload && typeof statePayload.progress === 'object'
    ? statePayload.progress
    : {};
  const score = clampInteger(statePayload ? statePayload.score : 1, 1, 7, 1);

  await client.query(
    `INSERT INTO scores (user_id, stars, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET stars = EXCLUDED.stars, updated_at = CURRENT_TIMESTAMP`,
    [userId, score]
  );

  for (const track of tracks) {
    const trackState = progressPayload[track.slug] || {};
    const modules = track.modules;
    const completedPositions = Array.isArray(trackState.completedModulePositions)
      ? trackState.completedModulePositions
          .map((position) =>
            clampInteger(position, 0, Math.max(0, modules.length - 1), -1)
          )
          .filter((position) => position >= 0)
      : [];

    const uniqueCompletedPositions = [...new Set(completedPositions)];
    const uniqueCompletedModuleIds = uniqueCompletedPositions
      .map((position) => modules[position] && modules[position].id)
      .filter(Boolean);
    const completedTrack =
      Boolean(trackState.completedTrack) || uniqueCompletedModuleIds.length === modules.length;
    const currentIndex = clampInteger(
      trackState.currentIndex,
      0,
      Math.max(0, modules.length - 1),
      0
    );
    const attempts = clampInteger(trackState.attempts, 0, MAX_ATTEMPTS - 1, 0);

    await client.query(
      `DELETE FROM progress
       WHERE user_id = $1
       AND module_id IN (
         SELECT m.id
         FROM modules m
         INNER JOIN tracks t ON t.id = m.track_id
         WHERE t.id = $2
       )`,
      [userId, track.id]
    );

    for (const moduleId of uniqueCompletedModuleIds) {
      await client.query(
        'INSERT INTO progress (user_id, module_id, status, attempts_used) VALUES ($1, $2, $3, 0)',
        [userId, moduleId, 'completed']
      );
    }

    if (!completedTrack && modules.length > 0) {
      const currentModuleId = modules[currentIndex].id;
      if (!uniqueCompletedModuleIds.includes(currentModuleId)) {
        await client.query(
          'INSERT INTO progress (user_id, module_id, status, attempts_used) VALUES ($1, $2, $3, $4)',
          [userId, currentModuleId, 'in_progress', attempts]
        );
      }
    }
  }
}

app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password required' });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password);

  if (cleanName.length < 2) {
    return res.status(400).json({ error: 'Name must have at least 2 characters' });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'Password must have at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, status',
      [cleanName, cleanEmail, passwordHash]
    );

    const createdUser = userResult.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [createdUser.id, tokenHash, expiresAt]
    );

    const emailResult = await sendVerificationEmail({
      to: cleanEmail,
      name: cleanName,
      token,
    });

    let message = 'Registration successful. Check your email for verification.';
    if (emailResult.mode === 'dev-fallback') {
      message = 'Registration successful. Email fallback is active in development mode.';
    } else if (!emailResult.sent) {
      message = isProduction
        ? 'Registration successful, but email service is currently unavailable.'
        : 'Registration successful. Email service not configured in this environment.';
    }

    const payload = {
      message,
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        verified: false,
      },
    };

    if (!isProduction) {
      payload.devToken = token;
    }

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/auth/verify', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const tokenHash = hashToken(token);
    const tokenResult = await pool.query(
      'SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    const { id, user_id: userId, expires_at: expiresAt, used_at: usedAt } = tokenResult.rows[0];

    if (usedAt) {
      return res.status(400).json({ error: 'Token already used' });
    }

    if (new Date() > new Date(expiresAt)) {
      return res.status(400).json({ error: 'Token expired' });
    }

    await pool.query(
      "UPDATE users SET status = 'active', verified_at = CURRENT_TIMESTAMP WHERE id = $1",
      [userId]
    );
    await pool.query(
      'UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    return res.json({ message: 'Account verified successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  if (!hasJwtSecret) {
    return res.status(500).json({ error: 'JWT secret not configured' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const userResult = await pool.query(
      'SELECT id, name, email, password_hash, status FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(400).json({ error: 'Account not verified' });
    }

    const isValid = await bcrypt.compare(String(password), user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verified: true,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name, email, status, verified_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        verified: user.status === 'active',
        verifiedAt: user.verified_at,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/tracks', async (_, res) => {
  try {
    const tracks = await getTracksWithModules(pool);
    return res.json({ tracks: sanitizeTracks(tracks) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/learning/quiz/config', authenticateToken, async (req, res) => {
  try {
    const tracks = await getTracksWithModules(pool);
    const config = {};
    for (const track of tracks) {
      config[track.slug] = {};
      for (const module of track.modules) {
        config[track.slug][module.position] = getQuizBlueprint(track.slug, module.position);
      }
    }
    return res.json({ config });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/learning/quiz/submit', authenticateToken, async (req, res) => {
  const trackSlug = String(req.body && req.body.trackSlug ? req.body.trackSlug : '').trim();
  const modulePosition = clampInteger(req.body ? req.body.modulePosition : null, 1, 1000, -1);
  const answers = parseQuizAnswers(req.body ? req.body.answers : null);

  if (!trackSlug || modulePosition < 1 || !answers) {
    return res.status(400).json({
      error: 'trackSlug, modulePosition and answers are required',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { tracks, learningState } = await getLearningSnapshot(client, req.user.id);
    const track = tracks.find((item) => item.slug === trackSlug);
    if (!track) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Track not found' });
    }

    const targetModuleIndex = track.modules.findIndex((item) => item.position === modulePosition);
    if (targetModuleIndex === -1) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Module not found' });
    }

    const trackState = learningState.progress[trackSlug];
    if (!trackState || track.modules.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Track progress not initialized' });
    }

    if (trackState.completedTrack) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Track already completed' });
    }

    const expectedModule = track.modules[trackState.currentIndex];
    if (!expectedModule || expectedModule.position !== modulePosition) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Only the current module can be submitted',
        expectedModulePosition: expectedModule ? expectedModule.position : null,
      });
    }

    const answerKey = getQuizAnswerKey(trackSlug, modulePosition);
    if (answers.length !== answerKey.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `answers must contain exactly ${answerKey.length} items`,
      });
    }

    const correctCount = answerKey.reduce(
      (total, correctAnswer, index) => total + (answers[index] === correctAnswer ? 1 : 0),
      0
    );
    const passed = correctCount >= QUIZ_PASS_SCORE;

    const nextPayload = {
      score: learningState.score,
      progress: {},
    };

    for (const item of tracks) {
      const itemState = learningState.progress[item.slug];
      nextPayload.progress[item.slug] = {
        currentIndex: itemState.currentIndex,
        attempts: itemState.attempts,
        completedModulePositions: [...itemState.completedModulePositions],
        completedTrack: itemState.completedTrack,
      };
    }

    const nextTrackState = nextPayload.progress[trackSlug];
    if (passed) {
      const completedSet = new Set(
        uniqueIntegerArray(nextTrackState.completedModulePositions, 0, track.modules.length - 1)
      );
      completedSet.add(targetModuleIndex);
      nextTrackState.completedModulePositions = [...completedSet].sort((a, b) => a - b);
      nextTrackState.attempts = 0;

      const firstNotCompletedIndex = track.modules.findIndex(
        (_, index) => !completedSet.has(index)
      );
      if (firstNotCompletedIndex === -1) {
        nextTrackState.currentIndex = Math.max(0, track.modules.length - 1);
        nextTrackState.completedTrack = true;
      } else {
        nextTrackState.currentIndex = firstNotCompletedIndex;
        nextTrackState.completedTrack = false;
      }
    } else {
      const attemptsAfterFail = clampInteger(
        Number(nextTrackState.attempts) + 1,
        1,
        MAX_ATTEMPTS,
        1
      );
      if (attemptsAfterFail >= MAX_ATTEMPTS) {
        nextTrackState.attempts = 0;
        const rollbackIndex = Math.max(0, nextTrackState.currentIndex - 1);
        nextTrackState.currentIndex = rollbackIndex;

        const completedSet = new Set(
          uniqueIntegerArray(nextTrackState.completedModulePositions, 0, track.modules.length - 1)
        );
        completedSet.delete(rollbackIndex);
        nextTrackState.completedModulePositions = [...completedSet].sort((a, b) => a - b);
      } else {
        nextTrackState.attempts = attemptsAfterFail;
        nextTrackState.completedModulePositions = uniqueIntegerArray(
          nextTrackState.completedModulePositions,
          0,
          track.modules.length - 1
        );
      }
      nextTrackState.completedTrack = false;
    }

    await upsertLearningState(client, req.user.id, nextPayload);
    const { learningState: freshState } = await getLearningSnapshot(client, req.user.id);
    await client.query('COMMIT');

    return res.json({
      message: passed ? 'Quiz passed' : 'Quiz failed',
      result: {
        passed,
        correctCount,
        totalQuestions: answerKey.length,
        passingScore: QUIZ_PASS_SCORE,
        maxAttempts: MAX_ATTEMPTS,
      },
      ...freshState,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/learning/state', authenticateToken, async (req, res) => {
  try {
    const { learningState } = await getLearningSnapshot(pool, req.user.id);
    return res.json(learningState);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/learning/state', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsertLearningState(client, req.user.id, req.body || {});
    const { learningState } = await getLearningSnapshot(client, req.user.id);
    await client.query('COMMIT');

    return res.json({
      message: 'Learning state saved',
      ...learningState,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', env: NODE_ENV });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'down', env: NODE_ENV });
  }
});

app.listen(PORT, () => {
  logStartupConfigWarnings();
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

