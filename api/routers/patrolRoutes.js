const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Ensure folders exist
const baseDir = 'uploads';
const subDirs = ['team_start_images', 'team_end_images'];

if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

subDirs.forEach(subDir => {
  const fullPath = path.join(baseDir, subDir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath);
});




// PostgreSQL client
const client = new Client({
  host: '68.178.167.39',
  user: 'postgres',
  password: 'DB@$ecure#25',
  port: 5432,
  database: 'Recap4NDC'
});

client.connect()
  .then(() => console.log('Database connected'))
  .catch(() => console.log('Database not connected'));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'start_image') cb(null, 'uploads/team_start_images');
    else if (file.fieldname === 'end_image') cb(null, 'uploads/team_end_images');
    else cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// POST route for patrol
router.post('/patrol-post', upload.fields([
  { name: 'start_image', maxCount: 1 },
  { name: 'end_image', maxCount: 1 }
]), async (req, res) => {
  const pat_data = req.body;

  // Check required fields
  for (let key of Object.keys(pat_data)) {
    if (!pat_data[key]) return res.status(400).json({ error: `Missing field: ${key}` });
  }

  if (!req.files || (!req.files.start_image && !req.files.end_image)) {
    return res.status(400).json({ error: 'Files missing' });
  }

  try {
    // Insert patrol data
    const query1 = `
      INSERT INTO patrols (patrol_officer_name, start_time, end_time,
        start_location, end_location, distance_kms, geom, user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING patrol_id;
    `;

    const result = await client.query(query1, [
      pat_data.patrol_officer_name,
      pat_data.start_time,
      pat_data.end_time,
      pat_data.start_location,
      pat_data.end_location,
      pat_data.distance_kms,
      pat_data.geom,
      pat_data.user_id
    ]);

    const patrol_id = result.rows[0].patrol_id;

    // Insert images
    const insertImage = async (fileArray) => {
      if (!fileArray) return;
      for (const file of fileArray) {
        const image_url = file.path.replace(/\\/g, '/'); // fix Windows paths
        await client.query(
          `INSERT INTO patrol_team_images (image_url, patrol_id) VALUES ($1,$2)`,
          [image_url, patrol_id]
        );
      }
    };

    await insertImage(req.files.start_image);
    await insertImage(req.files.end_image);

    res.json({ message: 'Data created successfully', patrol_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Data insertion failed' });
  }
});

// GET all patrols
router.get('/patrol-info', async (req, res) => {
  try {
    const query = `
      SELECT p.*, 
        MAX(CASE WHEN i.image_url LIKE '%team_start_images%' THEN i.image_url END) AS start_image,
        MAX(CASE WHEN i.image_url LIKE '%team_end_images%' THEN i.image_url END) AS end_image
      FROM patrols p
      LEFT JOIN patrol_team_images i ON p.patrol_id = i.patrol_id
      GROUP BY p.patrol_id
      ORDER BY p.patrol_id DESC;
    `;

    const result = await client.query(query);

    res.json({ message: 'All patrols fetched successfully', data: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrols' });
  }
});

// GET patrol by ID
router.get('/patrols/:patrol_id', async (req, res) => {
  const { patrol_id } = req.params;

  try {
    const query = `
      SELECT p.*, 
        MAX(CASE WHEN i.image_url LIKE '%team_start_images%' THEN i.image_url END) AS start_image,
        MAX(CASE WHEN i.image_url LIKE '%team_end_images%' THEN i.image_url END) AS end_image
      FROM patrols p
      LEFT JOIN patrol_team_images i ON p.patrol_id = i.patrol_id
      WHERE p.patrol_id = $1
      GROUP BY p.patrol_id;
    `;

    const result = await client.query(query, [patrol_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patrol not found' });
    }

    res.json({ message: 'Patrol fetched successfully', data: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrol' });
  }
});

module.exports = router;