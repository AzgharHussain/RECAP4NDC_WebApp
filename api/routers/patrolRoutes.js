const express = require('express');
const { Client } = require('pg');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();

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

// Multer memory storage (files are stored in memory as buffers)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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

    // Convert images to base64 and insert
    const insertImage = async (fileArray, imageType) => {
      if (!fileArray) return;
      for (const file of fileArray) {
        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype;
        
        await client.query(
          `INSERT INTO patrol_team_images (image_data, image_type, patrol_id, image_category) VALUES ($1,$2,$3,$4)`,
          [base64Image, mimeType, patrol_id, imageType]
        );
      }
    };

    // Insert start and end images with their types
    await insertImage(req.files.start_image, 'start_image');
    await insertImage(req.files.end_image, 'end_image');

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
        MAX(CASE WHEN i.image_category = 'start_image' THEN i.image_data END) AS start_image_data,
        MAX(CASE WHEN i.image_category = 'start_image' THEN i.image_type END) AS start_image_type,
        MAX(CASE WHEN i.image_category = 'end_image' THEN i.image_data END) AS end_image_data,
        MAX(CASE WHEN i.image_category = 'end_image' THEN i.image_type END) AS end_image_type
      FROM patrols p
      LEFT JOIN patrol_team_images i ON p.patrol_id = i.patrol_id
      GROUP BY p.patrol_id
      ORDER BY p.patrol_id DESC;
    `;

    const result = await client.query(query);

    // Format response with data URLs for easy frontend usage
    const formattedData = result.rows.map(patrol => ({
      ...patrol,
      start_image: patrol.start_image_data ? 
        `data:${patrol.start_image_type};base64,${patrol.start_image_data}` : null,
      end_image: patrol.end_image_data ? 
        `data:${patrol.end_image_type};base64,${patrol.end_image_data}` : null
    }));

    res.json({ message: 'All patrols fetched successfully', data: formattedData });

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
        MAX(CASE WHEN i.image_category = 'start_image' THEN i.image_data END) AS start_image_data,
        MAX(CASE WHEN i.image_category = 'start_image' THEN i.image_type END) AS start_image_type,
        MAX(CASE WHEN i.image_category = 'end_image' THEN i.image_data END) AS end_image_data,
        MAX(CASE WHEN i.image_category = 'end_image' THEN i.image_type END) AS end_image_type
      FROM patrols p
      LEFT JOIN patrol_team_images i ON p.patrol_id = i.patrol_id
      WHERE p.patrol_id = $1
      GROUP BY p.patrol_id;
    `;

    const result = await client.query(query, [patrol_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Patrol not found' });
    }

    const patrol = result.rows[0];
    
    // Format response with data URLs
    const formattedPatrol = {
      ...patrol,
      start_image: patrol.start_image_data ? 
        `data:${patrol.start_image_type};base64,${patrol.start_image_data}` : null,
      end_image: patrol.end_image_data ? 
        `data:${patrol.end_image_type};base64,${patrol.end_image_data}` : null
    };

    res.json({ message: 'Patrol fetched successfully', data: formattedPatrol });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patrol' });
  }
});

// Optional: Separate endpoint to get just images if needed
router.get('/patrols/:patrol_id/images/:image_type', async (req, res) => {
  const { patrol_id, image_type } = req.params;

  try {
    const query = `
      SELECT image_data, image_type 
      FROM patrol_team_images 
      WHERE patrol_id = $1 AND image_category = $2
      LIMIT 1;
    `;

    const result = await client.query(query, [patrol_id, image_type]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const image = result.rows[0];
    const imageBuffer = Buffer.from(image.image_data, 'base64');
    
    res.set('Content-Type', image.image_type);
    res.send(imageBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

module.exports = router;