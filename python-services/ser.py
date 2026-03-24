import psycopg2
import json
import os
import signal
import time
from datetime import datetime, timedelta
import argparse

# ---------------- CONFIG ----------------
DB_CONFIG = {
    "host": "68.178.167.216",
    "database": "Recap4NDC_new",
    "user": "postgres",
    "password": "P$DB@25%$#!26",
    "port": 5432
}

CHECKPOINT_FILE = "checkpoint.json"
LOG_FILE = "process.log"
GRID_SIZE = 0.00027
PROJECT_ID = "giz-gujarat"
CHECK_INTERVAL = 3600  # Check every hour (in seconds)
RUN_DAY = 1  # Day of month to run

# ---------------- LOG ----------------
def log(msg):
    ts = datetime.now().isoformat()
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

# ---------------- CHECKPOINT ----------------
def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE) as f:
            return json.load(f)
    return {"processed": [], "last_run_month": None}

def save_checkpoint(data):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f)

# ---------------- DB ----------------
def get_db():
    return psycopg2.connect(**DB_CONFIG)

# ---------------- EE ----------------
def init_ee():
    try:
        ee.Initialize(project=PROJECT_ID)
    except:
        ee.Authenticate()
        ee.Initialize(project=PROJECT_ID)
    log("Earth Engine initialized")

# ---------------- DATES ----------------
def get_dates():
    today = datetime.today()

    first_current = today.replace(day=1)
    last_prev = first_current - timedelta(days=1)
    first_prev = last_prev.replace(day=1)

    last_prev2 = first_prev - timedelta(days=1)
    first_prev2 = last_prev2.replace(day=1)

    return {
        "start1": first_prev2.strftime("%Y-%m-%d"),
        "end1": last_prev2.strftime("%Y-%m-%d"),
        "start2": first_prev.strftime("%Y-%m-%d"),
        "end2": last_prev.strftime("%Y-%m-%d"),
        "suffix": first_prev.strftime("%Y_%m_%d"),
        "col1": first_prev2.strftime("%b").lower() + "_ndvi",
        "col2": first_prev.strftime("%b").lower() + "_ndvi",
        "month_year": first_prev.strftime("%Y_%m")
    }

# ---------------- GEOJSON ----------------
def validate_geojson(g):
    try:
        geom = json.loads(g)
        if geom["type"] not in ["Polygon", "MultiPolygon"]:
            return None
        return geom
    except:
        return None

# ---------------- GRID ----------------
def create_grid(xmin, ymin, xmax, ymax):
    cells = []
    x = xmin
    gx = 0

    while x < xmax:
        y = ymin
        gy = 0

        while y < ymax:
            poly = {
                "type": "Polygon",
                "coordinates": [[
                    [x,y],[x+GRID_SIZE,y],
                    [x+GRID_SIZE,y+GRID_SIZE],
                    [x,y+GRID_SIZE],[x,y]
                ]]
            }
            cells.append({"grid_x": gx, "grid_y": gy, "geometry": poly})
            y += GRID_SIZE
            gy += 1

        x += GRID_SIZE
        gx += 1

    return cells

# ---------------- EE ANALYSIS ----------------
def analyze(fid, ee_geom, cells, village, coupe_no, d):

    feats = []
    for c in cells:
        try:
            feats.append(ee.Feature(ee.Geometry(c["geometry"]), c))
        except:
            continue

    if not feats:
        return []

    fc = ee.FeatureCollection(feats)

    def prep(img):
        return img.select(['B4','B8']).divide(10000)

    img1 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
        .filterDate(d["start1"], d["end1"]) \
        .filterBounds(ee_geom).map(prep).median()

    img2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
        .filterDate(d["start2"], d["end2"]) \
        .filterBounds(ee_geom).map(prep).median()

    ndvi1 = img1.normalizedDifference(['B8','B4']).rename('m1')
    ndvi2 = img2.normalizedDifference(['B8','B4']).rename('m2')
    change = ndvi2.subtract(ndvi1).rename('chg')

    img = ee.Image.cat([ndvi1, ndvi2, change])

    try:
        res = img.reduceRegions(fc, ee.Reducer.mean(), 30).getInfo()
    except Exception as e:
        log(f"EE error: {e}")
        return []

    output = []

    for f in res.get("features", []):
        p = f["properties"]

        if p.get("chg") is not None and p["chg"] < -0.3:

            coords = f["geometry"]["coordinates"][0]

            lon = sum(c[0] for c in coords) / len(coords)
            lat = sum(c[1] for c in coords) / len(coords)

            output.append({
                "fid": fid,
                "gx": p.get("grid_x"),
                "gy": p.get("grid_y"),
                "ndvi1": p.get("m1"),
                "ndvi2": p.get("m2"),
                "chg": p.get("chg"),
                "geom": json.dumps(f["geometry"]),
                "lon": lon,
                "lat": lat,
                "village": village,
                "coupe": coupe_no
            })

    return output

# ---------------- TABLE ----------------
def create_table(cur, table, col1, col2):

    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS "{table}" (
            polygon_fid INT,
            grid_x INT,
            grid_y INT,
            "{col1}" FLOAT,
            "{col2}" FLOAT,
            "NDVI_change" FLOAT,
            change_category TEXT,
            geom geometry,
            longitude FLOAT,
            latitude FLOAT,
            village TEXT,
            coupe_no TEXT,
            area_sq_m FLOAT,
            UNIQUE(polygon_fid, grid_x, grid_y)
        )
    """)

    safe = table.replace("-", "_")

    cur.execute(f"""
        CREATE INDEX IF NOT EXISTS idx_{safe[:25]}_geom
        ON "{table}" USING GIST (geom)
    """)

# ---------------- INSERT ----------------
def insert(cur, table, rows, col1, col2):

    for r in rows:
        try:
            cur.execute(f"""
                INSERT INTO "{table}"
                (polygon_fid, grid_x, grid_y,
                 "{col1}", "{col2}", "NDVI_change",
                 change_category, geom,
                 longitude, latitude, village, coupe_no, area_sq_m)
                VALUES (%s,%s,%s,%s,%s,%s,'Degradation',
                ST_SetSRID(ST_GeomFromGeoJSON(%s),4326),
                %s,%s,%s,%s,900)
                ON CONFLICT DO NOTHING
            """, (
                r["fid"], r["gx"], r["gy"],
                r["ndvi1"], r["ndvi2"], r["chg"],
                r["geom"], r["lon"], r["lat"],
                r["village"], r["coupe"]
            ))
        except Exception as e:
            log(f"Insert error: {e}")

# ---------------- PROCESSING LOGIC ----------------
def run_analysis():
    """Main analysis function - returns True if processed, False if skipped"""
    today = datetime.today()
    
    # Check if it's the run day
    if today.day != RUN_DAY:
        log(f"Not day {RUN_DAY} of month, skipping processing")
        return False
    
    checkpoint = load_checkpoint()
    d = get_dates()
    
    # Check if we already ran for this month
    if checkpoint.get("last_run_month") == d["month_year"]:
        log(f"Already processed for {d['month_year']}, skipping")
        return False
    
    log(f"Starting analysis for {d['month_year']}")
    
    try:
        init_ee()
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("SELECT DISTINCT division FROM public.coupe_all")
        coupes = [c[0] for c in cur.fetchall()]
        
        for coupe in coupes:
            key = f"{d['suffix']}_{coupe}"
            if key in checkpoint["processed"]:
                continue
                
            log(f"Processing {coupe}")
            
            try:
                table = f"{d['suffix']}_{coupe}_NDVI"
                
                create_table(cur, table, d["col1"], d["col2"])
                conn.commit()
                
                coupe_table = f"{coupe}_coupe"
                
                cur.execute("SELECT to_regclass(%s)", (coupe_table,))
                if not cur.fetchone()[0]:
                    log(f"Table {coupe_table} missing, skipping")
                    continue
                    
                cur.execute(f"""
                    SELECT id, ST_AsGeoJSON(geom), village, coupe_no
                    FROM "{coupe_table}"
                """)
                
                for fid, gjson, village, coupe_no in cur.fetchall():
                    geom = validate_geojson(gjson)
                    if not geom:
                        continue
                        
                    ee_geom = ee.Geometry(geom)
                    
                    cur.execute("""
                        SELECT ST_XMin(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                               ST_YMin(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                               ST_XMax(ST_Envelope(ST_GeomFromGeoJSON(%s))),
                               ST_YMax(ST_Envelope(ST_GeomFromGeoJSON(%s)))
                    """, (gjson,gjson,gjson,gjson))
                    
                    xmin,ymin,xmax,ymax = cur.fetchone()
                    cells = create_grid(xmin,ymin,xmax,ymax)
                    rows = analyze(fid, ee_geom, cells, village, coupe_no, d)
                    insert(cur, table, rows, d["col1"], d["col2"])
                    conn.commit()
                    
                checkpoint["processed"].append(key)
                save_checkpoint(checkpoint)
                
            except Exception as e:
                log(f"Error in {coupe}: {e}")
                conn.rollback()
                
        cur.close()
        conn.close()
        
        # Update last run month
        checkpoint["last_run_month"] = d["month_year"]
        checkpoint["processed"] = []  # Reset for next month
        save_checkpoint(checkpoint)
        
        log(f"Analysis completed for {d['month_year']}")
        return True
        
    except Exception as e:
        log(f"Fatal error in analysis: {e}")
        return False

# ---------------- CONTINUOUS RUN LOOP ----------------
def continuous_run(interval=CHECK_INTERVAL):
    """Keep the script running and check periodically"""
    log(f"Starting continuous monitoring - will check every {interval} seconds")
    log(f"Will run analysis on day {RUN_DAY} of each month")
    
    running = True
    
    def signal_handler(sig, frame):
        nonlocal running
        log("Received shutdown signal, exiting...")
        running = False
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    last_check_date = None
    
    while running:
        try:
            current_date = datetime.now().date()
            
            # Check if we need to run (once per day at most)
            if last_check_date != current_date:
                log(f"Checking for analysis run on {current_date}")
                run_analysis()
                last_check_date = current_date
            
            # Sleep for the interval
            time.sleep(interval)
            
        except Exception as e:
            log(f"Error in main loop: {e}")
            time.sleep(60)  # Sleep for a minute on error

# ---------------- RUN ----------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Force run immediately")
    parser.add_argument("--daemon", action="store_true", help="Run as daemon (continuous)")
    parser.add_argument("--interval", type=int, default=CHECK_INTERVAL, 
                       help=f"Check interval in seconds (default: {CHECK_INTERVAL})")
    args = parser.parse_args()
    
    if args.force:
        # Force immediate run
        run_analysis()
    elif args.daemon:
        # Run continuously
        continuous_run(interval=args.interval)
    else:
        # Single run with date check
        run_analysis()