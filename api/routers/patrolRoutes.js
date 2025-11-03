const express = require('express');
const { Sequelize, QueryTypes } = require('sequelize'); // ✅ include QueryTypes
const router = express.Router();

// ✅ Initialize Sequelize (ensure credentials are correct)
const sequelize = new Sequelize(
  'Recap4NDC', // Database name
  'postgres',  // Username
  'DB@$ecure#25', // Password
  {
    host: '68.178.167.39',
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: false, // disable SSL if not supported
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

//
// ✅ GET: Patrols without incidents
//
router.get('/patrols/no-incidents/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const query = `
      SELECT
          p.patrol_id AS "patrolId",
          p.patrol_officer_name AS "officerName",
          p.start_time AS "startTime",
          p.end_time AS "endTime",
          p.start_location AS "startLocation",
          p.end_location AS "endLocation",
          p.distance_kms AS "distanceKms",
          CASE
              WHEN p.geom IS NOT NULL THEN ST_AsGeoJSON(p.geom)::jsonb
              ELSE NULL::jsonb
          END AS "patrolRoute",
          p.user_id AS "userId",
          COALESCE(
              (
                SELECT JSONB_AGG(
                    CASE
                        WHEN p_img.image_url LIKE 'http%' THEN p_img.image_url
                        ELSE CONCAT('http://68.178.167.39:5000/', p_img.image_url)
                    END
                )
                FROM patrol_team_images p_img
                WHERE p_img.patrol_id = p.patrol_id
              ),
              '[]'::jsonb
          ) AS "patrolImages"
      FROM patrols p
      WHERE p.user_id = :user_id
        AND NOT EXISTS (
            SELECT 1 FROM incidents i WHERE i.patrol_id = p.patrol_id
        )
      ORDER BY p.start_time DESC
    `;

    const result = await sequelize.query(query, {
      replacements: { user_id },
      type: QueryTypes.SELECT,
    });

    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error('Error fetching patrols without incidents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//
// ✅ POST: Create patrol with images
//
router.post('/patrols/with-images', async (req, res) => {
  try {
    const {
      patrol_officer_name,
      start_time,
      end_time,
      start_location,
      end_location,
      distance_kms,
      latlong,
      user_id,
      images = [],
    } = req.body || {};

    if (!patrol_officer_name || !start_time || !end_time || !user_id) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: patrol_officer_name, start_time, end_time, user_id',
      });
    }

    // ✅ Step 1: Insert patrol (returns patrol_id)
    const insertQuery = `
      INSERT INTO patrols (
        patrol_officer_name,
        start_time,
        end_time,
        start_location,
        end_location,
        distance_kms,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING patrol_id
    `;
    const insertValues = [
      patrol_officer_name,
      start_time,
      end_time,
      start_location || null,
      end_location || null,
      distance_kms || null,
      user_id,
    ];

    const [inserted] = await sequelize.query(insertQuery, {
      bind: insertValues,
      type: QueryTypes.SELECT,
     
    });

    const patrolId = inserted?.patrol_id || inserted?.[0] || inserted;

    if (!patrolId) {
      throw new Error('Failed to create patrol (no ID returned)');
    }

    // ✅ Step 2: Update geometry if latlong provided
    if (latlong) {
      try {
        const points = latlong.split(',').map(coord => {
          const [lat, long] = coord.trim().split(' ');
          return `${long} ${lat}`;
        });
        const wkt = `LINESTRING(${points.join(', ')})`;

        const geomQuery = `
          UPDATE patrols
          SET geom = ST_SetSRID(ST_GeomFromText($1), 4326)
          WHERE patrol_id = $2
        `;
        await sequelize.query(geomQuery, {
          bind: [wkt, patrolId],
          type: QueryTypes.UPDATE,
        });
      } catch (geomError) {
        console.error('Error updating geometry:', geomError);
      }
    }

    // ✅ Step 3: Insert images (if any)
    if (images?.length > 0) {
      for (const image of images) {
        await sequelize.query(
          `INSERT INTO patrol_team_images (patrol_id, image_url) VALUES ($1, $2)`,
          {
            bind: [patrolId, image],
            type: QueryTypes.INSERT,
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Patrol created successfully with images',
      data: {
        patrolId,
        imagesCount: images.length,
        hasRoute: !!latlong,
      },
    });
  } catch (error) {
    console.error('Error creating patrol with images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//
// ✅ PUT: Update patrol details
//
router.put('/patrols/:patrol_id', async (req, res) => {
  try {
    const { patrol_id } = req.params;
    const {
      patrol_officer_name,
      start_time,
      end_time,
      start_location,
      end_location,
      distance_kms,
      latlong,
    } = req.body || {};

    let query = `
      UPDATE patrols
      SET
        patrol_officer_name = $1,
        start_time = $2,
        end_time = $3,
        start_location = $4,
        end_location = $5,
        distance_kms = $6
    `;
    const values = [
      patrol_officer_name,
      start_time,
      end_time,
      start_location || null,
      end_location || null,
      distance_kms || null,
    ];

    if (latlong) {
      const points = latlong.split(',').map(coord => {
        const [lat, long] = coord.trim().split(' ');
        return `${long} ${lat}`;
      });
      const wkt = `LINESTRING(${points.join(', ')})`;
      query += `, geom = ST_SetSRID(ST_GeomFromText($${values.length + 1}), 4326)`;
      values.push(wkt);
    }

    query += ` WHERE patrol_id = $${values.length + 1} RETURNING *`;
    values.push(patrol_id);

    const result = await sequelize.query(query, {
      bind: values,
      type: QueryTypes.SELECT,
    });

    if (!result?.length) {
      return res.status(404).json({ success: false, error: 'Patrol not found' });
    }

    res.json({
      success: true,
      message: 'Patrol updated successfully',
      data: result[0],
    });
  } catch (error) {
    console.error('Error updating patrol:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

//
// ✅ POST: Add images to an existing patrol
//
router.post('/patrols/:patrol_id/images', async (req, res) => {
  try {
    const { patrol_id } = req.params;
    const { images } = req.body || {};

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ success: false, error: 'Images array is required' });
    }

    let insertedCount = 0;
    for (const image of images) {
      try {
        await sequelize.query(
          `INSERT INTO patrol_team_images (patrol_id, image_url) VALUES ($1, $2)`,
          { bind: [patrol_id, image], type: QueryTypes.INSERT }
        );
        insertedCount++;
      } catch (err) {
        console.error('Error inserting image:', err);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Images added successfully',
      data: { insertedCount, totalAttempted: images.length },
    });
  } catch (error) {
    console.error('Error adding patrol images:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


