const express = require('express');
const AuditLog = require('../models/AuditLog');
const { verifyJwt } = require('../middlewares/verifyJwt');
const { logFromRequest } = require('../utils/auditLogger');
const router = express.Router();

router.get('/audit-logs', verifyJwt, async (req, res) => {
  try {
    const {
      action,
      status,
      userId,
      username,
      resourceType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (username) filter.username = username;
    if (resourceType) filter.resourceType = resourceType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Audit log retrieval error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
  }
});

router.get('/audit-logs/stats', verifyJwt, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    const stats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            action: '$action',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          action: '$_id.action',
          status: '$_id.status',
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Audit log stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve audit stats' });
  }
});

router.get('/audit-logs/export', verifyJwt, async (req, res) => {
  try {
    const {
      action,
      status,
      userId,
      username,
      resourceType,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (username) filter.username = username;
    if (resourceType) filter.resourceType = resourceType;

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(5000)
      .select('-__v -_id')
      .lean();

    const headers = [
      'logId',
      'timestamp',
      'action',
      'status',
      'statusCode',
      'method',
      'endpoint',
      'userId',
      'username',
      'userRole',
      'ipAddress',
      'resourceType',
      'resourceId',
      'errorMessage',
      'retentionCategory',
    ];

    const csvRows = [headers.join(',')];
    for (const log of logs) {
      const row = headers.map((h) => {
        const val = log[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'string' ? val.replace(/"/g, '""') : String(val);
        return `"${str}"`;
      });
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    res.status(200).send(csvRows.join('\n'));
  } catch (err) {
    console.error('Audit log export error:', err);
    res.status(500).json({ success: false, error: 'Failed to export audit logs' });
  }
});

module.exports = router;
