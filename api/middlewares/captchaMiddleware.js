// middlewares/captchaMiddleware.js
// Custom text-based CAPTCHA: generates an image with random characters,
// stores the text in an in-memory Map with expiration, and verifies user input.

const crypto = require('crypto');
const { createCanvas } = require('canvas');

// ── In-memory captcha store: id -> { text, expiresAt } ──
const captchaStore = new Map();
const CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired captchas periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of captchaStore) {
    if (entry.expiresAt < now) captchaStore.delete(id);
  }
}, 60 * 1000); // every minute

// ── Characters used for captcha (no ambiguous chars like O/0, I/1) ──
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CAPTCHA_LENGTH = 6;

function generateText() {
  let text = '';
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    text += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return text;
}

function generateCaptchaImage(text) {
  const width = 200;
  const height = 70;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);

  // Random noise lines
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // Random noise dots
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},0.5)`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw each character with random rotation, color, and vertical offset
  ctx.font = 'bold 34px Arial';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (let i = 0; i < text.length; i++) {
    const x = 25 + i * 30;
    const y = 35 + (Math.random() * 10 - 5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.5);
    ctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 70%, 35%)`;
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL();
}

// ── Generate a new captcha and return { id, image } ──
function generateCaptcha() {
  const text = generateText();
  const id = crypto.randomBytes(16).toString('hex');
  captchaStore.set(id, {
    text,
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
  });
  const image = generateCaptchaImage(text);
  return { id, image };
}

// ── Express route: GET /api/captcha ──
function captchaRoute(req, res) {
  const { id, image } = generateCaptcha();
  res.json({ id, image });
}

// ── Middleware: verify captcha on protected routes ──
// Expects req.body.captchaId and req.body.captchaText
function verifyCaptcha(req, res, next) {
  const { captchaId, captchaText } = req.body || {};

  if (!captchaId || !captchaText) {
    return res.status(400).json({
      success: false,
      error: 'CAPTCHA ID and text are required',
    });
  }

  const entry = captchaStore.get(captchaId);
  if (!entry) {
    return res.status(400).json({
      success: false,
      error: 'CAPTCHA expired or invalid. Please refresh the image.',
    });
  }

  if (entry.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({
      success: false,
      error: 'CAPTCHA expired. Please refresh the image.',
    });
  }

  // Case-insensitive comparison
  if (captchaText.trim().toUpperCase() !== entry.text.toUpperCase()) {
    // Delete after failed attempt to force refresh
    captchaStore.delete(captchaId);
    return res.status(400).json({
      success: false,
      error: 'Incorrect CAPTCHA text. Please try again.',
    });
  }

  // Valid — delete so it can't be reused
  captchaStore.delete(captchaId);
  req.captchaVerified = true;
  next();
}

module.exports = { captchaRoute, verifyCaptcha, generateCaptcha };
