const express = require('express');
const router = express.Router();
const { verifyJwt } = require("../middlewares/verifyJwt"); 

const { sequelize } = require('../config/ndvidatabase');

// Helper function to execute queries using Sequelize
const executeQuery = async (myquery, params = []) => {
   console.log('sequelize:', sequelize); 
  try {
    const results = await sequelize.query(myquery, {
      replacements: params,
      type: sequelize.QueryTypes.SELECT
    });
    return results;
  } catch (error) {
    throw error;
  }
};


// Get all divisions based on forest type
router.post('/divisions', async (req, res) => {
  try {
    const { forest_id } = req.body;
    
    if (!forest_id) {
      return res.status(400).json({ error: 'forest_id is required' });
    }

    let myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        myquery = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Wildlife_Circle_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Teritorial_Circle_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Social_Forestry_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(myquery);
    res.json(result);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/hierarchy_coupes', async (req, res) => {
  try {
    const query = `
      SELECT * FROM coupe_all;
    `;
    const result = await executeQuery(query);
    
    res.json({
      message: 'All records from coupe_all fetched successfully',
      data: result,
      count: result.length
    });
  } catch (err) {
    console.error('Error fetching from coupe_all:', err);
    res.status(500).json({ error: 'Failed to fetch records from coupe_all' });
  }
});



/* ----------------------------------------
   Normalize Middleware
   Converts all string body values to:
   - lowercase
   - removes all spaces
/* ============================================================
   NORMALIZE DIVISION HELPER (ONLY DIVISION)
============================================================ */
const normalizeDivision = (value) => {
  return value?.toLowerCase().replace(/\s+/g, '');
};


/* ============================================================
   GET ALL DIVISIONS
============================================================ */
router.get('/hierarchy-divisions', verifyJwt, async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT division
      FROM public.coupe_all
      WHERE division IS NOT NULL AND division != ''
      ORDER BY division
    `;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      message: 'Divisions fetched successfully',
      data: result.map(row => row.division),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coupe-numbers', verifyJwt, async (req, res) => {
  try {
    const { village, coupe_name } = req.body;

    // Validate input
    if (!village || !coupe_name) {
      return res.status(400).json({ 
        error: 'Village name and coupe_name (table name) are required' 
      });
    }

    // Simple query using the provided table name and village
    const query = `
      SELECT DISTINCT "coupe_no"
      FROM public.${coupe_name}
      WHERE village = '${village}'
    `;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    if (result.length === 0) {
      return res.status(404).json({
        message: `No coupe numbers found for village '${village}' in table '${coupe_name}'`,
        data: result,
        count: 0
      });
    }

    res.json({
      message: 'Coupe numbers fetched successfully',
      data: result.map(row => row.coupe_no),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching coupe numbers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/* ============================================================
   GET RANGES
============================================================ */
router.post('/hierarchy-ranges', verifyJwt, async (req, res) => {
  try {
    let { division } = req.body;

    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }

    division = normalizeDivision(division);

    let query = `
      SELECT DISTINCT range
      FROM public.coupe_all
      WHERE LOWER(REPLACE(division, ' ', '')) = ?
      ORDER BY range
    `;

    let result = await sequelize.query(query, {
      replacements: [division],
      type: sequelize.QueryTypes.SELECT
    });

    let level = 'division';

    if (result.length === 0) {
      query = `
        SELECT DISTINCT range
        FROM public.coupe_all
        ORDER BY range
      `;

      result = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT
      });

      level = 'all';
    }

    res.json({
      message: `Ranges fetched successfully at ${level} level`,
      division,
      queriedLevel: level,
      data: result.map(row => row.range),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching ranges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/* ============================================================
   GET ROUNDS
============================================================ */
router.post('/hierarchy-rounds', verifyJwt, async (req, res) => {
  try {
    let { division, range } = req.body;

    if (!division || !range) {
      return res.status(400).json({ error: 'division and range are required' });
    }

    division = normalizeDivision(division);

    let query = `
      SELECT DISTINCT round
      FROM public.coupe_all
      WHERE LOWER(REPLACE(division, ' ', '')) = ?
      AND range = ?
      ORDER BY round
    `;

    let result = await sequelize.query(query, {
      replacements: [division, range],
      type: sequelize.QueryTypes.SELECT
    });

    let level = 'range';

    if (result.length === 0) {
      query = `
        SELECT DISTINCT round
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        ORDER BY round
      `;

      result = await sequelize.query(query, {
        replacements: [division],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'division';
    }

    res.json({
      message: `Rounds fetched successfully at ${level} level`,
      division,
      range,
      queriedLevel: level,
      data: result.map(row => row.round),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/* ============================================================
   GET BEATS
============================================================ */
router.post('/hierarchy-beats', verifyJwt, async (req, res) => {
  try {
    let { division, range, round } = req.body;

    if (!division || !range || !round) {
      return res.status(400).json({
        error: 'division, range, and round are required'
      });
    }

    division = normalizeDivision(division);

    let query = `
      SELECT DISTINCT beat
      FROM public.coupe_all
      WHERE LOWER(REPLACE(division, ' ', '')) = ?
      AND range = ?
      AND round = ?
      ORDER BY beat
    `;

    let result = await sequelize.query(query, {
      replacements: [division, range, round],
      type: sequelize.QueryTypes.SELECT
    });

    let level = 'round';

    if (result.length === 0) {
      query = `
        SELECT DISTINCT beat
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        AND range = ?
        ORDER BY beat
      `;

      result = await sequelize.query(query, {
        replacements: [division, range],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'range';
    }

    if (result.length === 0) {
      query = `
        SELECT DISTINCT beat
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        ORDER BY beat
      `;

      result = await sequelize.query(query, {
        replacements: [division],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'division';
    }

    res.json({
      message: `Beats fetched successfully at ${level} level`,
      division,
      range,
      round,
      queriedLevel: level,
      data: result.map(row => row.beat),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/* ============================================================
   GET VILLAGES
============================================================ */
router.post('/hierarchy-villages', verifyJwt, async (req, res) => {
  try {
    let { division, range, round, beat } = req.body;

    if (!division || !range || !round || !beat) {
      return res.status(400).json({
        error: 'division, range, round, and beat are required'
      });
    }

    division = normalizeDivision(division);

    let query = `
      SELECT DISTINCT village
      FROM public.coupe_all
      WHERE LOWER(REPLACE(division, ' ', '')) = ?
      AND range = ?
      AND round = ?
      AND beat = ?
      ORDER BY village
    `;

    let result = await sequelize.query(query, {
      replacements: [division, range, round, beat],
      type: sequelize.QueryTypes.SELECT
    });

    let level = 'beat';

    if (result.length === 0) {
      query = `
        SELECT DISTINCT village
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        AND range = ?
        AND round = ?
        ORDER BY village
      `;

      result = await sequelize.query(query, {
        replacements: [division, range, round],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'round';
    }

    if (result.length === 0) {
      query = `
        SELECT DISTINCT village
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        AND range = ?
        ORDER BY village
      `;

      result = await sequelize.query(query, {
        replacements: [division, range],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'range';
    }

    if (result.length === 0) {
      query = `
        SELECT DISTINCT village
        FROM public.coupe_all
        WHERE LOWER(REPLACE(division, ' ', '')) = ?
        ORDER BY village
      `;

      result = await sequelize.query(query, {
        replacements: [division],
        type: sequelize.QueryTypes.SELECT
      });

      level = 'division';
    }

    res.json({
      message: `Villages fetched successfully at ${level} level`,
      division,
      range,
      round,
      beat,
      queriedLevel: level,
      data: result.map(row => row.village),
      count: result.length
    });

  } catch (error) {
    console.error('Error fetching villages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ranges based on division code and forest type
router.post('/ranges', async (req, res) => {
  try {
    const { forest_id, DIVISION } = req.body;
    
    if (!forest_id || !DIVISION) {
      return res.status(400).json({ error: 'forest_id and DIVISION are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Wildlife_Circle_Range_Boundary"
          WHERE "DIVISION" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Teritorial_Circle_Range_Boundary"
          WHERE "DIVISION" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      case 3: // Social Forestry
        myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Social_Forestry_Range_Boundary"
          WHERE "DIVISION" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { DIVISION });
    res.json(result);
  } catch (error) {
    console.error('Error fetching ranges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get rounds based on range code and forest type
router.post('/rounds', async (req, res) => {
  try {
    const { forest_id, range } = req.body;
    
    if (!forest_id || !range) {
      return res.status(400).json({ error: 'forest_id and range are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Wildlife_Circle_Round_Boundary"
          WHERE "RANGE" = :range
          ORDER BY "ROUND"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Teritorial_Circle_Round_Boundary"
          WHERE "RANGE" = :range
          ORDER BY "ROUND"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Social_Forestry_Round_Boundary"
          WHERE "RANGE" = :range
          ORDER BY "ROUND"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, {  range });
    res.json(result);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get beats based on round code and forest type
router.post('/beats', async (req, res) => {
  try {
    const { forest_id, round} = req.body;
    
    if (!forest_id || !round) {
      return res.status(400).json({ error: 'forest_id and round are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Wildlife_Circle_Beat_Boundary"
          WHERE "ROUND" = :round
          ORDER BY "BEAT"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Teritorial_Circle_Beat_Boundary"
          WHERE "ROUND" = :round
          ORDER BY "BEAT"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Social_Forestry_Beat_Boundary"
          WHERE "ROUND" = :round
          ORDER BY "BEAT"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { round });
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// // Get villages based on beat code and forest type
// router.post('/villages', async (req, res) => {
//   try {
//     const { forest_id, beat } = req.body;
    
//     if (!forest_id || !beat) {
//       return res.status(400).json({ error: 'forest_id and beat are required' });
//     }

//     let  myquery;
//     switch (parseInt(forest_id)) {
//       case 1: // Wildlife Forest
//          myquery = `
//           SELECT DISTINCT "Village", "Village_Id"
//           FROM public."Wildlife_Circle_Village_Boundary"
//           WHERE "BEAT" = :beat
//           ORDER BY "Village"
//         `;
//         break;
//       case 2: // Territorial Forest
//          myquery = `
//           SELECT DISTINCT "Village", "Village_Id"
//           FROM public."Teritorial_Circle_Village_Boundary"
//           WHERE "BEAT" = :beat
//           ORDER BY "Village"
//         `;
//         break;
//       case 3: // Social Forestry
//          myquery = `
//           SELECT DISTINCT "Village", "Village_Id"
//           FROM public."Social_Forestry_Village_Boundary"
//           WHERE "BEAT" = :beat
//           ORDER BY "Village"
//         `;
//         break;
//       default:
//         return res.status(400).json({ error: 'Invalid forest_id' });
//     }

//     const result = await executeQuery( myquery, { beat });
//     res.json(result);
//   } catch (error) {
//     console.error('Error fetching villages:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// Get coupes based on village ID
router.post('/coupes', async (req, res) => {
  try {
    const {forest_id, village_id } = req.body;
    
    
 
    if (!forest_id || !village_id) {
      return res.status(400).json({ error: 'forest_id and village_id are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
        case 1: // Wildlife Forest
         myquery = `
      SELECT DISTINCT coupe_code, coupe_name, wildlife_village_id
      FROM public.coupe_metadata 
      WHERE wildlife_village_id::text = :village_id
      ORDER BY coupe_name
    `;      
        break;
        case 2: // Territorial Forest
         myquery = `
        SELECT DISTINCT coupe_code, coupe_name, territorial_village_id
        FROM public.coupe_metadata
        WHERE territorial_village_id::text = :village_id
        ORDER BY coupe_name
        `;
        break;
        case 3: // Social Forestry
        myquery = `
        SELECT DISTINCT coupe_code, coupe_name, social_village_id
        FROM public.coupe_metadata
        WHERE social_village_id::text = :village_id
        ORDER BY coupe_name
        `;
        break;
        default:    

        return res.status(400).json({ error: 'Invalid forest_id' });
    }
    const result = await executeQuery( myquery, { village_id });
    res.json(result);
  } catch (error) {
    console.error('Error fetching coupes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/get-divisions', verifyJwt,  async (req, res) => {
  try {
  const { forest_id } = req.body;

  if (!forest_id) {
    return res.status(400).json({ error: 'forest_id query parameter is required' });
  } 
    let myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        myquery = `
        SELECT DISTINCT "DIVISION"
          FROM  
          public."Wildlife_Circle_Division_Boundary"
          ORDER BY "DIVISION";
        `;
        break;
      case 2: // Territorial Forest
        myquery = `
        SELECT DISTINCT "DIVISION"  AS "DIVISION"
          FROM public."teritorial_final_metadata_new"
          ORDER BY "DIVISION";
        `;  
        break;
      case 3: // Social Forestry
        myquery = `
        SELECT DISTINCT "DIVISION"
          FROM public."Social_Forestry_Division_Boundary"
          ORDER BY "DIVISION";
        `;
        break;      
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }
  
   
    const result = await executeQuery(myquery);
    res.json(result);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }     
});

router.post('/hierarchy', async (req, res) => {
  try {
    const { forest_id, division_name } = req.body;

    if (!forest_id || !division_name) {
      return res.status(400).json({
        error: 'forest_id and division_name are required'
      });
    }

    let myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
          // myquery = `
          //   SELECT DISTINCT
          //     wcdb."DIVISION",
            
          //     wcrb."RANGE",
            
          //     wcrdb."ROUND",
          
          //     wcbb."BEAT",
              
          //     wcvb."Village",
            
          //     cm.coupe_name
            
          //   FROM public."Wildlife_Circle_Division_Boundary" wcdb
          //   LEFT JOIN public."Wildlife_Circle_Range_Boundary" wcrb
          //     ON wcdb."DIVISION" = wcrb."DIVISION"
          //   LEFT JOIN public."Wildlife_Circle_Round_Boundary" wcrdb
          //     ON wcrb."RANGE" = wcrdb."RANGE"
          //   LEFT JOIN public."Wildlife_Circle_Beat_Boundary" wcbb
          //     ON wcrdb."ROUND" = wcbb."ROUND"
          //   LEFT JOIN public."Wildlife_Circle_Village_Boundary" wcvb
          //     ON wcbb."BEAT" = wcvb."BEAT"
          //   LEFT JOIN public.coupe_metadata cm
          //     ON cm.wildlife_village = wcvb."Village"
          //   WHERE wcdb."DIVISION" = '${division_name}' and  wildlife_village is not null
          //   ORDER BY
          //     wcdb."DIVISION",
          //     wcrb."RANGE",
          //     wcrdb."ROUND",
          //     wcbb."BEAT",
          //     wcvb."Village",
          //     cm.coupe_name
          // `;
          myquery = `SELECT * FROM wildlife_final_metadata_new where "DIVISION"='${division_name}' and coupe_name is not null;`;

        break;
      case 2: // Territorial Forest
      //   myquery = `
        
			// SELECT DISTINCT
      //       tcdb."Division" as "DIVISION",
      //       tcrb."Range" as "RANGE",
            
      //       tcrdb."Round" as "ROUND",
           
      //       tcbb."Beat" as "BEAT",
           
      //       tcvb."Village",
        
      //       cm.coupe_name
           
      //     FROM public."Teritorial Circle_Division_Boundary" tcdb
      //     LEFT JOIN public."Teritorial Circle_Range_Boundary" tcrb
      //       ON tcdb."Division" = tcrb."Division"
      //     LEFT JOIN public."Teritorial Circle_Round_Boundary" tcrdb
      //       ON tcrb."Range" = tcrdb."Range"
      //     LEFT JOIN public."Teritorial Circle_Beat_Boundary" tcbb
      //       ON tcrdb."Round" = tcbb."Round"
      //     LEFT JOIN public."Teritorial Circle_Village_Boundary" tcvb
      //       ON tcbb."Beat" = tcvb."Beat"
      //     LEFT JOIN public.coupe_metadata cm
      //       ON cm.territorial_village = tcvb."Village"
      //     WHERE tcdb."Division" = '${division_name}' and  territorial_village is not null
      //     ORDER BY
      //       tcdb."Division",
      //       tcrb."Range",
      //       tcrdb."Round",
      //       tcbb."Beat",
      //       tcvb."Village",
      //       cm.coupe_name
      //   `;

      myquery = `SELECT * FROM teritorial_final_metadata_new where "DIVISION"='${division_name}' and coupe_name is not null;`;
        break;
      case 3: // Social Forestry
        myquery = `
          SELECT DISTINCT
            sfdb."DIVISION",
           
            sfrb."RANGE",
            
            sfrdb."ROUND",
            
            sfbb."BEAT",
           
            sfvb."Village",
          
            cm.coupe_name
           
          FROM public."Social_Forestry_Division_Boundary" sfdb
          LEFT JOIN public."Social_Forestry_Range_Boundary" sfrb
            ON sfdb."DIVISION" = sfrb."DIVISION"
          LEFT JOIN public."Social_Forestry_Round_Boundary" sfrdb
            ON sfrb."RANGE" = sfrdb."RANGE"
          LEFT JOIN public."Social_Forestry_Beat_Boundary" sfbb
            ON sfrdb."ROUND" = sfbb."ROUND"
          LEFT JOIN public."Social_Forestry_Village_Boundary" sfvb
            ON sfbb."BEAT" = sfvb."BEAT"
          LEFT JOIN public.coupe_metadata cm
            ON cm.social_village = sfvb."Village"
          WHERE sfdb."DIVISION" = '${division_name}' and  social_village is not null
          ORDER BY
            sfdb."DIVISION",
            sfrb."RANGE",
            sfrdb."ROUND",
            sfbb."BEAT",
            sfvb."Village",
            cm.coupe_name
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(myquery);
    res.json(result);
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get forest types
router.get('/forest-types', async (req, res) => {
  try {
    const  myquery = `
      SELECT forest_id, forest_type
      FROM public.forest_type_lookup
      ORDER BY forest_id
    `;

    const result = await executeQuery(myquery);
    res.json(result);
  } catch (error) {
    console.error('Error fetching forest types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post("/get-centroid", verifyJwt, async (req, res) => {
  try {
    const { coupe_code, village_name,  coupe_name } = req.body;
 
    if (!coupe_code || !village_name || !coupe_name) {
      return res.status(400).json({
        error: "coupe_code, village_name, and coupe_name are required"
      });
    }
 
    const query = `
      SELECT
        ST_AsText(ST_Centroid(geom)) AS centroid_wkt,
        ST_Y(ST_Centroid(geom)) AS latitude,
        ST_X(ST_Centroid(geom)) AS longitude
      FROM public."${coupe_name}"
      WHERE
          village = :village
        AND coupe_no = :coupe
      LIMIT 1;
    `;
 
    const rows = await sequelize.query(query, {
      replacements: {
       
        village: village_name,
        coupe: coupe_code
      },
      type: sequelize.QueryTypes.SELECT
    });
 
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found"
      });
    }
 
    const row = rows[0];
 
    res.json({
      success: true,
     
          latitude: Number(row.latitude),
          longitude: Number(row.longitude)
     
    });
 
  } catch (error) {
    console.error("Centroid error:", error);
  }
});

// ndviRoutes.js - CORRECTED version with proper Sequelize syntax
router.get('/layer-bounds/:layerName', async (req, res) => {
  const { layerName } = req.params;
  
  try {
    // Sanitize layer name to prevent SQL injection
    const validTableName = layerName.replace(/[^a-zA-Z0-9_]/g, '');
    
    console.log(`Fetching bounds for table: ${validTableName}`);
    
    // IMPORTANT: Sequelize.query returns [results, metadata]
    // The first element is the actual data rows
    const query = `
      SELECT 
        ST_XMin(ST_Extent(geom)) AS min_x,
        ST_YMin(ST_Extent(geom)) AS min_y,
        ST_XMax(ST_Extent(geom)) AS max_x,
        ST_YMax(ST_Extent(geom)) AS max_y,
        ST_X(ST_Centroid(ST_Union(geom))) AS centroid_x,
        ST_Y(ST_Centroid(ST_Union(geom))) AS centroid_y,
        COUNT(*) AS feature_count
      FROM "${validTableName}";
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
    console.error('Error fetching layer bounds:', error);
    res.status(500).json({ 
      error: error.message,
      hint: 'Check if table exists and has PostGIS geometry column'
    });
  }
});

router.post('/get-coupe-area', verifyJwt, async (req, res) => {
    const { tableName } = req.body;

    if (!tableName) {
        return res.status(400).json({
            success: false,
            message: 'tableName is required'
        });
    }

    try {
        // Extract division from tableName
        // tableName format is like 'aravalli_coupe' or 'bhavnagar_coupe'
        const division = tableName.replace('_coupe', '');
        
        // Map the division to correct coupe name if needed
        const DIVISION_TO_COUPE_MAP = {
            'aravalli': 'aravalli',
            'bharuch_sub_division': 'bharuchsubdivision',
        };

        let actualTableName = tableName;
        
        // Check if this division needs mapping
        if (DIVISION_TO_COUPE_MAP[division]) {
            const mappedCoupe = DIVISION_TO_COUPE_MAP[division];
            actualTableName = `${mappedCoupe}_coupe`;
            console.log(`[get-coupe-area] Original: ${tableName}, Mapped to: ${actualTableName}`);
        }

        // Fetch all data
        const selectQuery = `
            SELECT
                SUM(ST_Area(geom::geography) / 1000000) AS total_area_sq_km
            FROM
                public."${actualTableName}";
        `;

        const [results] = await sequelize.query(selectQuery);

        res.json({
            success: true,
            message: 'Area fetched successfully',
            data: results
        });

    } catch (error) {
        console.error('Error in get-coupe-area API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch coupe area',
            error: error.message
        });
    }
});

// Get all divisions
router.get('/coupe-divisions',  verifyJwt,async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT division
      FROM public.coupe_dropdown_master
      ORDER BY division
    `;
    
    const result = await sequelize.query(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ranges based on selected division - POST with body
router.post('/coupe-ranges', async (req, res) => {
  try {
    const { division } = req.body;
    
    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }

    const query = `
      SELECT DISTINCT range
      FROM public.coupe_dropdown_master
      WHERE division = ?
      ORDER BY range
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: [division],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching ranges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coupe-rounds', async (req, res) => {
  try {
    const { division, range } = req.body;
    
    if (!division || !range) {
      return res.status(400).json({ error: 'division and range are required' });
    }

    const query = `
      SELECT DISTINCT round
      FROM public.coupe_dropdown_master
      WHERE division = ?
      AND range = ?
      ORDER BY round
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: [division, range],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get beats based on selected division and range - POST with body
router.post('/coupe-beats', async (req, res) => {
  try {
    const { division, range , round} = req.body;
    
    if (!division || !range) {
      return res.status(400).json({ error: 'division and range are required' });
    }

    const query = `
      SELECT DISTINCT beat
      FROM public.coupe_dropdown_master
      WHERE division = ?
      AND range = ? AND round = ?
      ORDER BY beat
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: [division, range, round],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all divisions
router.get('/beat-coupe-divisions',  verifyJwt,async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT division
      FROM public.beat_witheeee22
      ORDER BY division
    `;
    
    const result = await sequelize.query(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ranges based on selected division - POST with body
router.post('/beat-coupe-ranges', async (req, res) => {
  try {
    const { division } = req.body;
    
    if (!division) {
      return res.status(400).json({ error: 'division is required' });
    }

    const query = `
      SELECT DISTINCT range
      FROM public.beat_witheeee22
      WHERE division = ?
      ORDER BY range
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: [division],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching ranges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/beat-coupe-rounds', async (req, res) => {
  try {
    const { division, range } = req.body;
    
    if (!division || !range) {
      return res.status(400).json({ error: 'division and range are required' });
    }

    const query = `
      SELECT DISTINCT round
      FROM public.beat_witheeee22
      WHERE division = ?
      AND range = ?
      ORDER BY round
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: [division, range],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get beats based on selected division and range - POST with body
router.post('/beat-coupe-beats', async (req, res) => {
  try {
    const { division, range , round} = req.body;
    
    if (!division || !range) {
      return res.status(400).json({ error: 'division and range are required' });
    }

    const query = round ? `
      SELECT DISTINCT beat
      FROM public.beat_witheeee22
      WHERE division = ?
      AND range = ? AND round = ?
      ORDER BY beat
    ` : `
      SELECT DISTINCT beat
      FROM public.beat_witheeee22
      WHERE division = ?
      AND range = ?
      ORDER BY beat
    `;
    
    // Using parameterized query with replacements
    const result = await sequelize.query(query, {
      replacements: round ? [division, range, round] : [division, range],
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/coupe_metadata/location', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT input_table_name, coupe_name, coupe_code
      FROM public.coupe_metadata
      WHERE input_table_name IS NOT NULL
      ORDER BY input_table_name
    `;
    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching coupe_metadata location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;