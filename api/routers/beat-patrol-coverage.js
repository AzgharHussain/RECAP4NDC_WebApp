const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/database"); // adjust path
const { verifyJwt } = require("../middlewares/verifyJwt");


router.post('/beatscoverage',verifyJwt, async (req, res) => {
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

router.post("/beat-patrol-coverage",verifyJwt, async (req, res) => {
  const { beat } = req.body;

  if (!beat) {
    return res.status(400).json({
      success: false,
      message: "Beat name is required",
    });
  }

  try {
    const query = `
     WITH all_beats AS (
    -- Wildlife beats
    SELECT
        "BEAT" AS beat,
        geom
    FROM public."Wildlife_Circle_Beat_Boundary"

    UNION ALL

    -- Social Forestry beats
    SELECT
        "BEAT" AS beat,
        geom
    FROM public."Social_Forestry_Beat_Boundary"

    UNION ALL

    -- Territorial beats
    SELECT
        "Beat" AS beat,
        geom
    FROM public."Teritorial Circle_Beat_Boundary"
),

beat AS (
    SELECT
        geom AS beat_geom,
        ST_Area(geom::geography)::numeric AS beat_area_sq_m
    FROM all_beats
    WHERE beat = :beat
),

patrol_lines AS (
    SELECT
        p.patrol_id,
        p.geom AS patrol_geom_text,
        ST_MakeLine(
            ST_SetSRID(
                ST_MakePoint(
                    CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 1), ' ', 2) AS FLOAT),
                    CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 1), ' ', 1) AS FLOAT)
                ), 4326
            ),
            ST_SetSRID(
                ST_MakePoint(
                    CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 2), ' ', 2) AS FLOAT),
                    CAST(SPLIT_PART(SPLIT_PART(p.geom, ',', 2), ' ', 1) AS FLOAT)
                ), 4326
            )
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
    :beat AS beat,
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

router.post("/coupe-patrol-coverage", verifyJwt, async (req, res) => {

  let { coupe_table, start_date, end_date, division, range } = req.body;

  // Validate date range
  if (!start_date || !end_date) {
    return res.status(400).json({
      success: false,
      message: "Start date and end date are required"
    });
  }

  try {
    // Validate date format
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD format"
      });
    }

    // Clean division name by removing "Forest Division" if present
    let cleanDivision = division;
    if (cleanDivision) {
      cleanDivision = cleanDivision.replace(/\s*Forest\s+Division\s*/i, '').trim();
    }

    // Build the WHERE clause for coupe selection based on available filters
    let coupeWhereClause = "";
    let patrolWhereClause = "";
    let coupeReplacements = {};
    let patrolReplacements = {};

    // Determine the filter type and build appropriate WHERE clauses
    if (coupe_table) {
      // If specific beat is provided, filter by that beat (case-insensitive)
      coupeWhereClause = `WHERE LOWER(beat) = LOWER(:coupe_table)`;
      coupeReplacements.coupe_table = coupe_table;
      
      // Also filter patrols by the same beat (case-insensitive)
      patrolWhereClause = `AND LOWER(p.beat) = LOWER(:coupe_table)`;
      patrolReplacements.coupe_table = coupe_table;
      
    } else if (range) {
      // If range is provided, filter beats by that range (case-insensitive)
      coupeWhereClause = `WHERE LOWER(range) = LOWER(:range)`;
      coupeReplacements.range = range;
      
      // Filter patrols by the same range (case-insensitive)
      patrolWhereClause = `AND LOWER(p.range) = LOWER(:range)`;
      patrolReplacements.range = range;
      
      // Add division filter if provided (using cleaned division name)
      if (cleanDivision) {
        coupeWhereClause += ` AND LOWER(division) LIKE LOWER(:cleanDivision)`;
        coupeReplacements.cleanDivision = `%${cleanDivision}%`;
        patrolWhereClause += ` AND LOWER(p.division) LIKE LOWER(:cleanDivision)`;
        patrolReplacements.cleanDivision = `%${cleanDivision}%`;
      }
      
    } else if (division) {
      // If only division is provided, filter beats by cleaned division name
      coupeWhereClause = `WHERE LOWER(division) LIKE LOWER(:cleanDivision)`;
      coupeReplacements.cleanDivision = `%${cleanDivision}%`;
      
      // Filter patrols by the same division
      patrolWhereClause = `AND LOWER(p.division) LIKE LOWER(:cleanDivision)`;
      patrolReplacements.cleanDivision = `%${cleanDivision}%`;
    }

    const query = `
WITH coupe AS (
    SELECT
        ST_Union(geom) AS coupe_geom,
        ST_Area(ST_Union(geom)::geography) AS coupe_area
    FROM public.beat_witheeee22
    ${coupeWhereClause}
),

patrol_lines AS (
    SELECT
        p.patrol_id,
        p.geom AS patrol_geom_text,
        p.division,
        p.range,
        p.beat,
        p.start_time,
        p.end_time,
        p.patrol_officer_name,
        p.distance_kms,
        p.start_location,
        p.end_location,
        ST_MakeLine(
            ARRAY(
                SELECT
                    ST_SetSRID(
                        ST_MakePoint(
                            CAST(SPLIT_PART(point,' ',2) AS FLOAT),
                            CAST(SPLIT_PART(point,' ',1) AS FLOAT)
                        ),
                        4326
                    )
                FROM unnest(string_to_array(p.geom, ',')) AS point
            )
        ) AS line_geom
    FROM public.patrols p
    WHERE p.geom IS NOT NULL
      AND p.geom LIKE '%,%'
      AND p.start_time >= :start_date::date
      AND p.start_time <= :end_date::date + INTERVAL '1 day' - INTERVAL '1 second'
      ${patrolWhereClause}
),

patrol_buffers AS (
    SELECT
        patrol_id,
        patrol_geom_text,
        division,
        range,
        beat,
        start_time,
        end_time,
        patrol_officer_name,
        distance_kms,
        start_location,
        end_location,
        ST_Buffer(line_geom::geography, 30)::geometry AS buffer_geom
    FROM patrol_lines
),

clipped_buffers AS (
    SELECT
        pb.patrol_id,
        pb.patrol_geom_text,
        pb.division,
        pb.range,
        pb.beat,
        pb.start_time,
        pb.end_time,
        pb.patrol_officer_name,
        pb.distance_kms,
        pb.start_location,
        pb.end_location,
        ST_Intersection(pb.buffer_geom, c.coupe_geom) AS clipped_geom
    FROM patrol_buffers pb
    CROSS JOIN coupe c
    WHERE ST_Intersects(pb.buffer_geom, c.coupe_geom)
),

unioned AS (
    SELECT
        ST_Union(clipped_geom) AS union_geom
    FROM clipped_buffers
),

coverage_calc AS (
    SELECT
        c.coupe_area,
        COALESCE(ST_Area(u.union_geom::geography),0) AS patrol_area
    FROM coupe c
    LEFT JOIN unioned u ON TRUE
)

SELECT
    ${coupe_table ? ':coupe_table' : (range ? ':range' : (division ? ':cleanDivision' : 'All Areas'))} AS selected_filter,
    ROUND(COALESCE(cc.coupe_area::numeric, 0), 2) AS coupe_area_sq_m,
    ROUND(COALESCE(cc.patrol_area::numeric, 0), 2) AS patrol_area_sq_m,
    ROUND(
    COALESCE(
        (cc.patrol_area / NULLIF(cc.coupe_area, 0) * 100),
        0
    )::numeric,
    2
) AS coverage_percentage,
    json_agg(
        DISTINCT jsonb_build_object(
            'patrol_id', cb.patrol_id,
            'patrol_geom', cb.patrol_geom_text,
            'division', cb.division,
            'range', cb.range,
            'beat', cb.beat,
            'start_time', cb.start_time,
            'end_time', cb.end_time,
            'patrol_officer_name', cb.patrol_officer_name,
            'distance_kms', cb.distance_kms,
            'start_location', cb.start_location,
            'end_location', cb.end_location
        )
    ) FILTER (WHERE cb.patrol_id IS NOT NULL) AS patrols_covering_coupe
FROM coverage_calc cc
LEFT JOIN clipped_buffers cb ON TRUE
GROUP BY cc.coupe_area, cc.patrol_area;
`;

    // Prepare replacements object
    const replacements = {
      start_date,
      end_date,
      ...coupeReplacements,
      ...patrolReplacements
    };

    console.log("Query replacements:", replacements);
    console.log("Coupe WHERE clause:", coupeWhereClause);
    console.log("Patrol WHERE clause:", patrolWhereClause);
    console.log("Date range:", start_date, "to", end_date);

    const result = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });

    // Log the result to debug
    console.log("Query result:", JSON.stringify(result, null, 2));

    // Check if any results were returned
    if (!result || result.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: "No coverage data found for the selected criteria"
      });
    }

    res.json({
      success: true,
      data: result[0]
    });

  } catch (error) {

    console.error("Coupe patrol coverage error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to calculate coupe patrol coverage",
      error: error.message
    });

  }

});


          
router.post("/boundary-patrol-coverage", verifyJwt, async (req, res) => {
  let { boundary, month } = req.body;

  if (!boundary || !month) {
    return res.status(400).json({
      success: false,
      message: "Boundary and month are required"
    });
  }

  try {
    // Convert boundary name to table name
    const coupe_table = "patrol_boundary_" + boundary.toLowerCase().replace(/\s+/g, "_");

    // Convert YYYY-MM → YYYY-MM-01
    const month_start = `${month}-01`;

    const query = `
WITH coupe AS (
    SELECT
        ST_Union(geom) AS coupe_geom,
        ST_Area(ST_Union(geom)::geography) AS coupe_area
    FROM public."${coupe_table}"
),

patrol_lines AS (
    SELECT
        p.patrol_id,
        p.geom AS patrol_geom_text,
        p.division,
        p.range,
        p.beat,
        p.start_time,
        p.end_time,
        p.patrol_officer_name,
        p.distance_kms,
        p.start_location,
        p.end_location,
        p.patrolling_type_id,
        p.number_of_staff,
        p.user_id,
        -- Get type_name based on patrolling_type_id
        CASE 
            WHEN p.patrolling_type_id = 1 THEN 'Day patrolling'
            WHEN p.patrolling_type_id = 2 THEN 'Night patrolling'
            WHEN p.patrolling_type_id = 3 THEN 'Beat checking'
            ELSE 'Unknown'
        END AS type_name,
        ST_MakeLine(
            ARRAY(
                SELECT
                    ST_SetSRID(
                        ST_MakePoint(
                            CAST(SPLIT_PART(point,' ',2) AS FLOAT),
                            CAST(SPLIT_PART(point,' ',1) AS FLOAT)
                        ),
                        4326
                    )
                FROM unnest(string_to_array(p.geom, ',')) AS point
            )
        ) AS line_geom
    FROM public.patrols p
    WHERE p.geom IS NOT NULL
      AND p.geom LIKE '%,%'
      AND p.start_time >= :month_start::timestamp
      AND p.start_time < (:month_start::timestamp + INTERVAL '1 month')
),

patrol_buffers AS (
    SELECT
        patrol_id,
        patrol_geom_text,
        division,
        range,
        beat,
        start_time,
        end_time,
        patrol_officer_name,
        distance_kms,
        start_location,
        end_location,
        type_name,
        number_of_staff,
        patrolling_type_id,
        user_id,
        ST_Buffer(line_geom::geography, 30)::geometry AS buffer_geom
    FROM patrol_lines
),

clipped_buffers AS (
    SELECT DISTINCT ON (pb.patrol_id)
        pb.patrol_id,
        pb.patrol_geom_text,
        pb.division,
        pb.range,
        pb.beat,
        pb.start_time,
        pb.end_time,
        pb.patrol_officer_name,
        pb.distance_kms,
        pb.start_location,
        pb.end_location,
        pb.type_name,
        pb.number_of_staff,
        pb.patrolling_type_id,
        pb.user_id,
        ST_Intersection(pb.buffer_geom, c.coupe_geom) AS clipped_geom
    FROM patrol_buffers pb
    CROSS JOIN coupe c
    WHERE ST_Intersects(pb.buffer_geom, c.coupe_geom)
),

unioned AS (
    SELECT
        ST_Union(clipped_geom) AS union_geom
    FROM clipped_buffers
),

coverage_calc AS (
    SELECT
        c.coupe_area,
        COALESCE(ST_Area(u.union_geom::geography), 0) AS patrol_area
    FROM coupe c
    CROSS JOIN unioned u
)

SELECT
    '${coupe_table}' AS coupe_table,
    ROUND(cc.coupe_area::numeric, 2) AS coupe_area_sq_m,
    ROUND(cc.patrol_area::numeric, 2) AS patrol_area_sq_m,
    ROUND(
        ((cc.patrol_area::numeric / NULLIF(cc.coupe_area::numeric, 0)) * 100),
        2
    ) AS coverage_percentage,
    COALESCE(
        (
            SELECT json_agg(
                jsonb_build_object(
                    'patrol_id', cb.patrol_id,
                    'patrol_geom', cb.patrol_geom_text,
                    'division', cb.division,
                    'range', cb.range,
                    'beat', cb.beat,
                    'start_time', cb.start_time,
                    'end_time', cb.end_time,
                    'patrol_officer_name', cb.patrol_officer_name,
                    'distance_kms', cb.distance_kms,
                    'start_location', cb.start_location,
                    'end_location', cb.end_location,
                    'type_name', cb.type_name,
                    'number_of_staff', cb.number_of_staff,
                    'patrolling_type_id', cb.patrolling_type_id,
                    'user_id', cb.user_id
                )
            )
            FROM clipped_buffers cb
            WHERE cb.patrol_id IS NOT NULL
        ),
        '[]'::json
    ) AS patrols_covering_coupe
FROM coverage_calc cc;
`;

    const result = await sequelize.query(query, {
      replacements: { month_start },
      type: sequelize.QueryTypes.SELECT
    });

    if (result && result.length > 0) {
      const data = result[0];
      
      // Parse the patrols_covering_coupe if it's a string
      let patrolsArray = [];
      if (data.patrols_covering_coupe) {
        if (typeof data.patrols_covering_coupe === 'string') {
          try {
            patrolsArray = JSON.parse(data.patrols_covering_coupe);
          } catch (e) {
            console.error("Error parsing patrols JSON:", e);
            patrolsArray = [];
          }
        } else if (Array.isArray(data.patrols_covering_coupe)) {
          patrolsArray = data.patrols_covering_coupe;
        }
      }
      
      // Remove duplicate patrols based on patrol_id
      const uniquePatrols = [];
      const seenPatrolIds = new Set();
      for (const patrol of patrolsArray) {
        if (patrol.patrol_id && !seenPatrolIds.has(patrol.patrol_id)) {
          seenPatrolIds.add(patrol.patrol_id);
          uniquePatrols.push(patrol);
        }
      }
      data.patrols_covering_coupe = uniquePatrols;
      
      console.log("Number of patrols found:", uniquePatrols.length);
      if (uniquePatrols.length > 0) {
        console.log("Sample patrol data:", JSON.stringify(uniquePatrols[0], null, 2));
      }
      
      res.json({
        success: true,
        data: data
      });
    } else {
      res.json({
        success: true,
        data: {
          coupe_table: coupe_table,
          coupe_area_sq_m: 0,
          patrol_area_sq_m: 0,
          coverage_percentage: 0,
          patrols_covering_coupe: []
        }
      });
    }

  } catch (error) {
    console.error("Boundary patrol coverage error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate boundary patrol coverage",
      error: error.message
    });
  }
});
module.exports = router;
