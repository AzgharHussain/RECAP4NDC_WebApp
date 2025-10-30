const express = require('express');
const router = express.Router();

const { sequelize } = require('../index'); // Your database connection

// Helper function to execute queries using Sequelize
const executeQuery = async (query, params = []) => {
  try {
    const results = await sequelize.query(query, {
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

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Wildlife_Circle_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Teritorial_Circle_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "DIVISION", "DVcode"
          FROM public."Social_Forestry_Division_Boundary"
          ORDER BY "DIVISION"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ranges based on division code and forest type
router.post('/ranges', async (req, res) => {
  try {
    const { forest_id, division_code } = req.body;
    
    if (!forest_id || !division_code) {
      return res.status(400).json({ error: 'forest_id and division_code are required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Wildlife_Circle_Range_Boundary"
          WHERE "DVcode" = :division_code
          ORDER BY "RANGE"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Teritorial_Circle_Range_Boundary"
          WHERE "DVcode" = :division_code
          ORDER BY "RANGE"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Social_Forestry_Range_Boundary"
          WHERE "DVcode" = :division_code
          ORDER BY "RANGE"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query, { division_code });
    res.json(result);
  } catch (error) {
    console.error('Error fetching ranges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get rounds based on range code and forest type
router.post('/rounds', async (req, res) => {
  try {
    const { forest_id, range_code } = req.body;
    
    if (!forest_id || !range_code) {
      return res.status(400).json({ error: 'forest_id and range_code are required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Wildlife_Circle_Round_Boundary"
          WHERE "RGcode" = :range_code
          ORDER BY "ROUND"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Teritorial_Circle_Round_Boundary"
          WHERE "RGcode" = :range_code
          ORDER BY "ROUND"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Social_Forestry_Round_Boundary"
          WHERE "RGcode" = :range_code
          ORDER BY "ROUND"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query, { range_code });
    res.json(result);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get beats based on round code and forest type
router.post('/beats', async (req, res) => {
  try {
    const { forest_id, round_code } = req.body;
    
    if (!forest_id || !round_code) {
      return res.status(400).json({ error: 'forest_id and round_code are required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Wildlife_Circle_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Teritorial_Circle_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Social_Forestry_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query, { round_code });
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get villages based on beat code and forest type
router.post('/villages', async (req, res) => {
  try {
    const { forest_id, beat_code } = req.body;
    
    if (!forest_id || !beat_code) {
      return res.status(400).json({ error: 'forest_id and beat_code are required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Wildlife_Circle_Village_Boundary"
          WHERE "BTcode" = :beat_code
          ORDER BY "Village"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Teritorial_Circle_Village_Boundary"
          WHERE "BTcode" = :beat_code
          ORDER BY "Village"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Social_Forestry_Village_Boundary"
          WHERE "BTcode" = :beat_code
          ORDER BY "Village"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query, { beat_code });
    res.json(result);
  } catch (error) {
    console.error('Error fetching villages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get coupes based on village ID
router.post('/coupes', async (req, res) => {
  try {
    const {forest_id, village_id } = req.body;
    
    
 
    if (!forest_id || !village_id) {
      return res.status(400).json({ error: 'forest_id and village_id are required' });
    }

    let query;
    switch (parseInt(forest_id)) {
        case 1: // Wildlife Forest
        query = `
      SELECT DISTINCT coupe_code, coupe_name, wildlife_village_id
      FROM public.coupe_metadata 
      WHERE wildlife_village_id::text = :village_id
      ORDER BY coupe_name
    `;      
        break;
        case 2: // Territorial Forest
        query = `
        SELECT DISTINCT coupe_code, coupe_name, territorial_village_id
        FROM public.coupe_metadata
        WHERE territorial_village_id::text = :village_id
        ORDER BY coupe_name
        `;
        break;
        case 3: // Social Forestry
        query = `
        SELECT DISTINCT coupe_code, coupe_name, social_village_id
        FROM public.coupe_metadata
        WHERE social_village_id::text = :village_id
        ORDER BY coupe_name
        `;
        break;
        default:    

        return res.status(400).json({ error: 'Invalid forest_id' });
    }
    const result = await executeQuery(query, { village_id });
    res.json(result);
  } catch (error) {
    console.error('Error fetching coupes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get complete hierarchy data
router.post('/hierarchy', async (req, res) => {
  try {
    const { forest_id } = req.body;
    
    if (!forest_id) {
      return res.status(400).json({ error: 'forest_id is required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT
            wcdb."DIVISION",
            wcdb."DVcode",
            wcrb."RANGE",
            wcrb."RGcode",
            wcrdb."ROUND",
            wcrdb."RDcode",
            wcbb."BEAT",
            wcbb."BTcode",
            wcvb."Village",
            wcvb."Village_Id",
            cm.coupe_code,
            cm.coupe_name,
            cm.wildlife_village_id
          FROM public."Wildlife_Circle_Division_Boundary" wcdb
          LEFT JOIN public."Wildlife_Circle_Range_Boundary" wcrb
            ON wcdb."DVcode" = wcrb."DVcode"
          LEFT JOIN public."Wildlife_Circle_Round_Boundary" wcrdb
            ON wcrb."RGcode" = wcrdb."RGcode"
          LEFT JOIN public."Wildlife_Circle_Beat_Boundary" wcbb
            ON wcrdb."RDcode" = wcbb."RDcode"
          LEFT JOIN public."Wildlife_Circle_Village_Boundary" wcvb
            ON wcbb."BTcode" = wcvb."BTcode"
          LEFT JOIN public.coupe_metadata cm
            ON cm.wildlife_village_id::text = wcvb."Village_Id"
          ORDER BY
            wcdb."DIVISION",
            wcrb."RANGE",
            wcrdb."ROUND",
            wcbb."BEAT",
            wcvb."Village",
            cm.coupe_name
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT
            tcdb."DIVISION",
            tcdb."DVcode",
            tcrb."RANGE",
            tcrb."RGcode",
            tcrdb."ROUND",
            tcrdb."RDcode",
            tcbb."BEAT",
            tcbb."BTcode",
            tcvb."Village",
            tcvb."Village_Id"
          FROM public."Teritorial_Circle_Division_Boundary" tcdb
          LEFT JOIN public."Teritorial_Circle_Range_Boundary" tcrb
            ON tcdb."DVcode" = tcrb."DVcode"
          LEFT JOIN public."Teritorial_Circle_Round_Boundary" tcrdb
            ON tcrb."RGcode" = tcrdb."RGcode"
          LEFT JOIN public."Teritorial_Circle_Beat_Boundary" tcbb
            ON tcrdb."RDcode" = tcbb."RDcode"
          LEFT JOIN public."Teritorial_Circle_Village_Boundary" tcvb
            ON tcbb."BTcode" = tcvb."BTcode"
          ORDER BY
            tcdb."DIVISION",
            tcrb."RANGE",
            tcrdb."ROUND",
            tcbb."BEAT",
            tcvb."Village"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT
            sfdb."DIVISION",
            sfdb."DVcode",
            sfrb."RANGE",
            sfrb."RGcode",
            sfrdb."ROUND",
            sfrdb."RDcode",
            sfbb."BEAT",
            sfbb."BTcode",
            sfvb."Village",
            sfvb."Village_Id"
          FROM public."Social_Forestry_Division_Boundary" sfdb
          LEFT JOIN public."Social_Forestry_Range_Boundary" sfrb
            ON sfdb."DVcode" = sfrb."DVcode"
          LEFT JOIN public."Social_Forestry_Round_Boundary" sfrdb
            ON sfrb."RGcode" = sfrdb."RGcode"
          LEFT JOIN public."Social_Forestry_Beat_Boundary" sfbb
            ON sfrdb."RDcode" = sfbb."RDcode"
          LEFT JOIN public."Social_Forestry_Village_Boundary" sfvb
            ON sfbb."BTcode" = sfvb."BTcode"
          ORDER BY
            sfdb."DIVISION",
            sfrb."RANGE",
            sfrdb."ROUND",
            sfbb."BEAT",
            sfvb."Village"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get forest types
router.get('/forest-types', async (req, res) => {
  try {
    const query = `
      SELECT forest_id, forest_type
      FROM public.forest_type_lookup
      ORDER BY forest_id
    `;

    const result = await executeQuery(query);
    res.json(result);
  } catch (error) {
    console.error('Error fetching forest types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;