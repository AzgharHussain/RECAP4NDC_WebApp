const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/database"); // adjust path


router.post('/beatscoverage', async (req, res) => {
  try {
    const { forest_id } = req.body;
    
    if (!forest_id ) {
      return res.status(400).json({ error: 'forest_id is required' });
    }

    let query;
    switch (parseInt(forest_id)) {
      case 1: // Wildlife Forest
        query = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Wildlife_Circle_Beat_Boundary"
          ORDER BY "BEAT"
        `;
        break;
      case 2: // Territorial Forest
        query = `
          SELECT DISTINCT "Beat" as "BEAT"
          FROM public."Teritorial Circle_Beat_Boundary"
          ORDER BY "Beat"
        `;
        break;
      case 3: // Social Forestry
        query = `
          SELECT DISTINCT "BEAT", "BTcode"
          FROM public."Social_Forestry_Beat_Boundary"
          ORDER BY "BEAT"
        `;
        break;
      default:
        return res.status(400).json({ error: 'Invalid forest_id' });
    }

    // Execute the query using sequelize
    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching beats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/beat-patrol-coverage", async (req, res) => {
  const { beat } = req.body;

  if (!beat) {
    return res.status(400).json({
      success: false,
      message: "Beat name is required",
    });
  }

  try {
    const query = `
      WITH beat AS (
          SELECT 
              geom AS beat_geom,
              ST_Area(geom::geography)::numeric AS beat_area_sq_m
          FROM public."Teritorial Circle_Beat_Boundary"
          WHERE "Beat" = :beat
      ),

       
      patrol_lines AS (
          SELECT 
              p.patrol_id,
              p.geom AS patrol_geom_text,
              ST_MakeLine(
                  ST_SetSRID(ST_MakePoint(
                      CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 1), ' ', 2) AS float),
                      CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 1), ' ', 1) AS float)
                  ), 4326),
                  ST_SetSRID(ST_MakePoint(
                      CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 2), ' ', 2) AS float),
                      CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 2), ' ', 1) AS float)
                  ), 4326)
              ) AS line_geom
          FROM public.patrols p
          WHERE p.geom IS NOT NULL
            AND p.geom LIKE '%,%'
      ),

      patrol_buffers AS (
          SELECT 
              patrol_id,
              patrol_geom_text,
              ST_Buffer(line_geom::geography, 100)::geometry AS buffer_geom
          FROM patrol_lines
      ),

      clipped_buffers AS (
          SELECT 
              pb.patrol_id,
              pb.patrol_geom_text,
              ST_Intersection(pb.buffer_geom, b.beat_geom) AS clipped_geom
          FROM patrol_buffers pb
          JOIN beat b
            ON ST_Intersects(pb.buffer_geom, b.beat_geom)
      ),

      unioned AS (
          SELECT ST_Union(clipped_geom) AS union_geom
          FROM clipped_buffers
      )

      SELECT
          :beat AS beat_name,
          ROUND(b.beat_area_sq_m, 2) AS beat_area_sq_m,
          ROUND(
              ST_Area(u.union_geom::geography)::numeric,
              2
          ) AS patrol_beat_area_sq_m,
          ROUND(
              (ST_Area(u.union_geom::geography)::numeric / b.beat_area_sq_m) * 100,
              2
          ) AS coverage_percentage,
          json_agg(
              DISTINCT jsonb_build_object(
                  'patrol_id', cb.patrol_id,
                  'patrol_geom', cb.patrol_geom_text
              )
          ) AS patrols_covering_beat
      FROM beat b
      CROSS JOIN unioned u
      LEFT JOIN clipped_buffers cb ON TRUE
      GROUP BY b.beat_area_sq_m, u.union_geom;
    `;

    const [result] = await sequelize.query(query, {
      replacements: { beat },
      type: sequelize.QueryTypes.SELECT,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No patrol coverage found for this beat",
      });
    }

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("Beat patrol coverage error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});



module.exports = router;
