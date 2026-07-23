const express = require('express');
const router = express.Router();
const multer = require('multer');
const { sequelize } = require('../config/r_quire');
const fs = require('fs'); 
const path = require('path');
const MongoImage = require('../models/Image');

const { verifyJwt } = require("../middlewares/verifyJwt"); 
const { clean } = require("../middlewares/sanitize");
const { logFromRequest } = require("../utils/auditLogger");
const { body, param, validationResult } = require('express-validator');

// POST: Create new NDVI record (with auto-generated ID)
router.post('/ndvi-change', verifyJwt, async (req, res) => {

 const { coupename, village_name } = req.body;

 if (!coupename || !village_name) {
   return res.status(400).json({
     success: false,
     message: 'Bad Request'
   });
 }

  const tableRegex = /^[a-zA-Z0-9_-]+$/;

 if (!tableRegex.test(coupename)) {
   return res.status(400).json({
     success: false,
     message: 'Invalid table name'
   });
 }

 try {

   const alterTableQuery = `
     ALTER TABLE public."${coupename}"
     ADD COLUMN IF NOT EXISTS pixle_id SERIAL PRIMARY KEY,
     ADD COLUMN IF NOT EXISTS note TEXT,
     ADD COLUMN IF NOT EXISTS image_data TEXT,
     ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT true,
     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
   `;

   await sequelize.query(alterTableQuery);

   const selectQuery = `
     SELECT pixle_id, longitude, latitude
     FROM public."${coupename}"
     WHERE village = :village_name
     order by pixle_id desc
   `;

   const [results] = await sequelize.query(selectQuery, {
     replacements: { village_name }
   });

   res.json({
     success: true,
     data: results
   });

 } catch (error) {
   res.status(500).json({
     success: false,
     message: 'Server error'
   });
 }

});

// Update the transformTableName function to handle all cases
const transformTableName = (tableName, division) => {
  if (!division || !tableName) return tableName;
  
  const lowerDivision = division.toLowerCase();
  
  // Mapping for special cases
  const DIVISION_TO_COUPE_MAP = {
    'aravalli': 'aravalli',
    'bharuch sub division': 'bharuchsubdivision',
    'bharuch_sub_division': 'bharuchsubdivision',
  };

  // Check if this division needs mapping (handle both with and without underscores)
  let mappedCoupe = null;
  
  // Try exact match first
  if (DIVISION_TO_COUPE_MAP[lowerDivision]) {
    mappedCoupe = DIVISION_TO_COUPE_MAP[lowerDivision];
  } else {
    // Try without underscores
    const divisionWithoutUnderscores = lowerDivision.replace(/_/g, ' ');
    if (DIVISION_TO_COUPE_MAP[divisionWithoutUnderscores]) {
      mappedCoupe = DIVISION_TO_COUPE_MAP[divisionWithoutUnderscores];
    }
  }

  if (mappedCoupe) {
    console.log(`[transformTableName] Mapping ${lowerDivision} to ${mappedCoupe}`);
    
    // Handle NDVI Change table format: YYYY-MM-DD_division_coupe_NDVI_Change
    if (tableName.includes('_NDVI_Change')) {
      const tableParts = tableName.split('_');
      
      if (tableParts.length >= 4) {
        const datePart = tableParts[0];
        // Find where the division part ends (it could be multiple words)
        // The format is: date_division_coupe_NDVI_Change
        // So after date, everything until "_NDVI_Change" is the division
        let divisionParts = [];
        let i = 1;
        while (i < tableParts.length - 2) { // -2 for "NDVI" and "Change"
          divisionParts.push(tableParts[i]);
          i++;
        }
        
        const suffix = tableParts.slice(-2).join('_'); // "NDVI_Change"
        
        // Construct new table name with mapped coupe
        const newTableName = `${datePart}_${mappedCoupe}_coupe_${suffix}`;
        console.log(`[transformTableName] Transformed: ${tableName} -> ${newTableName}`);
        return newTableName;
      }
    }
  }
  
  return tableName;
};

// Update the first endpoint
router.post('/ndvi-change-get-filtered', verifyJwt, async (req, res) => {
    let { tableName, range, round, beat, division } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    try {
        // Transform table name if needed based on division
        const actualTableName = transformTableName(tableName, division);
        
        console.log(`[ndvi-change-get-filtered] Original: ${tableName}, Division: ${division}, Transformed to: ${actualTableName}`);

        // Check if the table exists before doing anything else.
        // NDVI change tables are only generated for divisions/dates that have
        // processed data, so a missing table simply means there is no data yet.
        const [tableExistsResult] = await sequelize.query(
            `SELECT to_regclass('public."${actualTableName}"') AS regclass;`
        );
        const tableExists = tableExistsResult[0] && tableExistsResult[0].regclass;

        if (!tableExists) {
            console.log(`[ndvi-change-get-filtered] Table not found, returning empty data: ${actualTableName}`);
            return res.json({
                success: true,
                data: []
            });
        }

        // Build WHERE clause based on hierarchy filters
        let whereClause = '';
        const conditions = [];
        
        if (range) {
            conditions.push(`range = '${range}'`);
        }
        if (round) {
            conditions.push(`round = '${round}'`);
        }
        if (beat) {
            conditions.push(`beat = '${beat}'`);
        }
        
        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // First ensure columns exist
        const alterTableQuery = `
            ALTER TABLE public."${actualTableName}"
            ADD COLUMN IF NOT EXISTS pixle_id SERIAL PRIMARY KEY,
            ADD COLUMN IF NOT EXISTS note TEXT,
            ADD COLUMN IF NOT EXISTS image_data TEXT,
            ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `;

        await sequelize.query(alterTableQuery);

        // Fetch filtered data (image_data fetched separately from MongoDB)
        const selectQuery = `
            SELECT *
            FROM public."${actualTableName}"
            ${whereClause};
        `;

        const [results] = await sequelize.query(selectQuery);
        results.forEach(row => { delete row.image_data; });

        // Fetch images from MongoDB for these records
        if (results && results.length > 0) {
          const recordIds = results.map(r => r.pixle_id).filter(Boolean);
          if (recordIds.length > 0) {
            const mongoImages = await MongoImage.find({
              sourceType: 'ndvi',
              coupeName: actualTableName,
              recordId: { $in: recordIds }
            }).lean();
            const imgMap = {};
            mongoImages.forEach(img => { imgMap[img.recordId] = img; });
            results.forEach(row => {
              const img = imgMap[row.pixle_id];
              row.image_data = img ? img.imageData : null;
              row.image_type = img ? img.imageType : null;
            });
          }
        }

        res.json({
            success: true,
            message: 'Filtered data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in filtered NDVI API:', error);
        res.status(500).json({
            success: false,
            message: 'Server encountered an unexpected condition'
        });
    }
});

// Update the second endpoint
// Update the degraded area endpoint
router.post('/ndvi-change-degraded-area', verifyJwt, async (req, res) => {
    let { tableName, range, round, beat, division } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    try {
        // Transform table name if needed based on division
        const actualTableName = transformTableName(tableName, division);
        
        console.log(`[ndvi-change-degraded-area] Original: ${tableName}, Division: ${division}, Transformed to: ${actualTableName}`);

        // Build WHERE clause based on hierarchy filters
        let whereClause = '';
        const conditions = [];
        
        if (range) {
            conditions.push(`range = '${range}'`);
        }
        if (round) {
            conditions.push(`round = '${round}'`);
        }
        if (beat) {
            conditions.push(`beat = '${beat}'`);
        }
        
        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        // Try different approaches for area calculation
        const selectQuery = `
            SELECT
                SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
            FROM
                public."${actualTableName}"
            ${whereClause};
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Filtered area fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in filtered degraded area API:', error);
        
        // If the first approach fails, try with ST_Transform
        try {
            console.log('Trying with ST_Transform...');
            const { tableName, range, round, beat, division } = req.body;
            const actualTableName = transformTableName(tableName, division);
            
            let whereClause = '';
            const conditions = [];
            
            if (range) conditions.push(`range = '${range}'`);
            if (round) conditions.push(`round = '${round}'`);
            if (beat) conditions.push(`beat = '${beat}'`);
            
            if (conditions.length > 0) {
                whereClause = 'WHERE ' + conditions.join(' AND ');
            }
            
            // Try with ST_Transform to convert to WGS84 (4326) which is lat/lon
            const selectQuery = `
                SELECT
                    SUM(ST_Area(ST_Transform(geom, 4326)::geography) / 1000000) AS total_area_sq_km
                FROM
                    public."${actualTableName}"
                ${whereClause};
            `;

            const [results] = await sequelize.query(selectQuery);
            
            res.json({
                success: true,
                message: 'Filtered area fetched successfully (with transform)',
                data: results
            });
        } catch (transformError) {
            console.error('Both area calculation methods failed:', transformError);
            res.status(500).json({
                success: false,
                message: 'Server encountered an unexpected condition',
               
            });
        }
    }
});

// router.post('/ndvi-change-degraded-area', verifyJwt, async (req, res) => {
//     const { tableName } = req.body;

//     if (!tableName) {
//         return res.status(400).json({
//             success: false,
//             message: 'tableName is required'
//         });
//     }

//     try {
       

       

//         // 2️⃣ Fetch all data
//         const selectQuery = `
//             SELECT
//     SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
// FROM
//     public."${tableName}";
//         `;

//         const [results] = await sequelize.query(selectQuery);

//         res.json({
//             success: true,
//             message: 'Columns verified and data fetched successfully',
//             data: results
//         });

//     } catch (error) {
//         console.error('Error in NDVI change API:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to process NDVI change data',
//             error: error.message
//         });
//     }
// });



router.post('/coupe-area',verifyJwt, async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
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
            message: 'Server encountered an unexpected condition',
            
        });
    }
});


// router.post('/ndvi-change-get', verifyJwt, async (req, res) => {
//     const { tableName } = req.body;

//     if (!tableName) {
//         return res.status(400).json({
//             success: false,
//             message: 'tableName is required'
//         });
//     }

//     try {
//          // 1️⃣ Create columns if NOT EXISTS
//         const alterTableQuery = `
//             ALTER TABLE public."${tableName}"
//             ADD COLUMN IF NOT EXISTS pixle_id SERIAL PRIMARY KEY,
//             ADD COLUMN IF NOT EXISTS note TEXT,
//             ADD COLUMN IF NOT EXISTS image_data TEXT,
//             ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT false,
//             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//             ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
//         `;

//         await sequelize.query(alterTableQuery);


//         // 2️⃣ Fetch all data
//         const selectQuery = `
//            SELECT *
//             FROM public."${tableName}";
//         `;

//         const [results] = await sequelize.query(selectQuery);

//         res.json({
//             success: true,
//             message: 'Columns verified and data fetched successfully',
//             data: results
//         });

//     } catch (error) {
//         console.error('Error in NDVI change API:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to process NDVI change data',
//             error: error.message
//         });
//     }
// });

router.post('/ndvi-change-get', verifyJwt, async (req, res) => {
    const { NdvicoupeName } = req.body;

    if (!NdvicoupeName) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    // Whitelist validation for table name pattern: YYYY-MM-DD_location_coupe_NDVI_Change
    const tableNamePattern = /^\d{4}-\d{2}-\d{2}_[a-z]+_coupe_NDVI_Change$/;
    
    if (!tableNamePattern.test(NdvicoupeName)) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    try {
        // 1️⃣ Create columns if NOT EXISTS
        const alterTableQuery = `
            ALTER TABLE public."${NdvicoupeName}"
            ADD COLUMN IF NOT EXISTS pixle_id SERIAL PRIMARY KEY,
            ADD COLUMN IF NOT EXISTS note TEXT,
            ADD COLUMN IF NOT EXISTS image_data TEXT,
            ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        `;

        await sequelize.query(alterTableQuery);

        // 2️⃣ Fetch all data (image_data fetched separately from MongoDB)
        const selectQuery = `
            SELECT *
            FROM public."${NdvicoupeName}";
        `;

        const [results] = await sequelize.query(selectQuery);
        results.forEach(row => { delete row.image_data; });

        // Fetch images from MongoDB for these records
        if (results && results.length > 0) {
          const recordIds = results.map(r => r.pixle_id).filter(Boolean);
          if (recordIds.length > 0) {
            const mongoImages = await MongoImage.find({
              sourceType: 'ndvi',
              coupeName: NdvicoupeName,
              recordId: { $in: recordIds }
            }).lean();
            const imgMap = {};
            mongoImages.forEach(img => { imgMap[img.recordId] = img; });
            results.forEach(row => {
              const img = imgMap[row.pixle_id];
              row.image_data = img ? img.imageData : null;
              row.image_type = img ? img.imageType : null;
            });
          }
        }

        res.json({
            success: true,
            message: 'Columns verified and data fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in NDVI change API:', error);
        res.status(500).json({
            success: false,
            message: 'Server encountered an unexpected condition',
            
        });
    }
});


// GET: Get single NDVI record by ID
router.get('/ndvi-change', verifyJwt, async (req, res) => {
    const { NdvicoupeName } = req.body;
    const { id } = req.body;

    if (!NdvicoupeName) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    // Whitelist validation for table name pattern: YYYY-MM-DD_location_coupe_NDVI_Change
 const tableNamePattern = /^\d{4}-\d{2}-\d{2}_[a-zA-Z0-9_-]+_coupe_NDVI_Change$/;
    if (!tableNamePattern.test(NdvicoupeName)) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    try {
        const selectQuery = `
           SELECT * EXCLUDE (image_data)
            FROM public."${NdvicoupeName}"
            WHERE pixle_id = ${id};
        `;

        const [results] = await sequelize.query(selectQuery);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bad Request - Invalid syntax'
            });
        }

        // Fetch image from MongoDB
        const mongoImage = await MongoImage.findOne({
          sourceType: 'ndvi',
          coupeName: NdvicoupeName,
          recordId: parseInt(id)
        }).lean();

        results[0].image_data = mongoImage ? mongoImage.imageData : null;
        results[0].image_type = mongoImage ? mongoImage.imageType : null;

        res.json({
            success: true,
            message: 'Record fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error fetching NDVI record by ID:', error);
        res.status(500).json({
            success: false,
            message: 'Server encountered an unexpected condition',
           
        });
    }
});

// GET endpoint to fetch all NDVI Change table names
router.get('/ndvi-change-tables', async (req, res) => {
    try {
        // Query to get all tables ending with _coupe_NDVI_Change
        const getTablesQuery = `
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename LIKE '%\\_coupe\\_NDVI\\_Change' ESCAPE '\\'
            ORDER BY tablename DESC;
        `;

        const [results] = await sequelize.query(getTablesQuery);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Bad Request - Invalid syntax',
                data: []
            });
        }

        // Extract just the table names from the results
        const tableNames = results.map(row => row.tablename);

        res.json({
            success: true,
            message: 'NDVI Change tables fetched successfully',
            count: tableNames.length,
            data: tableNames
        });

    } catch (error) {
        console.error('Error fetching NDVI Change tables:', error);
        res.status(500).json({
            success: false,
            message: 'Server encountered an unexpected condition',
           
        });
    }
});



// GET: Get single NDVI record by ID
// router.get('/ndvi-change/:id',verifyJwt, async (req, res) => {
//     const { tableName } = req.query;
//     const { id } = req.params;

//     if (!tableName) {
//         return res.status(400).json({
//             success: false,
//             message: 'tableName query parameter is required'
//         });
//     }

//     if (!id || isNaN(id)) {
//         return res.status(400).json({
//             success: false,
//             message: 'Valid ID is required'
//         });
//     }

//     try {
//         const selectQuery = `
//            SELECT *
//             FROM public."${tableName}"
//             WHERE pixle_id = ${id};
//         `;

//         const [results] = await sequelize.query(selectQuery);

//         if (!results || results.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: `Record with ID ${id} not found`
//             });
//         }

//         res.json({
//             success: true,
//             message: 'Record fetched successfully',
//             data: results
//         });

//     } catch (error) {
//         console.error('Error fetching NDVI record by ID:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch NDVI record',
//             error: error.message
//         });
//     }
// });


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
const imageToBase64 = async (imagePath) => {
  try {
    // Read image file
    const imageBuffer = await fs.promises.readFile(imagePath);
    
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

const sanitizeHtml = require('sanitize-html');

// PUT: Update NDVI record by ID with image handling - FIXED VERSION
// router.put('/ndvi-change/:id',verifyJwt, upload.single('image_data'), async (req, res) => {
//   const { tableName, note, status } = req.body;
//   const { id } = req.params;

//     if (note) {
//     req.body.note = sanitizeHtml(note, {
//       allowedTags: [], // No HTML tags allowed
//       allowedAttributes: {} // No attributes allowed
//     });
//   }

//   const imageFile = req.file;



//   if (!tableName) {
//     return res.status(400).json({
//       success: false,
//       message: 'tableName is required in request body'
//     });
//   }

//   if (!id || isNaN(id)) {
//     return res.status(400).json({
//       success: false,
//       message: 'Valid ID is required'
//     });
//   }

//   try {
//     // Build dynamic update query based on provided fields
//     const updates = [];
//     const replacements = { id: parseInt(id) };

//     if (note !== undefined) {
//       updates.push('note = :note');
//       replacements.note = note;
//     }
    
//     // Handle image data
//     let imageDataBase64 = null;
    
//     // Check if image is uploaded via file
//     if (imageFile) {
//       try {
//         // Convert uploaded file to base64
//         imageDataBase64 = imageToBase64(imageFile.path);
//         updates.push('image_data = :image_data');
//         replacements.image_data = imageDataBase64;
        
//         // Clean up temporary file
//         fs.unlinkSync(imageFile.path);
//       } catch (error) {
//         console.error('Error processing uploaded file:', error);
//         return res.status(400).json({
//           success: false,
//           message: 'Failed to process uploaded image file',
//           error: error.message
//         });
//       }
//     } 
//     // Alternatively, check if image_data is provided as base64 in body
//     else if (req.body.image_data) {
//       imageDataBase64 = req.body.image_data;
//       updates.push('image_data = :image_data');
//       replacements.image_data = imageDataBase64;
//     }
    
//     if (status !== undefined) {
//       updates.push('status = :status');
//       replacements.status = status;
//     }

//     if (updates.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No fields to update'
//       });
//     }

//     const updateQuery = `
//       UPDATE public."${tableName}"
//       SET ${updates.join(', ')}, updated_at = NOW()
//       WHERE pixle_id = :id
//       RETURNING pixle_id, longitude, latitude, note, image_data, status;
//     `;

//     const [results] = await sequelize.query(updateQuery, {
//       replacements: replacements,
//       type: sequelize.QueryTypes.UPDATE
//     });

//     if (!results || results.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `Record with ID ${id} not found`
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Record updated successfully',
//       data: results[0]
//     });

//   } catch (error) {
//     console.error('Error updating NDVI record:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update NDVI record',
//       error: error.message
//     });
//   }
// });

router.put('/ndvi-change', verifyJwt, upload.single('image_data'), async (req, res) => {
  //let { tableName, note, status, id } = req.body;
let {coupename, note, status, id} = req.body;
  const imageFile = req.file;

  if (!coupename) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request - Invalid syntax'
    });
  }

  // Allow only tables ending with _coupe_NDVI_Change
 const tableRegex = /^[a-zA-Z0-9_-]+_coupe_NDVI_Change$/;

if (!tableRegex.test(coupename)) {
  return res.status(400).json({
    success: false,
    message: 'Bad Request - Invalid syntax'
  });
}

  // Manual validation
  if (!id || isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request - Invalid syntax'
    });
  }

  try {
    const sanitizedNote = note ? clean(note) : undefined;

    const updates = [];
    const replacements = { id: parseInt(id) };

    if (sanitizedNote !== undefined) {
      updates.push('note = :note');
      replacements.note = sanitizedNote;
    }

    // Handle image — store in MongoDB
    if (imageFile) {

      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/heic',
        'image/heif',
        'application/octet-stream',
        'image/heic-sequence'
      ];

      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: 'Only JPG, PNG, GIF, HEIC, and HEIF images are allowed. SVG files are not permitted.'
        });
      }

      const fileName = imageFile.originalname.toLowerCase();
      if (fileName.endsWith('.svg') || fileName.endsWith('.svgz')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type',
          message: 'Bad Request - Invalid syntax'
        });
      }

      const imageBuffer = await fs.promises.readFile(imageFile.path);
      const base64Image = imageBuffer.toString('base64');

      // Store image in MongoDB
      const existingImg = await MongoImage.findOne({ sourceType: 'ndvi', coupeName: coupename, recordId: parseInt(id) });
      if (existingImg) {
        existingImg.imageType = imageFile.mimetype;
        existingImg.imageData = base64Image;
        await existingImg.save();
      } else {
        const lastImg = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
        const nextId = lastImg && lastImg.imageId ? lastImg.imageId + 1 : 1;
        await MongoImage.create({
          imageId: nextId,
          sourceType: 'ndvi',
          coupeName: coupename,
          recordId: parseInt(id),
          imageType: imageFile.mimetype,
          imageData: base64Image,
        });
      }

      fs.unlinkSync(imageFile.path);
    }

    if (status !== undefined) {
      updates.push('status = :status');
      replacements.status = status;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bad Request - Invalid syntax'
      });
    }

    const updateQuery = `
      UPDATE public."${coupename}"
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE pixle_id = :id
      RETURNING pixle_id, longitude, latitude, note, status;
    `;

    const [results] = await sequelize.query(updateQuery, {
      replacements,
      type: sequelize.QueryTypes.UPDATE
    });

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bad Request - Invalid syntax'
      });
    }

    res.json({
      success: true,
      data: {
        ...results[0],
        note: results[0].note ? clean(results[0].note) : null
      }
    });

    logFromRequest(req, {
      action: 'RECORD_UPDATE',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'ndvi_record',
      resourceId: id,
      details: { coupename, status: req.body?.status },
    });

  } catch (error) {
    console.error('Error:', error);

    logFromRequest(req, {
      action: 'RECORD_UPDATE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'ndvi_record',
      resourceId: req.params?.id || null,
      errorMessage: error.message,
    });
    res.status(500).json({
      success: false,
      message: 'Update failed'
    });
  }
});



// Alternative version without multer (if you prefer base64 in request body only)
router.put('/ndvi-change-base64/:id',verifyJwt, async (req, res) => {
  //const { tableName, note, image_data, status } = req.body;
 const {coupename,note,image_data,status} = req.body;
  const { id } = req.params;

  if (!coupename) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request - Invalid syntax'
    });
  }

  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request - Invalid syntax'
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
    
    // Handle image_data (expected to be base64 string) — store in MongoDB
    if (image_data !== undefined) {
      // Optional: Validate base64 format
      if (typeof image_data === 'string' && image_data.startsWith('data:image')) {
        // Extract mime type and base64 data from data URL
        const matches = image_data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        const mimeType = matches ? matches[1] : 'image/jpeg';
        const rawBase64 = matches ? matches[2] : image_data;

        const existingImg2 = await MongoImage.findOne({ sourceType: 'ndvi', coupeName: coupename, recordId: parseInt(id) });
        if (existingImg2) {
          existingImg2.imageType = mimeType;
          existingImg2.imageData = rawBase64;
          await existingImg2.save();
        } else {
          const lastImg2 = await MongoImage.findOne({}, {}, { sort: { imageId: -1 } });
          const nextId2 = lastImg2 && lastImg2.imageId ? lastImg2.imageId + 1 : 1;
          await MongoImage.create({
            imageId: nextId2,
            sourceType: 'ndvi',
            coupeName: coupename,
            recordId: parseInt(id),
            imageType: mimeType,
            imageData: rawBase64,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Bad Request - Invalid syntax'
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
        message: 'Bad Request - Invalid syntax'
      });
    }

    const updateQuery = `
      UPDATE public."${coupename}"
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
        message: 'Bad Request - Invalid syntax'
      });
    }

    res.json({
      success: true,
      message: 'Record updated successfully',
      data: results[0]
    });

    logFromRequest(req, {
      action: 'RECORD_UPDATE',
      status: 'SUCCESS',
      statusCode: 200,
      resourceType: 'ndvi_record',
      resourceId: id,
      details: { coupename, status: req.body?.status },
    });

  } catch (error) {
    console.error('Error updating NDVI record:', error);

    logFromRequest(req, {
      action: 'RECORD_UPDATE',
      status: 'ERROR',
      statusCode: 500,
      resourceType: 'ndvi_record',
      resourceId: req.params?.id || null,
      errorMessage: error.message,
    });
    res.status(500).json({
      success: false,
      message: 'Server encountered an unexpected condition',
     
    });
  }
});

// DELETE: Delete NDVI record by ID
router.delete('/ndvi-change/:id',verifyJwt, async (req, res) => {
    //const { tableName } = req.query;
      const { coupename } = req.query;
    const { id } = req.params;

    if (!coupename) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    if (!id || isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'Bad Request - Invalid syntax'
        });
    }

    try {
        // First check if record exists
        const checkQuery = `
            SELECT id FROM public."${coupename}" WHERE id = :id;
        `;

        const [existingRecord] = await sequelize.query(checkQuery, {
            replacements: { id: parseInt(id) },
            type: sequelize.QueryTypes.SELECT
        });

        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: `Bad Request - Invalid syntax`
            });
        }

        // Delete the record
        const deleteQuery = `
            DELETE FROM public."${coupename}"
            WHERE id = :id
            RETURNING id;
        `;

        const [deletedRecord] = await sequelize.query(deleteQuery, {
            replacements: { id: parseInt(id) },
            type: sequelize.QueryTypes.DELETE
        });

        // Also delete associated image from MongoDB
        await MongoImage.deleteOne({
          sourceType: 'ndvi',
          coupeName: coupename,
          recordId: parseInt(id)
        });

        res.json({
            success: true,
            message: `Record with ID ${id} deleted successfully`,
            data: { deletedId: id }
        });

        logFromRequest(req, {
          action: 'RECORD_DELETE',
          status: 'SUCCESS',
          statusCode: 200,
          resourceType: 'ndvi_record',
          resourceId: id,
          details: { coupename },
        });

    } catch (error) {
        console.error('Error deleting NDVI record:', error);

        logFromRequest(req, {
          action: 'RECORD_DELETE',
          status: 'ERROR',
          statusCode: 500,
          resourceType: 'ndvi_record',
          resourceId: req.params?.id || null,
          errorMessage: error.message,
        });
        res.status(500).json({
            success: false,
            message: 'Server encountered an unexpected condition',
           
        });
    }
});

router.get('/ndvi-change-layer-bounds/:layerName', async (req, res) => {
  try {
    const { layerName } = req.params;
    
    // Clean the layer name (remove workspace prefix if present)
    const cleanLayerName = layerName.replace(/^cite:/, '').replace(/^public\./, '');
    
    // Extract table name from the layer name (handle different formats)
    let tableName = cleanLayerName;
    
    // Query to get bounds from the table
    const query = `
      SELECT 
        ST_XMin(ST_Extent(geom)) AS min_x,
        ST_YMin(ST_Extent(geom)) AS min_y,
        ST_XMax(ST_Extent(geom)) AS max_x,
        ST_YMax(ST_Extent(geom)) AS max_y,
        ST_X(ST_Centroid(ST_Union(geom))) AS centroid_x,
        ST_Y(ST_Centroid(ST_Union(geom))) AS centroid_y,
        COUNT(*) AS feature_count
      FROM "${tableName}";
    `;
    
    // Execute query - Sequelize returns [results, metadata]
    const [results, metadata] = await sequelize.query(query);
    
    console.log('Query results:', results);
    
    // Check if we got any results
    if (!results || results.length === 0 || !results[0] || !results[0].min_x) {
      return res.status(404).json({ 
        error: 'Layer not found or has no geometry',
        table: validTableName 
      });
    }
    
    const bounds = {
      minX: parseFloat(results[0].min_x),
      minY: parseFloat(results[0].min_y),
      maxX: parseFloat(results[0].max_x),
      maxY: parseFloat(results[0].max_y),
      centroid: {
        x: parseFloat(results[0].centroid_x),
        y: parseFloat(results[0].centroid_y)
      },
      featureCount: parseInt(results[0].feature_count),
      metadata: {
        range: results[0].range || 'N/A',
        division: results[0].division || 'N/A',
        circle: results[0].circle || 'N/A'
      }
    };
    
    console.log('Sending bounds:', bounds);
    res.json(bounds);
  } catch (error) {
    console.error('Error fetching NDVI change layer bounds:', error);
    // Return default Gujarat bounds as fallback
    res.json({
      success: true,
      data: {
        minX: 68.5,
        minY: 20.5,
        maxX: 74.5,
        maxY: 24.5
      }
    });
  }
});




module.exports = router;
