const express = require('express');
const router = express.Router();
const multer = require('multer');
const { sequelize } = require('../config/r_quire');
const fs = require('fs'); 
const path = require('path');

// POST: Create new NDVI record (with auto-generated ID)
router.post('/ndvi-change', async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
        // 1️⃣ Create columns if NOT EXISTS
        const alterTableQuery = `
            ALTER TABLE public."${tableName}"
            ADD COLUMN IF NOT EXISTS Pixle_id SERIAL PRIMARY KEY,
            ADD COLUMN IF NOT EXISTS note TEXT,
            ADD COLUMN IF NOT EXISTS image_data TEXT,
            ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `;

        await sequelize.query(alterTableQuery);

        // 2️⃣ Fetch all data
        const selectQuery = `
            SELECT Pixle_id, longitude, latitude
            FROM public."${tableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process NDVI change data',
            error: error.message
        });
    }
});

router.post('/get-coupe-area', async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
       

       

        // 2️⃣ Fetch all data
        const selectQuery = `
            SELECT
    SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
FROM
    public."${tableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process NDVI change data',
            error: error.message
        });
    }
});

router.post('/ndvi-change-degraded-area', async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
       

       

        // 2️⃣ Fetch all data
        const selectQuery = `
            SELECT
    SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
FROM
    public."${tableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process NDVI change data',
            error: error.message
        });
    }
});



router.post('/coupe-area', async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
       

       

        // 2️⃣ Fetch all data
        const selectQuery = `
            SELECT
    SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
FROM
    public."${tableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process NDVI change data',
            error: error.message
        });
    }
});


router.post('/ndvi-change-get', async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
         // 1️⃣ Create columns if NOT EXISTS
        const alterTableQuery = `
            ALTER TABLE public."${tableName}"
            ADD COLUMN IF NOT EXISTS Pixle_id SERIAL PRIMARY KEY,
            ADD COLUMN IF NOT EXISTS note TEXT,
            ADD COLUMN IF NOT EXISTS image_data TEXT,
            ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `;

        await sequelize.query(alterTableQuery);


        // 2️⃣ Fetch all data
        const selectQuery = `
           SELECT *
            FROM public."${tableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process NDVI change data',
            error: error.message
        });
    }
});



// GET: Get single NDVI record by ID
router.get('/ndvi-change/:id', async (req, res) => {
    const { tableName } = req.query;
    const { id } = req.params;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName query parameter is required'
        });
    }

    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'Valid ID is required'
        });
    }

    try {
        const selectQuery = `
           SELECT *
            FROM public."${tableName}"
            WHERE Pixle_id = ${id};
        `;

        const [results] = await sequelize.query(selectQuery);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Record with ID ${id} not found`
            });
        }

        res.json({
            success: true,
            message: 'Record fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error fetching NDVI record by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch NDVI record',
            error: error.message
        });
    }
});


// Configure multer for file upload (if you want to handle file uploads)
const upload = multer({
  dest: 'uploads/', // temporary upload directory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Helper function to convert image to base64
const imageToBase64 = (imagePath) => {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Get file extension
    const ext = path.extname(imagePath).toLowerCase().substring(1);
    
    // Determine MIME type based on extension
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    
    const mimeType = mimeTypes[ext] || 'image/jpeg';
    
    // Convert to base64
    const base64Data = imageBuffer.toString('base64');
    
    // Return data URL format
    return `${base64Data}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};


// PUT: Update NDVI record by ID with image handling - FIXED VERSION
router.put('/ndvi-change/:id', upload.single('image_data'), async (req, res) => {
  const { tableName, note, status } = req.body;
  const { id } = req.params;
  const imageFile = req.file;



  if (!tableName) {
    return res.status(400).json({
      success: false,
      message: 'tableName is required in request body'
    });
  }

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'Valid ID is required'
    });
  }

  try {
    // Build dynamic update query based on provided fields
    const updates = [];
    const replacements = { id: parseInt(id) };

    if (note !== undefined) {
      updates.push('note = :note');
      replacements.note = note;
    }
    
    // Handle image data
    let imageDataBase64 = null;
    
    // Check if image is uploaded via file
    if (imageFile) {
      try {
        // Convert uploaded file to base64
        imageDataBase64 = imageToBase64(imageFile.path);
        updates.push('image_data = :image_data');
        replacements.image_data = imageDataBase64;
        
        // Clean up temporary file
        fs.unlinkSync(imageFile.path);
      } catch (error) {
        console.error('Error processing uploaded file:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to process uploaded image file',
          error: error.message
        });
      }
    } 
    // Alternatively, check if image_data is provided as base64 in body
    else if (req.body.image_data) {
      imageDataBase64 = req.body.image_data;
      updates.push('image_data = :image_data');
      replacements.image_data = imageDataBase64;
    }
    
    if (status !== undefined) {
      updates.push('status = :status');
      replacements.status = status;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updateQuery = `
      UPDATE public."${tableName}"
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE Pixle_id = :id
      RETURNING Pixle_id, longitude, latitude, note, image_data, status;
    `;

    const [results] = await sequelize.query(updateQuery, {
      replacements: replacements,
      type: sequelize.QueryTypes.UPDATE
    });

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Record with ID ${id} not found`
      });
    }

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: results[0]
    });

  } catch (error) {
    console.error('Error updating NDVI record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NDVI record',
      error: error.message
    });
  }
});




// Alternative version without multer (if you prefer base64 in request body only)
router.put('/ndvi-change-base64/:id', async (req, res) => {
  const { tableName, note, image_data, status } = req.body;
  const { id } = req.params;

  if (!tableName) {
    return res.status(400).json({
      success: false,
      message: 'tableName is required in request body'
    });
  }

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'Valid ID is required'
    });
  }

  try {
    // Build dynamic update query based on provided fields
    const updates = [];
    const replacements = { id: parseInt(id) };

    if (note !== undefined) {
      updates.push('note = :note');
      replacements.note = note;
    }
    
    // Handle image_data (expected to be base64 string)
    if (image_data !== undefined) {
      // Optional: Validate base64 format
      if (typeof image_data === 'string' && image_data.startsWith('data:image')) {
        updates.push('image_data = :image_data');
        replacements.image_data = image_data;
      } else {
        return res.status(400).json({
          success: false,
          message: 'image_data should be a valid base64 image string starting with data:image'
        });
      }
    }
    
    if (status !== undefined) {
      updates.push('status = :status');
      replacements.status = status;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updateQuery = `
      UPDATE public."${tableName}"
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = :id
      RETURNING id, longitude, latitude, note, image_data, status;
    `;

    const [results] = await sequelize.query(updateQuery, {
      replacements: replacements,
      type: sequelize.QueryTypes.UPDATE
    });

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Record with ID ${id} not found`
      });
    }

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: results[0]
    });

  } catch (error) {
    console.error('Error updating NDVI record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NDVI record',
      error: error.message
    });
  }
});

// DELETE: Delete NDVI record by ID
router.delete('/ndvi-change/:id', async (req, res) => {
    const { tableName } = req.query;
    const { id } = req.params;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName query parameter is required'
        });
    }

    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'Valid ID is required'
        });
    }

    try {
        // First check if record exists
        const checkQuery = `
            SELECT id FROM public."${tableName}" WHERE id = :id;
        `;

        const [existingRecord] = await sequelize.query(checkQuery, {
            replacements: { id: parseInt(id) },
            type: sequelize.QueryTypes.SELECT
        });

        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: `Record with ID ${id} not found`
            });
        }

        // Delete the record
        const deleteQuery = `
            DELETE FROM public."${tableName}"
            WHERE id = :id
            RETURNING id;
        `;

        const [deletedRecord] = await sequelize.query(deleteQuery, {
            replacements: { id: parseInt(id) },
            type: sequelize.QueryTypes.DELETE
        });

        res.json({
            success: true,
            message: `Record with ID ${id} deleted successfully`,
            data: { deletedId: id }
        });

    } catch (error) {
        console.error('Error deleting NDVI record:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete NDVI record',
            error: error.message
        });
    }
});



module.exports = router;
