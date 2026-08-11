const express = require('express');
const { Sequelize } = require('sequelize');
const router = express.Router();

const { sequelize } = require('../config/database');
const { verifyJwt } = require('../middlewares/verifyJwt');

const SUPPORT_RATE_LIMIT = require('express-rate-limit')({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many support requests. Please wait a minute.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISSUE_TYPES = ['login', 'mobile_app', 'web_app', 'ndvi', 'patrolling', 'coupe', 'data_sync', 'other'];

// ── Auto-create support_tickets table on module load ─────────────────────────
(async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        issue_type VARCHAR(50),
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[Support] support_tickets table ready');
  } catch (err) {
    console.error('[Support] Failed to create support_tickets table:', err.message);
  }
})();

router.post('/support/submit', SUPPORT_RATE_LIMIT, async (req, res) => {
  try {
    const { name, email, subject, issueType, description } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Name is required (min 2 characters)' });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required' });
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Subject is required' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Description must be at least 10 characters' });
    }
    if (issueType && !ISSUE_TYPES.includes(issueType)) {
      return res.status(400).json({ success: false, error: 'Invalid issue type' });
    }

    const ticketId = `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    try {
      await sequelize.query(
        `INSERT INTO support_tickets (ticket_id, name, email, subject, issue_type, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW())`,
        {
          bind: [
            ticketId,
            name.trim().slice(0, 100),
            email.trim().slice(0, 255),
            subject.trim().slice(0, 200),
            issueType || 'other',
            description.trim().slice(0, 5000),
          ],
          type: Sequelize.QueryTypes.INSERT,
        }
      );
    } catch (dbErr) {
      console.error('Support ticket DB insert failed:', dbErr.message);
    }

    console.log(`[Support] Ticket ${ticketId} from ${email}: ${subject}`);

    res.json({
      success: true,
      ticketId,
      message: 'Support request submitted successfully',
    });
  } catch (error) {
    console.error('Support submit error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit support request' });
  }
});

// ── Admin: list all tickets ──────────────────────────────────────────────────
router.get('/support/tickets', verifyJwt, async (req, res) => {
  try {
    const tickets = await sequelize.query(
      `SELECT id, ticket_id, name, email, subject, issue_type, description, status, created_at
       FROM support_tickets
       ORDER BY created_at DESC
       LIMIT 500`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Support list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
  }
});

// ── Admin: delete a ticket ───────────────────────────────────────────────────
router.delete('/support/tickets/:id', verifyJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const ticketId = parseInt(id, 10);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ticket id' });
    }
    const result = await sequelize.query(
      `DELETE FROM support_tickets WHERE id = $1 RETURNING id`,
      { bind: [ticketId], type: Sequelize.QueryTypes.SELECT }
    );
    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    console.error('Support delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete ticket' });
  }
});

// ── Admin: update ticket status ──────────────────────────────────────────────
router.patch('/support/tickets/:id/status', verifyJwt, async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body || {};
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const ticketId = parseInt(id, 10);
    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ticket id' });
    }
    const result = await sequelize.query(
      `UPDATE support_tickets SET status = $1 WHERE id = $2 RETURNING id`,
      { bind: [newStatus, ticketId], type: Sequelize.QueryTypes.SELECT }
    );
    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Support status update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

module.exports = router;
