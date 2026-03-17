import ee
import psycopg2
import json
import os
import signal
from datetime import datetime
import time
import requests
from requests.auth import HTTPBasicAuth
import urllib3
import warnings
import re

# Disable SSL warnings like Node.js does
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ---------------- CONFIG ----------------
DB_CONFIG = {
    "host": "68.178.167.216",
    "database": "Recap4NDC_new",
    "user": "postgres",
    "password": "P$DB@25%$#!26",
    "port": 5432
}


GEOSERVER_URL = "http://68.178.167.216:8081/geoserver"
GEOSERVER_USER = "admin"
GEOSERVER_PASS = "Geo@$ecure#%26"
WORKSPACE = "Recap4NDC"
DATASTORE = "Recap4NDC_NEW1"
STYLE_NAME = "NDVI_CHANGE_NEW2222"

CHECKPOINT_FILE = "checkpoint_all_coupes.json"
LOG_FILE = "process2.log"

GRID_SIZE = 0.00027
MAX_RETRIES = 3
RETRY_DELAY = 5




first_month_START = "2026-01-01"
first_month_END   = "2026-01-30"
second_month_START = "2026-02-01"
second_month_END   = "2026-02-28"

PROJECT_ID = "giz-gujarat"

# ---------------- LOGGING ----------------
def log(msg):
    ts = datetime.now().isoformat()
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

# ---------------- CHECKPOINT ----------------
def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"processed": []}

def save_checkpoint(processed):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({"processed": processed}, f)

# ---------------- DB CONNECTION ----------------
def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

# ---------------- EARTH ENGINE ----------------
def initialize_ee():
    try:
        ee.Initialize(project=PROJECT_ID)
        log("Earth Engine initialized")
    except ee.EEException:
        ee.Authenticate()
        ee.Initialize(project=PROJECT_ID)
        log("Earth Engine authenticated")


def check_geoserver_connection():
    """Simple GeoServer connection check"""
    try:
        url = f"{GEOSERVER_URL}/ows?service=wfs&version=1.0.0&request=GetCapabilities"
        response = requests.get(
            url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            verify=False,
            timeout=30
        )
        if response.status_code == 200:
            log("GeoServer connection successful")
            return True
        else:
            log(f"GeoServer connection failed. Status: {response.status_code}")
            return False
    except Exception as e:
        log(f"Error connecting to GeoServer: {str(e)}")
        return False

def check_layer_exists(layer_name):
    """Check if layer already exists in GeoServer"""
    try:
        url = f"{GEOSERVER_URL}/rest/layers/{WORKSPACE}:{layer_name}"
        
        response = requests.get(
            url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            verify=False,
            timeout=30
        )
        
        return response.status_code == 200
    except Exception:
        return False

def check_featuretype_exists(layer_name):
    """Check if feature type already exists in datastore"""
    try:
        url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/datastores/{DATASTORE}/featuretypes/{layer_name}"
        
        response = requests.get(
            url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            verify=False,
            timeout=30
        )
        
        return response.status_code == 200
    except Exception:
        return False

def publish_layer_simple(table_name):
    """Fixed layer publishing function"""
    try:
        # Sanitize the layer name for GeoServer
        layer_name = table_name
        original_table = table_name  # Keep original for PostgreSQL
        
        log(f"Publishing layer: {layer_name} (from table: {original_table})")
        
        # First check if feature type already exists
        if check_featuretype_exists(layer_name):
            log(f"Feature type '{layer_name}' already exists in datastore")
            # Try to update instead of create
            return update_featuretype(layer_name, original_table)
        
        # Create new feature type
        log(f"Creating new feature type: {layer_name}")
        
        # Use the full XML format that GeoServer expects
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
  <name>{layer_name}</name>
  <nativeName>{original_table}</nativeName>
  <title>{layer_name} - NDVI Change</title>
  <abstract>NDVI Change Analysis for {original_table}</abstract>
  <srs>EPSG:4326</srs>
  <enabled>true</enabled>
  <advertised>true</advertised>
</featureType>"""

        feature_type_url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/datastores/{DATASTORE}/featuretypes"
        
        headers = {"Content-Type": "application/xml"}
        
        log(f"POST to: {feature_type_url}")
        response = requests.post(
            feature_type_url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            data=xml,
            headers=headers,
            verify=False,
            timeout=60
        )
        
        log(f"Response status: {response.status_code}")
        
        if response.status_code in [201, 200]:
            log(f"Feature type '{layer_name}' created successfully")
            
            # Wait a moment for GeoServer to process
            time.sleep(2)
            
            # Try to apply style
            apply_style_to_layer(layer_name)
            
            return True
        else:
            log(f"Failed to create feature type. Status: {response.status_code}")
            log(f"Response text: {response.text[:1000]}")
            
            # If creation failed, try to update existing
            if response.status_code == 400 and "already exists" in response.text.lower():
                log(f"Feature type might already exist, trying update...")
                return update_featuretype(layer_name, original_table)
            return False
            
    except Exception as e:
        log(f"Error in layer publishing: {str(e)}")
        return False

def update_featuretype(layer_name, table_name):
    """Update an existing feature type"""
    try:
        log(f"Updating existing feature type: {layer_name}")
        
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<featureType>
  <name>{layer_name}</name>
  <nativeName>{table_name}</nativeName>
  <title>{layer_name} - NDVI Change</title>
  <abstract>NDVI Change Analysis for {table_name}</abstract>
  <srs>EPSG:4326</srs>
  <enabled>true</enabled>
  <advertised>true</advertised>
</featureType>"""
        
        url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/datastores/{DATASTORE}/featuretypes/{layer_name}"
        
        headers = {"Content-Type": "application/xml"}
        
        response = requests.put(
            url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            data=xml,
            headers=headers,
            verify=False,
            timeout=60
        )
        
        log(f"Update response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            log(f"Feature type '{layer_name}' updated successfully")
            apply_style_to_layer(layer_name)
            return True
        else:
            log(f"Failed to update feature type. Status: {response.status_code}")
            log(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        log(f"Error updating feature type: {str(e)}")
        return False

def apply_style_to_layer(layer_name):
    """Apply style to layer"""
    try:
        log(f"Applying style '{STYLE_NAME}' to layer '{layer_name}'")
        
        style_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<layer>
  <defaultStyle>
    <name>{STYLE_NAME}</name>
  </defaultStyle>
  <styles>
    <style>
      <name>{STYLE_NAME}</name>
    </style>
  </styles>
</layer>"""
        
        url = f"{GEOSERVER_URL}/rest/layers/{WORKSPACE}:{layer_name}"
        
        headers = {"Content-Type": "application/xml"}
        
        response = requests.put(
            url,
            auth=HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASS),
            data=style_xml,
            headers=headers,
            verify=False,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            log(f"Style '{STYLE_NAME}' applied successfully to layer '{layer_name}'")
            return True
        else:
            log(f"Failed to apply style. Status: {response.status_code}")
            return False
            
    except Exception as e:
        log(f"Error applying style: {str(e)}")
        return False

def initialize_geoserver():
    """Initialize GeoServer connection"""
    log("Initializing GeoServer...")
    
    if check_geoserver_connection():
        log("GeoServer connection verified")
        return True
    else:
        log("WARNING: Could not connect to GeoServer. Will still process data.")
        return False

# ---------------- ENHANCED GEOMETRY FIXING ----------------
def fix_geometry(cur, coupe):
    """Comprehensive geometry fixing with multiple cleanup steps"""
    log(f"Starting comprehensive geometry fixing for {coupe}")
    
    # Step 1: Fix invalid geometries
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Multi(ST_MakeValid(geom))
        WHERE geom IS NOT NULL AND NOT ST_IsValid(geom);
    """)
    log(f"  Step 1: Fixed invalid geometries")
    
    # Step 2: Remove slivers and small polygons
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(geom), 3))
        WHERE geom IS NOT NULL;
    """)
    log(f"  Step 2: Extracted polygon collections")
    
    # Step 3: Buffer to remove tiny self-intersections
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Multi(ST_Buffer(ST_MakeValid(geom), 0.0000001))
        WHERE geom IS NOT NULL AND ST_IsValid(geom) = false;
    """)
    log(f"  Step 3: Buffered invalid geometries")
    
    # Step 4: Set SRID if not set
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_SetSRID(geom, 4326)
        WHERE geom IS NOT NULL AND ST_SRID(geom) = 0;
    """)
    log(f"  Step 4: Set SRID to 4326")
    
    # Step 5: Transform to 4326 if needed
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Transform(geom, 4326)
        WHERE geom IS NOT NULL AND ST_SRID(geom) <> 4326;
    """)
    log(f"  Step 5: Transformed to 4326")
    
    # Step 6: Simplify complex geometries
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Multi(ST_Simplify(geom, 0.00001))
        WHERE geom IS NOT NULL;
    """)
    log(f"  Step 6: Simplified geometries")
    
    # Step 7: Remove any remaining invalid geometries
    cur.execute(f"""
        DELETE FROM "{coupe}"
        WHERE geom IS NULL OR NOT ST_IsValid(geom);
    """)
    log(f"  Step 7: Removed remaining invalid geometries")
    
    # Step 8: Add additional cleanup for very complex geometries
    cur.execute(f"""
        UPDATE "{coupe}"
        SET geom = ST_Multi(
            ST_Buffer(
                ST_Buffer(ST_MakeValid(geom), 0.0000001),
                -0.0000001
            )
        )
        WHERE geom IS NOT NULL AND ST_NPoints(geom) > 1000;
    """)
    log(f"  Step 8: Cleaned very complex geometries")
    
    # Step 9: Ensure geometries are not too small
    cur.execute(f"""
        DELETE FROM "{coupe}"
        WHERE geom IS NOT NULL AND ST_Area(geom::geography) < 1;
    """)
    log(f"  Step 9: Removed geometries with area < 1 sqm")
    
    # Get count of remaining geometries
    cur.execute(f'SELECT COUNT(*) FROM "{coupe}"')
    count = cur.fetchone()[0]
    log(f"{coupe} geometry fixing completed. {count} valid geometries remaining")

# ---------------- TABLE CREATION ----------------
def create_degradation_table(cur, table_name):
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS "{table_name}" (
            pixel_id SERIAL PRIMARY KEY,
            polygon_fid INTEGER,
            grid_x INTEGER,
            grid_y INTEGER,
            "dec_NDVI" FLOAT,
            "jan_NDVI" FLOAT,
            "NDVI_change" FLOAT,
            change_category TEXT,
            geom geometry(MultiPolygon,4326),
            longitude FLOAT,
            latitude FLOAT,
            village TEXT,
            coupe_no TEXT,
            area_sq_m FLOAT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(polygon_fid,grid_x,grid_y)
        );
    """)
    
    # Create spatial index for better performance
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name.replace('-', '_')}_geom 
        ON "{table_name}" USING GIST (geom);
    """)
    
    # Create indexes for frequently queried columns
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name.replace('-', '_')}_change 
        ON "{table_name}" ("NDVI_change");
    """)
    
    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{table_name.replace('-', '_')}_coupe 
        ON "{table_name}" (coupe_no);
    """)
    
    log(f"Table {table_name} created with indexes")

# ---------------- GEOMETRY VALIDATION ----------------
def validate_geojson(geom_json):
    """Validate and clean GeoJSON geometry with fallback options"""
    try:
        geom_data = json.loads(geom_json)
        
        # Check basic structure
        if 'type' not in geom_data or 'coordinates' not in geom_data:
            log(f"  Missing type or coordinates in GeoJSON")
            return None
            
        geom_type = geom_data['type']
        coords = geom_data['coordinates']
        
        # Handle empty or invalid coordinates
        if not coords or len(coords) == 0:
            log(f"  Empty coordinates")
            return None
            
        # Validate coordinates structure
        def validate_coordinate(coord):
            """Validate individual coordinate pair"""
            if not isinstance(coord, list) or len(coord) < 2:
                return False
            lon, lat = coord[0], coord[1]
            # Check for valid numeric values
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                return False
            # Check for valid ranges
            if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
                return False
            # Check for NaN or infinite values
            if not (float('-inf') < lon < float('inf')) or not (float('-inf') < lat < float('inf')):
                return False
            return True
        
        # For Polygon
        if geom_type == 'Polygon':
            if not isinstance(coords, list):
                return None
                
            # Validate all rings
            valid_rings = []
            for ring in coords:
                if not isinstance(ring, list) or len(ring) < 4:
                    continue
                    
                # Validate all coordinates in the ring
                valid_coords = []
                for coord in ring:
                    if validate_coordinate(coord):
                        valid_coords.append([float(coord[0]), float(coord[1])])
                
                if len(valid_coords) >= 4:
                    # Ensure ring is closed
                    if valid_coords[0] != valid_coords[-1]:
                        valid_coords.append(valid_coords[0])
                    valid_rings.append(valid_coords)
            
            if not valid_rings:
                return None
                
            geom_data['coordinates'] = valid_rings
            
        # For MultiPolygon
        elif geom_type == 'MultiPolygon':
            if not isinstance(coords, list):
                return None
                
            valid_polygons = []
            for polygon in coords:
                if not isinstance(polygon, list):
                    continue
                    
                valid_rings = []
                for ring in polygon:
                    if not isinstance(ring, list) or len(ring) < 4:
                        continue
                        
                    valid_coords = []
                    for coord in ring:
                        if validate_coordinate(coord):
                            valid_coords.append([float(coord[0]), float(coord[1])])
                    
                    if len(valid_coords) >= 4:
                        if valid_coords[0] != valid_coords[-1]:
                            valid_coords.append(valid_coords[0])
                        valid_rings.append(valid_coords)
                
                if valid_rings:
                    valid_polygons.append(valid_rings)
            
            if not valid_polygons:
                return None
                
            geom_data['coordinates'] = valid_polygons
            
        else:
            log(f"  Unsupported geometry type: {geom_type}")
            return None
            
        return geom_data
        
    except json.JSONDecodeError as e:
        log(f"  JSON decode error: {e}")
        return None
    except Exception as e:
        log(f"  Geometry validation error: {e}")
        return None

def create_safe_ee_geometry(geom_data, fid):
    """Create Earth Engine geometry with multiple fallback strategies"""
    attempts = [
        lambda: ee.Geometry(geom_data),  # Try direct creation
        lambda: ee.Geometry(geom_data, 'EPSG:4326'),  # Try with explicit CRS
    ]
    
    for i, attempt in enumerate(attempts):
        try:
            return attempt()
        except Exception as e:
            if i == len(attempts) - 1:
                log(f"  All geometry creation attempts failed for fid {fid}: {e}")
                return None
    
    return None

# ---------------- GRID FUNCTIONS ----------------
def create_grid_cells(xmin, ymin, xmax, ymax, size):
    """Create grid cells with validation"""
    cells = []
    gx = 0
    x = xmin
    while x < xmax:
        gy = 0
        y = ymin
        while y < ymax:
            # Ensure coordinates are valid
            if (-180 <= x <= 180) and (-90 <= y <= 90) and \
               (-180 <= x+size <= 180) and (-90 <= y+size <= 90):
                geom = {
                    "type": "Polygon",
                    "coordinates": [[
                        [x, y],
                        [x + size, y],
                        [x + size, y + size],
                        [x, y + size],
                        [x, y]  # Ensure closed
                    ]]
                }
                cells.append({"grid_x": gx, "grid_y": gy, "geometry": geom})
            y += size
            gy += 1
        x += size
        gx += 1
    return cells

def filter_intersecting_cells(cur, geom_json, grid_cells):
    """Filter grid cells that intersect with the polygon"""
    out = []
    for cell in grid_cells:
        try:
            cur.execute("""
                SELECT ST_Intersects(
                    ST_GeomFromGeoJSON(%s),
                    ST_GeomFromGeoJSON(%s)
                )
            """, (geom_json, json.dumps(cell["geometry"])))
            if cur.fetchone()[0]:
                out.append(cell)
        except Exception as e:
            log(f"  Error checking intersection: {e}")
            continue
    return out

# ---------------- EE ANALYSIS ----------------
def analyze_grid_cells(fid, ee_polygon, grid_cells, village, coupe_no):
    """Analyze grid cells with robust error handling"""
    if not ee_polygon:
        log(f"  No valid EE polygon for analysis")
        return []
    
    feats = []
    for c in grid_cells:
        try:
            # Validate grid cell geometry
            cell_geom = c["geometry"]
            if not cell_geom.get('coordinates'):
                continue
                
            # Ensure polygon is properly closed
            coords = cell_geom['coordinates'][0]
            if len(coords) >= 4 and coords[0] != coords[-1]:
                cell_geom['coordinates'][0].append(coords[0])
            
            # Create Earth Engine feature
            feat = ee.Feature(ee.Geometry(cell_geom), c)
            feats.append(feat)
        except Exception as e:
            log(f"  Error creating feature for grid cell: {e}")
            continue
    
    if not feats:
        log(f"  No valid features created for grid cells")
        return []
    
    try:
        fc = ee.FeatureCollection(feats)
    except Exception as e:
        log(f"  Error creating FeatureCollection: {e}")
        return []
    
    # Define preprocessing function
    def preprocess(img):
        cloud = img.select('MSK_CLDPRB').lt(80)
        scl = img.select('SCL').gte(4).And(img.select('SCL').lte(7))
        return img.select(['B4', 'B8']).divide(10000).updateMask(cloud.And(scl))
    
    # Get imagery with error handling
    try:
        nov = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")\
            .filterDate(first_month_START, first_month_END)\
            .filterBounds(ee_polygon)\
            .map(preprocess)\
            .median()
        
        dec = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")\
            .filterDate(second_month_START, second_month_END)\
            .filterBounds(ee_polygon)\
            .map(preprocess)\
            .median()
    except Exception as e:
        log(f"  Error getting imagery: {e}")
        return []
    
    # Calculate NDVI and change
    try:
        nov_ndvi = nov.normalizedDifference(['B8', 'B4']).rename('nov')
        dec_ndvi = dec.normalizedDifference(['B8', 'B4']).rename('dec')
        chg = dec_ndvi.subtract(nov_ndvi).rename('chg')
        
        img = ee.Image.cat([nov_ndvi, dec_ndvi, chg])
        res = img.reduceRegions(fc, ee.Reducer.mean(), 30).getInfo()
    except Exception as e:
        log(f"  Error calculating NDVI or reduceRegions: {e}")
        return []
    
    # Process results
    degraded = []
    if 'features' not in res:
        log(f"  No features in reduceRegions result")
        return degraded
    
    for f in res['features']:
        try:
            p = f['properties']
            if p.get('chg') is not None and p['chg'] < -0.3:
                if 'geometry' not in f or 'coordinates' not in f['geometry']:
                    continue
                    
                coords = f['geometry']['coordinates'][0]
                if not coords or len(coords) < 3:
                    continue
                    
                # Calculate centroid
                lon_sum = sum(c[0] for c in coords)
                lat_sum = sum(c[1] for c in coords)
                lon = lon_sum / len(coords)
                lat = lat_sum / len(coords)

                degraded.append({
                    "polygon_fid": fid,
                    "grid_x": p.get('grid_x', 0),
                    "grid_y": p.get('grid_y', 0),
                    "nov_ndvi": p.get('nov'),
                    "dec_ndvi": p.get('dec'),
                    "ndvi_change": p.get('chg'),
                    "geom": json.dumps(f['geometry']),
                    "longitude": lon,
                    "latitude": lat,
                    "village": village,
                    "coupe_no": coupe_no,
                    "area_sq_m": 900
                })
        except Exception as e:
            continue
    
    return degraded

# ---------------- INSERT ----------------
def insert_pixels(cur, table_name, pixels):
    """Insert pixels with error handling"""
    if not pixels:
        return
    
    successful = 0
    for p in pixels:
        try:
            cur.execute(f"""
                INSERT INTO "{table_name}"
                (polygon_fid,grid_x,grid_y,"dec_NDVI","jan_NDVI","NDVI_change",
                 change_category,geom,longitude,latitude,village,coupe_no,area_sq_m)
                VALUES (%s,%s,%s,%s,%s,%s,'Degradation',
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)),
                %s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """, (p['polygon_fid'], p['grid_x'], p['grid_y'], p['nov_ndvi'],
                 p['dec_ndvi'], p['ndvi_change'], p['geom'], p['longitude'],
                 p['latitude'], p['village'], p['coupe_no'], p['area_sq_m']))
            successful += 1
        except Exception as e:
            log(f"  Error inserting pixel: {e}")
            continue
    
    if successful > 0:
        log(f"  Successfully inserted {successful} pixels")

# ---------------- MAIN PROCESSING ----------------
def process_all_coupes():
    """Main processing function with comprehensive error handling"""
    # Initialize Earth Engine
    try:
        initialize_ee()
    except Exception as e:
        log(f"Fatal: Failed to initialize Earth Engine: {e}")
        return
    
    # Initialize GeoServer
    geoserver_available = initialize_geoserver()
    
    # Database connection
    try:
        conn = get_db_connection()
        cur = conn.cursor()
    except Exception as e:
        log(f"Fatal: Failed to connect to database: {e}")
        return
    
    # Get list of coupes
    try:
        cur.execute("""SELECT DISTINCT division as coupe_name FROM public.coupe_all""")
        coupes = [r[0] for r in cur.fetchall()]
        log(f"Found {len(coupes)} coupes to process")
    except Exception as e:
        log(f"Fatal: Failed to get coupe list: {e}")
        cur.close()
        conn.close()
        return
    
    # Load checkpoint
    checkpoint = load_checkpoint()["processed"]
    log(f"Already processed {len(checkpoint)} coupes")
    
    # Process each coupe
    for coupe in coupes:
        if coupe in checkpoint:
            log(f"Skipping already processed coupe: {coupe}")
            continue
        
        log(f"\n{'='*60}")
        log(f"Starting processing for coupe: {coupe}")
        log(f"{'='*60}")
        
        try:
            # Step 1: Fix geometry
            log(f"Step 1/5: Fixing geometry for {coupe}")
            fix_geometry(cur, f"{coupe}_coupe")
            conn.commit()
            
            # Step 2: Create degradation table
            log(f"Step 2/5: Creating degradation table")
            table_name = f"2026-02-01_{coupe}_coupe_NDVI_Change"
            create_degradation_table(cur, table_name)
            conn.commit()
            
            # Step 3: Get polygons for this coupe
            log(f"Step 3/5: Fetching polygons")
            cur.execute(f"""SELECT id as fid, ST_AsGeoJSON(geom), village, coupe_no 
                          FROM "{coupe}_coupe" ORDER BY fid LIMIT 2""")
            polys = cur.fetchall()
            log(f"  Found {len(polys)} polygons in {coupe}_coupe")
            
            # Step 4: Process each polygon
            log(f"Step 4/5: Processing polygons")
            processed_polygons = 0
            skipped_polygons = 0
            
            for fid, geom_json, village, coupe_no in polys:
                try:
                    # Validate geometry
                    geom_data = validate_geojson(geom_json)
                    if not geom_data:
                        skipped_polygons += 1
                        continue
                    
                    # Create Earth Engine geometry with fallback
                    ee_geom = create_safe_ee_geometry(geom_data, fid)
                    if not ee_geom:
                        skipped_polygons += 1
                        continue
                    
                    # Get bounding box
                    try:
                        cur.execute("""
                            SELECT ST_XMin(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                                   ST_YMin(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                                   ST_XMax(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                                   ST_YMax(ST_Envelope(ST_GeomFromGeoJSON(%s)))
                        """, (geom_json, geom_json, geom_json, geom_json))
                        xmin, ymin, xmax, ymax = cur.fetchone()
                    except Exception:
                        skipped_polygons += 1
                        continue
                    
                    # Skip if bounding box is invalid or too small
                    if xmax - xmin < 0.00001 or ymax - ymin < 0.00001:
                        skipped_polygons += 1
                        continue
                    
                    # Create and filter grid cells
                    grids = create_grid_cells(xmin, ymin, xmax, ymax, GRID_SIZE)
                    grids = filter_intersecting_cells(cur, geom_json, grids)
                    
                    if not grids:
                        skipped_polygons += 1
                        continue
                    
                    # Analyze grid cells
                    pixels = analyze_grid_cells(fid, ee_geom, grids, village, coupe_no)
                    
                    if pixels:
                        insert_pixels(cur, table_name, pixels)
                        conn.commit()
                        processed_polygons += 1
                    else:
                        processed_polygons += 1  # Still counts as processed
                        
                except Exception:
                    skipped_polygons += 1
                    continue
            
            # Step 5: Publish to GeoServer if available
            log(f"Step 5/5: Publishing to GeoServer")
            if geoserver_available:
                # Get sanitized layer name
                layer_name=table_name
                
                if check_layer_exists(layer_name):
                    log(f"  Layer '{layer_name}' already exists in GeoServer")
                    log(f"  Layer URL: {GEOSERVER_URL}/{WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetMap&layers={WORKSPACE}:{layer_name}&styles=&bbox=-180,-90,180,90&width=768&height=330&srs=EPSG:4326&format=application/openlayers")
                else:
                    if publish_layer_simple(table_name):
                        log(f"  Successfully published layer '{layer_name}' to GeoServer")
                        log(f"  Layer URL: {GEOSERVER_URL}/{WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetMap&layers={WORKSPACE}:{layer_name}&styles=&bbox=-180,-90,180,90&width=768&height=330&srs=EPSG:4326&format=application/openlayers")
                    else:
                        log(f"  WARNING: Failed to publish layer '{layer_name}' to GeoServer")
            else:
                log(f"  GeoServer not available. Table '{table_name}' created in database only.")
                log(f"  You can publish manually using table name: {table_name}")
            
            # Update checkpoint
            checkpoint.append(coupe)
            save_checkpoint(checkpoint)
            
            log(f"\nCoupe {coupe} completed:")
            log(f"  Processed polygons: {processed_polygons}")
            log(f"  Skipped polygons: {skipped_polygons}")
            log(f"  Total polygons: {len(polys)}")
            log(f"  Table created: {table_name}")
            log(f"  GeoServer layer: {table_name if geoserver_available else 'Not published'}")
            
        except Exception as e:
            log(f"Fatal error processing coupe {coupe}: {e}")
            log(f"Will skip this coupe and continue with next")
            continue
    
    # Cleanup
    try:
        cur.close()
        conn.close()
        log("\n" + "="*60)
        log("ALL COUPES PROCESSING COMPLETED")
        log("="*60)
    except Exception as e:
        log(f"Error during cleanup: {e}")

# ---------------- ERROR HANDLING ----------------
def handle_keyboard_interrupt(signum, frame):
    log("\n" + "="*60)
    log("PROCESS INTERRUPTED BY USER")
    log("Checkpoint has been saved")
    log("="*60)
    exit(0)

# ---------------- MAIN ENTRY POINT ----------------
if __name__ == "__main__":
    # Set up signal handler for graceful interruption
    signal.signal(signal.SIGINT, handle_keyboard_interrupt)
    
    try:
        log("\n" + "="*60)
        log("STARTING DEGRADATION ANALYSIS PROCESS")
        log("="*60)
        
        process_all_coupes()
        
    except KeyboardInterrupt:
        handle_keyboard_interrupt(None, None)
    except Exception as e:
        log(f"\nFATAL UNHANDLED ERROR: {e}")
        log("Process terminated with error")
        raise