const express = require('express');
const router = express.Router();


const { sequelize } = require('../config/database');

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

// Get ranges based on division code and forest type
router.post('/ranges', async (req, res) => {
  try {
    const { forest_id, DIVISION } = req.body;
    
    if (!forest_id || !division_code) {
      return res.status(400).json({ error: 'forest_id and DIVISION are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Wildlife_Circle_Range_Boundary"
          WHERE "DVcode" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Teritorial_Circle_Range_Boundary"
          WHERE "DVcode" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      case 3: // Social Forestry
        myquery = `
          SELECT DISTINCT "RANGE", "RGcode"
          FROM public."Social_Forestry_Range_Boundary"
          WHERE "DVcode" = :DIVISION
          ORDER BY "RANGE"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { division_code });
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
    
    if (!forest_id || !range_code) {
      return res.status(400).json({ error: 'forest_id and range are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Wildlife_Circle_Round_Boundary"
          WHERE "RGcode" = :range
          ORDER BY "ROUND"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Teritorial_Circle_Round_Boundary"
          WHERE "RGcode" = :range
          ORDER BY "ROUND"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "ROUND", "RDcode"
          FROM public."Social_Forestry_Round_Boundary"
          WHERE "RGcode" = :range
          ORDER BY "ROUND"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { range_code });
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

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Wildlife_Circle_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Teritorial_Circle_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Social_Forestry_Beat_Boundary"
          WHERE "RDcode" = :round_code
          ORDER BY "BEAT"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { round_code });
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get villages based on beat code and forest type
router.post('/villages', async (req, res) => {
  try {
    const { forest_id, beat } = req.body;
    
    if (!forest_id || !beat) {
      return res.status(400).json({ error: 'forest_id and beat are required' });
    }

    let  myquery;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
         myquery = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Wildlife_Circle_Village_Boundary"
          WHERE "BTcode" = :beat
          ORDER BY "Village"
        `;
        break;
      case 2: // Territorial Forest
         myquery = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Teritorial_Circle_Village_Boundary"
          WHERE "BTcode" = :beat
          ORDER BY "Village"
        `;
        break;
      case 3: // Social Forestry
         myquery = `
          SELECT DISTINCT "Village", "Village_Id"
          FROM public."Social_Forestry_Village_Boundary"
          WHERE "BTcode" = :beat
          ORDER BY "Village"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    const result = await executeQuery( myquery, { beat_code });
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

router.get('/get-divisions', async (req, res) => {
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
        SELECT DISTINCT "Division" 
          FROM public."Teritorial Circle_Division_Boundary"
          ORDER BY "Division";
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
        myquery = `
          SELECT DISTINCT
            wcdb."DIVISION",
          
            wcrb."RANGE",
          
            wcrdb."ROUND",
         
            wcbb."BEAT",
            
            wcvb."Village",
            wcvb."Village_id",
            cm.coupe_code,
            cm.coupe_name,
            cm.wildlife_village_id
          FROM public."Wildlife_Circle_Division_Boundary" wcdb
          LEFT JOIN public."Wildlife_Circle_Range_Boundary" wcrb
            ON wcdb."DIVISION" = wcrb."DIVISION"
          LEFT JOIN public."Wildlife_Circle_Round_Boundary" wcrdb
            ON wcrb."RANGE" = wcrdb."RANGE"
          LEFT JOIN public."Wildlife_Circle_Beat_Boundary" wcbb
            ON wcrdb."ROUND" = wcbb."ROUND"
          LEFT JOIN public."Wildlife_Circle_Village_Boundary" wcvb
            ON wcbb."BEAT" = wcvb."BEAT"
          LEFT JOIN public.coupe_metadata cm
            ON cm.wildlife_village_id::integer = wcvb."Village_id"
          WHERE wcdb."DIVISION" = '${division_name}'
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
        myquery = `
        
			SELECT DISTINCT
            tcdb."Division",
            tcrb."Range",
            
            tcrdb."Round",
           
            tcbb."Beat",
           
            tcvb."Village",
            tcvb."Village_id",
            cm.coupe_code,
            cm.coupe_name,
            cm.territorial_village_id
          FROM public."Teritorial Circle_Division_Boundary" tcdb
          LEFT JOIN public."Teritorial Circle_Range_Boundary" tcrb
            ON tcdb."Division" = tcrb."Division"
          LEFT JOIN public."Teritorial Circle_Round_Boundary" tcrdb
            ON tcrb."Range" = tcrdb."Range"
          LEFT JOIN public."Teritorial Circle_Beat_Boundary" tcbb
            ON tcrdb."Round" = tcbb."Round"
          LEFT JOIN public."Teritorial Circle_Village_Boundary" tcvb
            ON tcbb."Beat" = tcvb."Beat"
          LEFT JOIN public.coupe_metadata cm
            ON cm.territorial_village_id::integer = tcvb."Village_id"
          WHERE tcdb."Division" = '${division_name}'
          ORDER BY
            tcdb."Division",
            tcrb."Range",
            tcrdb."Round",
            tcbb."Beat",
            tcvb."Village",
            cm.coupe_name
        `;
        break;
      case 3: // Social Forestry
        myquery = `
          SELECT DISTINCT
            sfdb."DIVISION",
           
            sfrb."RANGE",
            
            sfrdb."ROUND",
            
            sfbb."BEAT",
           
            sfvb."Village",
            sfvb."Village_id",
            cm.coupe_code,
            cm.coupe_name,
            cm.social_village_id
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
            ON cm.social_village_id::integer = sfvb."Village_id"
          WHERE sfdb."DIVISION" = '${division_name}'
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

module.exports = router;